/**
 * Suite automatizada: KAN-24 (RF-04) Respuesta y registro de evaluación, criterios de aceptación.
 *
 * Prueba la API real y la base de datos real (no usa simulaciones). Cubre los 4 criterios y las fronteras de error:
 *  - Criterio 1: el evaluador ve en su bandeja sus evaluaciones con colaborador, ciclo y fecha límite
 *  - Criterio 2: registrar puntajes por criterio guarda un borrador sin enviarlo
 *  - Criterio 3: con todo lo obligatorio respondido, enviar calcula el puntaje ponderado y bloquea la edición
 *  - Criterio 4: si faltan obligatorias, el envío se impide y se indican las pendientes
 *
 * Requiere el servicio en marcha y PerformanceDB con su esquema (db/init.sql).
 * Crea sus propios datos de prueba (identificadores que empiezan con «ac000000») y al terminar borra solo esos:
 * no toca ningún dato real. Con el sistema en Docker:
 *   docker compose exec performance-service node test/acceptance_criteria.test.js
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { Pool } = require("pg");

const API_BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 3006}`;

const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : undefined);

const id = (n) => `ac000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PATRON_ID = "ac000000-%";

const EVALUADOR = id(21);
const OTRO_EVALUADOR = id(22);
const CREADOR = id(23);
const DEPARTAMENTO = id(1);
const SUCURSAL = id(11);

const CICLO_ACTIVO = id(111);
const CICLO_CERRADO = id(112);
const CICLO_NUEVO = id(113);
const CICLO_VENCIDO = id(114);

const EV_FLUJO = id(121);
const EV_FALTANTES = id(122);
const EV_OTRO_CICLO = id(123);
const EV_AJENA = id(124);
const EV_VENCIDA_FECHA = id(125);
const EV_VENCIDA_CICLO = id(126);
const EV_CONCURRENCIA = id(127);
const EV_INEXISTENTE = id(999);

const ESCALA_LIKERT = "00000000-0000-4000-8000-000000000001";
const ESCALA_CUALITATIVA = "00000000-0000-4000-8000-000000000002";

// Pesos: 20 + 15 + 15 + 20 + 10 + 20 = 100. La pregunta 5 es opcional.
const PREGUNTAS = [
  { n: 1, seccion: 1, criterio: 1, orden: 1, peso: 20, obligatoria: true, escala: ESCALA_LIKERT, texto: "¿Saluda y atiende al cliente con cortesía?" },
  { n: 2, seccion: 1, criterio: 1, orden: 2, peso: 15, obligatoria: true, escala: ESCALA_LIKERT, texto: "¿Resuelve las dudas del cliente con claridad?" },
  { n: 3, seccion: 1, criterio: 2, orden: 1, peso: 15, obligatoria: true, escala: ESCALA_LIKERT, texto: "¿Gestiona los reclamos con calma?" },
  { n: 4, seccion: 2, criterio: 3, orden: 1, peso: 20, obligatoria: true, escala: ESCALA_LIKERT, texto: "¿Apoya a sus compañeros?" },
  { n: 5, seccion: 2, criterio: 3, orden: 2, peso: 10, obligatoria: false, escala: ESCALA_LIKERT, texto: "¿Comparte información útil con el equipo?" },
  { n: 6, seccion: 3, criterio: 4, orden: 1, peso: 20, obligatoria: true, escala: ESCALA_CUALITATIVA, texto: "¿Cumple su horario de trabajo?" },
];
const idPregunta = (n) => id(90 + n);

// Contadores de la ejecución
let totalPruebas = 0;
let aprobadas = 0;
let falladas = 0;
const resultados = [];

function registrarResultado(criterio, nombre, aprobo, detalles) {
  totalPruebas++;
  if (aprobo) {
    aprobadas++;
    console.log(`  ✅ [PASS] ${nombre}`);
  } else {
    falladas++;
    console.error(`  ❌ [FAIL] ${nombre}`);
    console.error(`     Detalles:`, detalles);
  }
  resultados.push({ criterio, nombre, aprobo, detalles });
}

async function llamarApi(ruta, { metodo = "GET", empleado, cuerpo, crudo } = {}) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    method: metodo,
    headers: {
      ...(empleado && { "X-Empleado-Id": empleado }),
      ...((cuerpo || crudo) && { "Content-Type": "application/json" }),
    },
    body: crudo ?? (cuerpo ? JSON.stringify(cuerpo) : undefined),
  });
  let body = null;
  try {
    body = await respuesta.json();
  } catch (e) {
    body = null;
  }
  return { status: respuesta.status, body };
}

const consultar = async (sql, valores) => (await pool.query(sql, valores)).rows;
const estadoDe = async (idEvaluacion) =>
  (await consultar("SELECT id_estado_evaluacion AS estado, puntaje_final, enviada_en FROM evaluaciones WHERE id_evaluacion = $1", [idEvaluacion]))[0];
const cantidadRespuestas = async (idEvaluacion) =>
  Number((await consultar("SELECT count(*) AS total FROM respuestas_evaluacion WHERE id_evaluacion = $1", [idEvaluacion]))[0].total);

// Puntaje recalculado de forma independiente, directo desde las respuestas guardadas (valor / máximo de la escala).
async function puntajeRecalculado(idEvaluacion) {
  const [fila] = await consultar(
    `WITH maximos AS (SELECT id_escala, max(valor) AS maximo FROM niveles_escala GROUP BY id_escala)
     SELECT round(sum(p.peso_porcentual * n.valor / m.maximo) / sum(p.peso_porcentual) * 100, 2) AS puntaje
     FROM respuestas_evaluacion r
     JOIN preguntas_evaluacion p ON p.id_pregunta = r.id_pregunta
     JOIN niveles_escala n ON n.id_nivel = r.id_nivel
     JOIN maximos m ON m.id_escala = p.id_escala
     WHERE r.id_evaluacion = $1`,
    [idEvaluacion],
  );
  return fila.puntaje === null ? null : Number(fila.puntaje);
}

/**
 * Limpieza no destructiva: solo borra lo creado por esta suite (identificadores «ac000000-…»).
 */
async function limpiarDatosDePrueba() {
  const borrados = [
    ["respuestas_evaluacion", "id_evaluacion"],
    ["evaluaciones", "id_evaluacion"],
    ["ciclos_evaluacion", "id_ciclo"],
    ["preguntas_evaluacion", "id_pregunta"],
    ["criterios_evaluacion", "id_criterio"],
    ["secciones_plantilla", "id_seccion"],
    ["versiones_plantilla", "id_version"],
    ["plantillas_evaluacion", "id_plantilla"],
    ["competencias", "id_competencia"],
    ["periodos_evaluacion", "id_periodo"],
    ["empleados", "id_empleado"],
    ["sucursales", "id_sucursal"],
    ["departamentos", "id_departamento"],
  ];
  for (const [tabla, columna] of borrados) {
    await pool.query(`DELETE FROM ${tabla} WHERE ${columna}::text LIKE $1`, [PATRON_ID]);
  }
}

/**
 * Crea la plantilla publicada, los ciclos y las evaluaciones que usan las pruebas, para que la suite sea autónoma.
 * Se apoya en los catálogos y en las escalas de partida de init.sql.
 */
async function prepararDatosDePrueba() {
  await pool.query(`INSERT INTO DEPARTAMENTOS (id_departamento, nombre) VALUES ($1, 'QA KAN-24 Departamento')`, [DEPARTAMENTO]);
  await pool.query(`INSERT INTO SUCURSALES (id_sucursal, nombre) VALUES ($1, 'QA KAN-24 Sucursal')`, [SUCURSAL]);

  const empleados = [
    [EVALUADOR, "Evaluadora", "QA Principal"],
    [OTRO_EVALUADOR, "Evaluador", "QA Ajeno"],
    [CREADOR, "Creadora", "QA Plantilla"],
    ...[31, 32, 33, 34, 35, 36, 37].map((n) => [id(n), `Colaborador ${n}`, "QA Evaluado"]),
  ];
  for (const [idEmpleado, nombres, apellidos] of empleados) {
    await pool.query(`INSERT INTO EMPLEADOS (id_empleado, nombres, apellidos) VALUES ($1, $2, $3)`, [idEmpleado, nombres, apellidos]);
  }

  const competencias = [
    [id(101), 1, "QA KAN-24 · Atención al cliente"],
    [id(102), 1, "QA KAN-24 · Trabajo en equipo"],
    [id(103), 2, "QA KAN-24 · Puntualidad y orden"],
  ];
  for (const [idCompetencia, tipo, nombre] of competencias) {
    await pool.query(`INSERT INTO COMPETENCIAS (id_competencia, id_tipo_competencia, nombre) VALUES ($1, $2, $3)`, [idCompetencia, tipo, nombre]);
  }

  await pool.query(`INSERT INTO PERIODOS_EVALUACION (id_periodo, nombre, fecha_inicio, fecha_fin) VALUES ($1, 'QA-KAN24', CURRENT_DATE - 60, CURRENT_DATE + 300)`, [id(41)]);
  await pool.query(
    `INSERT INTO PLANTILLAS_EVALUACION (id_plantilla, id_departamento_destino, id_empleado_creador, nombre, objetivo, vigencia_desde, vigencia_hasta)
     VALUES ($1, $2, $3, 'QA KAN-24 Plantilla', 'Plantilla de las pruebas de aceptación', CURRENT_DATE - 60, CURRENT_DATE + 300)`,
    [id(51), DEPARTAMENTO, CREADOR],
  );
  await pool.query(
    `INSERT INTO VERSIONES_PLANTILLA (id_version, id_plantilla, id_estado_version, id_empleado_publicador, numero_version, publicada_en)
     VALUES ($1, $2, 2, $3, 1, CURRENT_TIMESTAMP)`,
    [id(61), id(51), CREADOR],
  );
  for (const n of [1, 2, 3]) {
    await pool.query(`INSERT INTO SECCIONES_PLANTILLA (id_seccion, id_version, id_competencia, orden) VALUES ($1, $2, $3, $4)`, [id(70 + n), id(61), id(100 + n), n]);
  }
  const criterios = [
    [1, 1, "Trato al cliente", 1],
    [2, 1, "Resolución de reclamos", 2],
    [3, 2, "Colaboración", 1],
    [4, 3, "Cumplimiento de horario", 1],
  ];
  for (const [n, seccion, nombre, orden] of criterios) {
    await pool.query(`INSERT INTO CRITERIOS_EVALUACION (id_criterio, id_seccion, nombre, orden) VALUES ($1, $2, $3, $4)`, [id(80 + n), id(70 + seccion), nombre, orden]);
  }
  for (const p of PREGUNTAS) {
    await pool.query(
      `INSERT INTO PREGUNTAS_EVALUACION (id_pregunta, id_criterio, id_escala, texto, peso_porcentual, es_obligatoria, orden)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [idPregunta(p.n), id(80 + p.criterio), p.escala, p.texto, p.peso, p.obligatoria, p.orden],
    );
  }

  // Ciclos: dos activos con plazos distintos, uno activo con el plazo ya vencido y uno cerrado.
  const ciclos = [
    [CICLO_ACTIVO, 2, "QA Ciclo activo", "CURRENT_DATE - 10", "CURRENT_DATE + 20", "NULL"],
    [CICLO_NUEVO, 2, "QA Ciclo de personal nuevo", "CURRENT_DATE - 5", "CURRENT_DATE + 5", "NULL"],
    [CICLO_VENCIDO, 2, "QA Ciclo con plazo vencido", "CURRENT_DATE - 30", "CURRENT_DATE - 3", "NULL"],
    [CICLO_CERRADO, 3, "QA Ciclo cerrado", "CURRENT_DATE - 60", "CURRENT_DATE - 20", "CURRENT_TIMESTAMP - INTERVAL '10 days'"],
  ];
  for (const [idCiclo, estado, nombre, inicio, limite, cierre] of ciclos) {
    await pool.query(
      `INSERT INTO CICLOS_EVALUACION (id_ciclo, id_version, id_periodo, id_estado_ciclo, id_empleado_creador, nombre, fecha_inicio, fecha_limite, cerrado_en)
       VALUES ($1, $2, $3, $4, $5, $6, ${inicio}, ${limite}, ${cierre})`,
      [idCiclo, id(61), id(41), estado, CREADOR, nombre],
    );
  }

  const evaluaciones = [
    [EV_FLUJO, CICLO_ACTIVO, id(31), EVALUADOR],
    [EV_FALTANTES, CICLO_ACTIVO, id(32), EVALUADOR],
    [EV_OTRO_CICLO, CICLO_NUEVO, id(33), EVALUADOR],
    [EV_AJENA, CICLO_ACTIVO, id(34), OTRO_EVALUADOR],
    [EV_VENCIDA_FECHA, CICLO_VENCIDO, id(35), EVALUADOR],
    [EV_VENCIDA_CICLO, CICLO_CERRADO, id(36), EVALUADOR],
    [EV_CONCURRENCIA, CICLO_ACTIVO, id(37), EVALUADOR],
  ];
  for (const [idEvaluacion, idCiclo, evaluado, evaluador] of evaluaciones) {
    await pool.query(
      `INSERT INTO EVALUACIONES (id_evaluacion, id_ciclo, id_empleado_evaluado, id_empleado_evaluador, id_departamento, id_sucursal)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [idEvaluacion, idCiclo, evaluado, evaluador, DEPARTAMENTO, SUCURSAL],
    );
  }
}

async function ejecutarPruebas() {
  console.log("================================================================================");
  console.log("🧪 CRITERIOS DE ACEPTACIÓN Y FRONTERAS DE ERROR (KAN-24 / RF-04)");
  console.log("================================================================================\n");

  await limpiarDatosDePrueba();
  await prepararDatosDePrueba();

  // Niveles de cada escala tal como están en la base: nivel(n, valor) = id del nivel de la escala de la pregunta n.
  const niveles = await consultar("SELECT id_nivel, id_escala, valor FROM niveles_escala");
  const nivel = (n, valor) => {
    const escala = PREGUNTAS.find((p) => p.n === n).escala;
    return niveles.find((x) => x.id_escala === escala && Number(x.valor) === valor).id_nivel;
  };
  const respuesta = (n, valor) => ({ id_pregunta: idPregunta(n), id_nivel: valor === null ? null : nivel(n, valor) });
  const guardar = (idEvaluacion, lista, empleado = EVALUADOR) =>
    llamarApi(`/evaluaciones/${idEvaluacion}/respuestas`, { metodo: "PUT", empleado, cuerpo: { respuestas: lista.map(([n, v]) => respuesta(n, v)) } });
  const enviar = (idEvaluacion, empleado = EVALUADOR) => llamarApi(`/evaluaciones/${idEvaluacion}/envio`, { metodo: "POST", empleado });
  // Las 5 obligatorias: (20·100 + 15·80 + 15·60 + 20·80 + 20·100) / 90 = 85,56.
  const OBLIGATORIAS = [[1, 5], [2, 4], [3, 3], [4, 4], [6, 4]];

  // ============================================================================
  // CRITERIO 1: la bandeja muestra las evaluaciones con colaborador, ciclo y fecha límite
  // ============================================================================
  console.log("\n--- CRITERIO 1: Bandeja de evaluaciones del evaluador ---");

  const bandeja = await llamarApi("/evaluaciones", { empleado: EVALUADOR });
  const lista = bandeja.body ?? [];
  const idsBandeja = lista.map((e) => e.id_evaluacion);

  registrarResultado(
    "Criterio 1",
    "1.1 El evaluador ve sus 6 evaluaciones asignadas (HTTP 200) y ninguna ajena",
    bandeja.status === 200 &&
      lista.length === 6 &&
      [EV_FLUJO, EV_FALTANTES, EV_OTRO_CICLO, EV_VENCIDA_FECHA, EV_VENCIDA_CICLO, EV_CONCURRENCIA].every((e) => idsBandeja.includes(e)) &&
      !idsBandeja.includes(EV_AJENA),
    { status: bandeja.status, total: lista.length },
  );

  const flujo = lista.find((e) => e.id_evaluacion === EV_FLUJO);
  registrarResultado(
    "Criterio 1",
    "1.2 Cada evaluación trae colaborador, ciclo y fecha límite (AAAA-MM-DD) y su estado",
    Boolean(flujo?.colaborador?.nombre_completo) &&
      flujo.colaborador.nombre_completo === "Colaborador 31 QA Evaluado" &&
      flujo.ciclo?.nombre === "QA Ciclo activo" &&
      /^\d{4}-\d{2}-\d{2}$/.test(flujo.ciclo.fecha_limite) &&
      flujo.estado_codigo === "PENDIENTE",
    flujo,
  );

  const fechas = lista.map((e) => e.ciclo.fecha_limite);
  registrarResultado("Criterio 1", "1.3 Ordenadas por fecha límite (lo más urgente primero)", fechas.every((f, i) => i === 0 || fechas[i - 1] <= f), fechas);

  const porCiclo = await llamarApi(`/evaluaciones?id_ciclo=${CICLO_NUEVO}`, { empleado: EVALUADOR });
  registrarResultado(
    "Criterio 1",
    "1.4 El filtro por ciclo deja solo las evaluaciones de ese ciclo",
    porCiclo.status === 200 && porCiclo.body.length === 1 && porCiclo.body[0].id_evaluacion === EV_OTRO_CICLO,
    porCiclo,
  );

  const pendientes = await llamarApi("/evaluaciones?estado=PENDIENTE,BORRADOR", { empleado: EVALUADOR });
  registrarResultado(
    "Criterio 1",
    "1.5 El filtro por estado muestra las pendientes y los borradores",
    pendientes.status === 200 && pendientes.body.length === 4 && pendientes.body.every((e) => ["PENDIENTE", "BORRADOR"].includes(e.estado_codigo)),
    pendientes.body?.map((e) => e.estado_codigo),
  );

  const vencidas = await llamarApi("/evaluaciones?estado=VENCIDA", { empleado: EVALUADOR });
  const guardadaFecha = await estadoDe(EV_VENCIDA_FECHA);
  registrarResultado(
    "Criterio 1",
    "1.6 Pasada la fecha límite o cerrado el ciclo, la bandeja las muestra como vencidas aunque nadie las haya marcado",
    vencidas.body?.length === 2 &&
      [EV_VENCIDA_FECHA, EV_VENCIDA_CICLO].every((e) => vencidas.body.some((v) => v.id_evaluacion === e)) &&
      guardadaFecha.estado === 1,
    { vencidas: vencidas.body?.map((v) => v.id_evaluacion), estadoGuardado: guardadaFecha.estado },
  );

  const ciclos = await llamarApi("/evaluaciones/ciclos", { empleado: EVALUADOR });
  registrarResultado(
    "Criterio 1",
    "1.7 La lista de ciclos para el filtro trae los 4 ciclos del evaluador",
    ciclos.status === 200 && ciclos.body.length === 4,
    ciclos.body?.map((c) => c.nombre),
  );

  const ajena = await llamarApi("/evaluaciones", { empleado: OTRO_EVALUADOR });
  registrarResultado(
    "Criterio 1",
    "1.8 Otro evaluador solo ve la evaluación que le asignaron",
    ajena.status === 200 && ajena.body.length === 1 && ajena.body[0].id_evaluacion === EV_AJENA,
    ajena.body,
  );

  const sinNada = await llamarApi("/evaluaciones", { empleado: id(998) });
  registrarResultado("Criterio 1", "1.9 Un empleado sin evaluaciones recibe una lista vacía", sinNada.status === 200 && sinNada.body.length === 0, sinNada);

  const sinCabecera = await llamarApi("/evaluaciones");
  const cabeceraMala = await llamarApi("/evaluaciones", { empleado: "no-es-uuid" });
  const filtroMalo = await llamarApi("/evaluaciones?estado=INVENTADO", { empleado: EVALUADOR });
  registrarResultado(
    "Criterio 1 (Manejo de errores)",
    "1.10 Sin X-Empleado-Id responde 401, con uno inválido 403 y con un filtro inválido 400",
    sinCabecera.status === 401 && cabeceraMala.status === 403 && filtroMalo.status === 400,
    [sinCabecera.status, cabeceraMala.status, filtroMalo.status],
  );

  // ============================================================================
  // CRITERIO 2: guardar puntajes por criterio como borrador, sin enviar
  // ============================================================================
  console.log("\n--- CRITERIO 2: Guardado parcial como borrador ---");

  const formulario = await llamarApi(`/evaluaciones/${EV_FLUJO}`, { empleado: EVALUADOR });
  const preguntasForm = formulario.body?.secciones?.flatMap((s) => s.criterios.flatMap((c) => c.preguntas)) ?? [];
  registrarResultado(
    "Criterio 2",
    "2.1 El formulario se arma desde la plantilla: 3 secciones, 6 preguntas sin respuesta, editable",
    formulario.status === 200 &&
      formulario.body.secciones.length === 3 &&
      preguntasForm.length === 6 &&
      preguntasForm.every((p) => p.respuesta === null) &&
      formulario.body.editable === true &&
      formulario.body.escalas.length === 2,
    { status: formulario.status, preguntas: preguntasForm.length },
  );

  const parcial = await guardar(EV_FLUJO, [[1, 5], [2, 4]]);
  const traspaso = await estadoDe(EV_FLUJO);
  registrarResultado(
    "Criterio 2",
    "2.2 Guardar 2 respuestas deja la evaluación en BORRADOR, sin enviar y sin puntaje final",
    parcial.status === 200 &&
      parcial.body.estado_codigo === "BORRADOR" &&
      parcial.body.progreso.respondidas === 2 &&
      traspaso.estado === 2 &&
      traspaso.enviada_en === null &&
      traspaso.puntaje_final === null &&
      (await cantidadRespuestas(EV_FLUJO)) === 2,
    { respuesta: parcial.body, bd: traspaso },
  );

  await guardar(EV_FLUJO, [[1, 3]]);
  const [cambiada] = await consultar(
    `SELECT n.valor FROM respuestas_evaluacion r JOIN niveles_escala n ON n.id_nivel = r.id_nivel WHERE r.id_evaluacion = $1 AND r.id_pregunta = $2`,
    [EV_FLUJO, idPregunta(1)],
  );
  registrarResultado(
    "Criterio 2",
    "2.3 Cambiar una respuesta la reemplaza: no duplica filas y no toca las demás",
    Number(cambiada?.valor) === 3 && (await cantidadRespuestas(EV_FLUJO)) === 2,
    { valor: cambiada?.valor },
  );

  const releido = await llamarApi(`/evaluaciones/${EV_FLUJO}`, { empleado: EVALUADOR });
  const p1 = releido.body?.secciones?.[0]?.criterios?.[0]?.preguntas?.[0];
  registrarResultado(
    "Criterio 2",
    "2.4 Al volver a abrir el formulario aparecen las respuestas guardadas",
    p1?.respuesta?.valor === 3 && releido.body?.progreso?.respondidas === 2 && releido.body?.estado_codigo === "BORRADOR",
    p1?.respuesta,
  );

  const borrar = await guardar(EV_FLUJO, [[2, null]]);
  registrarResultado(
    "Criterio 2",
    "2.5 Con id_nivel null se borra la respuesta (queda 1 en BD y la evaluación sigue en borrador)",
    borrar.status === 200 && (await cantidadRespuestas(EV_FLUJO)) === 1 && borrar.body.estado_codigo === "BORRADOR",
    borrar.body,
  );

  const todoBorrado = await guardar(EV_FLUJO, [[1, null]]);
  registrarResultado(
    "Criterio 2",
    "2.6 Si se borra la última respuesta la evaluación vuelve a PENDIENTE",
    todoBorrado.body?.estado_codigo === "PENDIENTE" && (await estadoDe(EV_FLUJO)).estado === 1,
    todoBorrado.body,
  );

  console.log("\n--- CRITERIO 2 (Validaciones): lo inválido se rechaza y no guarda nada ---");
  const otraEscala = await llamarApi(`/evaluaciones/${EV_FLUJO}/respuestas`, {
    metodo: "PUT",
    empleado: EVALUADOR,
    cuerpo: { respuestas: [{ id_pregunta: idPregunta(1), id_nivel: nivel(6, 2) }] },
  });
  const preguntaAjena = await llamarApi(`/evaluaciones/${EV_FLUJO}/respuestas`, {
    metodo: "PUT",
    empleado: EVALUADOR,
    cuerpo: { respuestas: [{ id_pregunta: id(555), id_nivel: nivel(1, 3) }] },
  });
  const vacio = await llamarApi(`/evaluaciones/${EV_FLUJO}/respuestas`, { metodo: "PUT", empleado: EVALUADOR, cuerpo: { respuestas: [] } });
  const repetida = await guardar(EV_FLUJO, [[1, 3], [1, 4]]);
  const jsonRoto = await llamarApi(`/evaluaciones/${EV_FLUJO}/respuestas`, { metodo: "PUT", empleado: EVALUADOR, crudo: "{no es json" });
  registrarResultado(
    "Criterio 2 (Validaciones)",
    "2.7 Nivel de otra escala, pregunta de otra plantilla, lista vacía, pregunta repetida y JSON roto responden 400",
    [otraEscala, preguntaAjena, vacio, repetida, jsonRoto].every((r) => r.status === 400),
    [otraEscala.status, preguntaAjena.status, vacio.status, repetida.status, jsonRoto.status],
  );
  registrarResultado(
    "Criterio 2 (Validaciones)",
    "2.8 Los rechazos no dejaron ninguna respuesta guardada",
    (await cantidadRespuestas(EV_FLUJO)) === 0,
    await cantidadRespuestas(EV_FLUJO),
  );

  // ============================================================================
  // CRITERIO 4: faltan obligatorias → se resaltan y se impide el envío
  // ============================================================================
  console.log("\n--- CRITERIO 4: Faltan criterios obligatorios por responder ---");

  await guardar(EV_FALTANTES, [[1, 5], [2, 4]]);
  const incompleto = await enviar(EV_FALTANTES);
  const detalles = incompleto.body?.detalles ?? [];
  const estadoIncompleto = await estadoDe(EV_FALTANTES);
  registrarResultado(
    "Criterio 4",
    "4.1 Con obligatorias sin responder el envío se impide (HTTP 422) y se indican las 3 pendientes",
    incompleto.status === 422 &&
      detalles.length === 3 &&
      [3, 4, 6].every((n) => detalles.some((d) => d.id_pregunta === idPregunta(n))),
    incompleto,
  );
  registrarResultado(
    "Criterio 4",
    "4.2 Cada pendiente trae su campo (id de la pregunta) y un mensaje para resaltarla; la opcional no aparece",
    detalles.every((d) => d.campo === d.id_pregunta && typeof d.mensaje === "string" && d.mensaje.length > 0) &&
      !detalles.some((d) => d.id_pregunta === idPregunta(5)),
    detalles,
  );
  registrarResultado(
    "Criterio 4",
    "4.3 El envío rechazado no cambió nada: sigue en BORRADOR, sin puntaje y con sus 2 respuestas",
    estadoIncompleto.estado === 2 && estadoIncompleto.puntaje_final === null && estadoIncompleto.enviada_en === null && (await cantidadRespuestas(EV_FALTANTES)) === 2,
    estadoIncompleto,
  );

  const sinNingunaRespuesta = await enviar(EV_OTRO_CICLO);
  registrarResultado(
    "Criterio 4",
    "4.4 Una evaluación sin ninguna respuesta señala las 5 obligatorias (no la opcional)",
    sinNingunaRespuesta.status === 422 && sinNingunaRespuesta.body?.detalles?.length === 5,
    sinNingunaRespuesta.body?.detalles?.length,
  );

  // ============================================================================
  // CRITERIO 3: enviar calcula el puntaje ponderado y bloquea la edición
  // ============================================================================
  console.log("\n--- CRITERIO 3: Envío, puntaje ponderado y bloqueo ---");

  await guardar(EV_FLUJO, OBLIGATORIAS);
  const envio = await enviar(EV_FLUJO);
  const enviada = await estadoDe(EV_FLUJO);
  registrarResultado(
    "Criterio 3",
    "3.1 Con las 5 obligatorias respondidas se envía (HTTP 200) con puntaje ponderado 85,56",
    envio.status === 200 && envio.body.estado_codigo === "ENVIADA" && envio.body.puntaje_final === 85.56 && Boolean(envio.body.enviada_en),
    envio,
  );
  registrarResultado(
    "Criterio 3",
    "3.2 El puntaje queda congelado en la BD junto con la fecha de envío",
    enviada.estado === 3 && Number(enviada.puntaje_final) === 85.56 && enviada.enviada_en !== null,
    enviada,
  );
  registrarResultado(
    "Criterio 3",
    "3.3 El puntaje coincide con un recálculo independiente hecho en SQL (valor / máximo × peso)",
    (await puntajeRecalculado(EV_FLUJO)) === 85.56,
    await puntajeRecalculado(EV_FLUJO),
  );
  const atencion = envio.body?.resultado?.secciones?.[0];
  registrarResultado(
    "Criterio 3",
    "3.4 El resultado trae el desglose por competencia (Atención al cliente: peso 50, puntaje 82)",
    envio.body?.resultado?.secciones?.length === 3 && atencion?.peso_porcentual === 50 && atencion?.puntaje === 82,
    envio.body?.resultado,
  );

  const edicion = await guardar(EV_FLUJO, [[1, 1]]);
  const borrado = await guardar(EV_FLUJO, [[1, null]]);
  const reenvio = await enviar(EV_FLUJO);
  const despues = await estadoDe(EV_FLUJO);
  registrarResultado(
    "Criterio 3 (Bloqueo)",
    "3.5 Tras el envío no se puede editar, borrar ni reenviar (HTTP 409)",
    [edicion, borrado, reenvio].every((r) => r.status === 409),
    [edicion.status, borrado.status, reenvio.status],
  );
  registrarResultado(
    "Criterio 3 (Bloqueo)",
    "3.6 Los intentos bloqueados no cambiaron las respuestas ni el puntaje congelado",
    (await cantidadRespuestas(EV_FLUJO)) === 5 && Number(despues.puntaje_final) === 85.56,
    despues,
  );
  const lectura = await llamarApi(`/evaluaciones/${EV_FLUJO}`, { empleado: EVALUADOR });
  registrarResultado(
    "Criterio 3 (Bloqueo)",
    "3.7 El formulario enviado se abre de solo lectura con su resultado",
    lectura.body?.editable === false && lectura.body.estado_codigo === "ENVIADA" && lectura.body.resultado?.puntaje_final === 85.56,
    lectura.body?.resultado,
  );

  await guardar(EV_FALTANTES, [[3, 3], [4, 4], [5, 5], [6, 4]]);
  const conOpcional = await enviar(EV_FALTANTES);
  registrarResultado(
    "Criterio 3",
    "3.8 La pregunta opcional respondida entra en el cálculo (87); sin ella no penalizaba (85,56)",
    conOpcional.status === 200 && conOpcional.body.puntaje_final === 87 && (await puntajeRecalculado(EV_FALTANTES)) === 87,
    conOpcional.body,
  );

  // ============================================================================
  // REGRESIÓN: permisos, existencia, vencimiento, concurrencia y contrato de la API
  // ============================================================================
  console.log("\n--- REGRESIÓN Y FRONTERAS ---");

  const ajenaLeer = await llamarApi(`/evaluaciones/${EV_AJENA}`, { empleado: EVALUADOR });
  const ajenaGuardar = await guardar(EV_AJENA, [[1, 5]]);
  const ajenaEnviar = await enviar(EV_AJENA);
  registrarResultado(
    "Regresión (Permisos)",
    "5.1 La evaluación de otro evaluador no se puede abrir, responder ni enviar (HTTP 403)",
    [ajenaLeer, ajenaGuardar, ajenaEnviar].every((r) => r.status === 403) && (await cantidadRespuestas(EV_AJENA)) === 0,
    [ajenaLeer.status, ajenaGuardar.status, ajenaEnviar.status],
  );

  const noExiste = await llamarApi(`/evaluaciones/${EV_INEXISTENTE}`, { empleado: EVALUADOR });
  const idMalo = await llamarApi("/evaluaciones/abc", { empleado: EVALUADOR });
  registrarResultado("Regresión (Permisos)", "5.2 Una evaluación inexistente o con id mal formado responde 404", noExiste.status === 404 && idMalo.status === 404, [noExiste.status, idMalo.status]);

  const vencidaFecha = await guardar(EV_VENCIDA_FECHA, [[1, 5]]);
  const vencidaEnvio = await enviar(EV_VENCIDA_FECHA);
  const marcada = await estadoDe(EV_VENCIDA_FECHA);
  registrarResultado(
    "Regresión (Vencimiento)",
    "5.3 Pasada la fecha límite no se guarda ni se envía (HTTP 409) y la evaluación queda marcada como VENCIDA",
    vencidaFecha.status === 409 && /venció/.test(vencidaFecha.body.error) && vencidaEnvio.status === 409 && marcada.estado === 4 && (await cantidadRespuestas(EV_VENCIDA_FECHA)) === 0,
    { guardar: vencidaFecha.body, estadoBD: marcada.estado },
  );

  const vencidaCiclo = await guardar(EV_VENCIDA_CICLO, [[1, 5]]);
  registrarResultado(
    "Regresión (Vencimiento)",
    "5.4 Con el ciclo cerrado la evaluación abierta tampoco se puede responder (HTTP 409, ciclo cerrado)",
    vencidaCiclo.status === 409 && /cerrado/.test(vencidaCiclo.body.error) && (await estadoDe(EV_VENCIDA_CICLO)).estado === 4,
    vencidaCiclo.body,
  );

  const formularioVencido = await llamarApi(`/evaluaciones/${EV_VENCIDA_FECHA}`, { empleado: EVALUADOR });
  registrarResultado(
    "Regresión (Vencimiento)",
    "5.5 Una evaluación vencida se abre de solo lectura (editable: false)",
    formularioVencido.status === 200 && formularioVencido.body.editable === false && formularioVencido.body.estado_codigo === "VENCIDA",
    formularioVencido.body?.estado_codigo,
  );

  // Concurrencia: 25 autoguardados en paralelo con el envío; ninguno puede colarse después del envío.
  await guardar(EV_CONCURRENCIA, OBLIGATORIAS);
  const guardados = Array.from({ length: 25 }, (_, i) => guardar(EV_CONCURRENCIA, [[1, (i % 5) + 1]]));
  const [envioConcurrente, ...respuestasGuardado] = await Promise.all([enviar(EV_CONCURRENCIA), ...guardados]);
  const finalConcurrente = await estadoDe(EV_CONCURRENCIA);
  registrarResultado(
    "Regresión (Concurrencia)",
    "5.6 25 autoguardados simultáneos con el envío: el envío termina bien y cada autoguardado es 200 (antes) o 409 (después)",
    envioConcurrente.status === 200 && respuestasGuardado.every((r) => r.status === 200 || r.status === 409),
    { envio: envioConcurrente.status, guardados: respuestasGuardado.map((r) => r.status).join(",") },
  );
  registrarResultado(
    "Regresión (Concurrencia)",
    "5.7 El puntaje congelado coincide con las respuestas finales: nada se guardó después del envío",
    Number(finalConcurrente.puntaje_final) === (await puntajeRecalculado(EV_CONCURRENCIA)) && Number(finalConcurrente.puntaje_final) === envioConcurrente.body?.puntaje_final,
    { congelado: finalConcurrente.puntaje_final, recalculado: await puntajeRecalculado(EV_CONCURRENCIA) },
  );

  registrarResultado(
    "Regresión (Contrato de la API)",
    "5.8 Los errores traen «error» y, en 400 y 422, la lista «detalles»",
    typeof ajenaLeer.body?.error === "string" && typeof noExiste.body?.error === "string" && Array.isArray(vacio.body?.detalles) && Array.isArray(incompleto.body?.detalles),
    { ajena: ajenaLeer.body, vacio: vacio.body },
  );

  // ============================================================================
  // RESUMEN
  // ============================================================================
  console.log("\n================================================================================");
  console.log("📊 RESUMEN DE LA EJECUCIÓN");
  console.log("================================================================================");
  console.log(`Pruebas ejecutadas: ${totalPruebas}`);
  console.log(`Aprobadas:          ${aprobadas} (${Math.round((aprobadas / totalPruebas) * 100)}%)`);
  console.log(`Falladas:           ${falladas}`);
  console.log("================================================================================\n");

  try {
    await limpiarDatosDePrueba();
    console.log("🧹 Datos de prueba eliminados (solo los de esta suite).");
  } catch (errorLimpieza) {
    console.warn("Aviso al limpiar:", errorLimpieza.message);
  }

  await pool.end();

  if (falladas > 0) {
    process.exit(1);
  }
}

ejecutarPruebas().catch(async (err) => {
  console.error("Error fatal durante la ejecución:", err);
  try {
    await limpiarDatosDePrueba();
  } catch (errorLimpieza) {
    console.warn("Aviso al limpiar:", errorLimpieza.message);
  }
  await pool.end();
  process.exit(1);
});

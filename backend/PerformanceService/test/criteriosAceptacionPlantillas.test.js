/**
 * Suite automatizada: KAN-9 (RF-01) Diseño de plantillas de evaluación, criterios de aceptación.
 *
 * Prueba la API real y la base de datos real (no usa simulaciones de ellas). Cubre los 4 criterios y las fronteras de error:
 *  - Criterio 1: crear una plantilla con nombre, área, objetivo y vigencia la guarda en borrador
 *  - Criterio 2: las secciones de competencias y factores operativos se validan antes de publicar
 *  - Criterio 3: al publicar queda disponible y se bloquea la modificación de su estructura base
 *  - Criterio 4: una plantilla con el mismo nombre, área y periodo se rechaza con una alerta de duplicidad
 *
 * El servicio consulta a EmployeeService (áreas y empleados). Para no depender de otro microservicio, esta suite levanta
 * su propia instancia de PerformanceService (otro puerto, misma base de datos) y le pone delante un EmployeeService
 * mínimo que responde solo lo que se necesita. Solo ese servicio es simulado.
 *
 * Requiere PerformanceDB con su esquema (db/init.sql). Crea sus propios datos de prueba (identificadores «ac000000-…»
 * y nombres que empiezan con «QA KAN-9») y al terminar borra solo esos: no toca ningún dato real. Con el sistema en Docker:
 *   docker compose exec performance-service node test/criteriosAceptacionPlantillas.test.js
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const http = require("http");
const net = require("net");
const { spawn } = require("child_process");
const { Pool } = require("pg");

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : undefined,
);

const id = (n) => `ac000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PATRON_ID = "ac000000-%";
const PREFIJO = "QA KAN-9";

const AREA_A = id(1);
const AREA_B = id(2);
const AREA_INEXISTENTE = id(9);
const CREADOR = id(21);
const PUBLICADOR = id(22);
const DESCONOCIDO = id(29);
const INEXISTENTE = id(999);

const ESCALA_LIKERT = "00000000-0000-4000-8000-000000000001";

// Contadores de la ejecución
let totalPruebas = 0;
let aprobadas = 0;
let falladas = 0;
const resultados = [];

function registrarResultado(criterio, nombre, aprobo, detalles) {
  totalPruebas++;
  if (aprobo) {
    aprobadas++;
    console.log(`  [PASS] ${nombre}`);
  } else {
    falladas++;
    console.error(`  [FAIL] ${nombre}`);
    console.error(`     Detalles:`, detalles);
  }
  resultados.push({ criterio, nombre, aprobo, detalles });
}

const consultar = async (sql, valores) => (await pool.query(sql, valores)).rows;

const PERSONAS = {
  [CREADOR]: {
    id_empleado: CREADOR,
    nombres: "Creadora",
    apellidos: "QA Plantilla",
  },
  [PUBLICADOR]: {
    id_empleado: PUBLICADOR,
    nombres: "Publicador",
    apellidos: "QA Plantilla",
  },
};

function levantarEmpleadosFalso() {
  const servidor = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/departamentos") {
      res.end(
        JSON.stringify([
          { id_departamento: AREA_A, nombre: `${PREFIJO} Área A` },
          { id_departamento: AREA_B, nombre: `${PREFIJO} Área B` },
        ]),
      );
      return;
    }
    const persona = PERSONAS[req.url.split("/empleados/")[1]];
    if (req.url.startsWith("/empleados/") && persona) {
      res.end(JSON.stringify(persona));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "No encontrado" }));
  });
  return new Promise((resolver) =>
    servidor.listen(0, "127.0.0.1", () => resolver(servidor)),
  );
}

const puertoLibre = () =>
  new Promise((resolver) => {
    const servidor = net.createServer();
    servidor.listen(0, "127.0.0.1", () => {
      const { port } = servidor.address();
      servidor.close(() => resolver(port));
    });
  });

async function levantarServicio(urlEmpleados) {
  const puerto = await puertoLibre();
  const proceso = spawn(process.execPath, ["index.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(puerto),
      EMPLOYEE_SERVICE_URL: urlEmpleados,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let salida = "";
  proceso.stderr.on("data", (trozo) => (salida += trozo));
  const base = `http://127.0.0.1:${puerto}`;

  for (let intento = 0; intento < 60; intento++) {
    try {
      const respuesta = await fetch(`${base}/health`);
      if (respuesta.ok && (await respuesta.json()).db_connected)
        return { base, detener: () => proceso.kill() };
    } catch {
      // Todavía arrancando.
    }
    if (proceso.exitCode !== null) break;
    await new Promise((resolver) => setTimeout(resolver, 250));
  }
  proceso.kill();
  throw new Error(`El servicio de prueba no arrancó. ${salida.slice(-500)}`);
}

let API_BASE;

async function llamarApi(
  ruta,
  { metodo = "GET", empleado, cuerpo, crudo, base = API_BASE } = {},
) {
  const respuesta = await fetch(`${base}${ruta}`, {
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

const datos = (cambios = {}) => ({
  nombre: `${PREFIJO} Plantilla`,
  id_departamento: AREA_A,
  objetivo: "Medir la atención al cliente y la puntualidad.",
  vigencia_desde: "2090-01-01",
  vigencia_hasta: "2090-12-31",
  ...cambios,
});

const crearPlantilla = (cambios, empleado = CREADOR) =>
  llamarApi("/plantillas", {
    metodo: "POST",
    empleado,
    cuerpo: datos(cambios),
  });
const editarPlantilla = (idPlantilla, cambios, empleado = CREADOR) =>
  llamarApi(`/plantillas/${idPlantilla}`, {
    metodo: "PUT",
    empleado,
    cuerpo: datos(cambios),
  });
const rutaVersion = (idPlantilla, idVersion) =>
  `/plantillas/${idPlantilla}/versiones/${idVersion}`;
const guardarSecciones = (
  idPlantilla,
  idVersion,
  competencias,
  empleado = CREADOR,
) =>
  llamarApi(`${rutaVersion(idPlantilla, idVersion)}/secciones`, {
    metodo: "PUT",
    empleado,
    cuerpo: { secciones: competencias.map((c) => ({ id_competencia: c })) },
  });
const publicar = (idPlantilla, idVersion, empleado = PUBLICADOR) =>
  llamarApi(`${rutaVersion(idPlantilla, idVersion)}/publicacion`, {
    metodo: "POST",
    empleado,
  });

const totalPlantillas = async (nombre) =>
  Number(
    (
      await consultar(
        "SELECT count(*) AS total FROM plantillas_evaluacion WHERE lower(btrim(nombre)) = lower(btrim($1))",
        [nombre],
      )
    )[0].total,
  );
const versionesDe = (idPlantilla) =>
  consultar(
    "SELECT id_version, numero_version, id_estado_version, publicada_en, id_empleado_publicador FROM versiones_plantilla WHERE id_plantilla = $1 ORDER BY numero_version",
    [idPlantilla],
  );
const seccionesDe = async (idVersion) =>
  (
    await consultar(
      "SELECT id_competencia, orden FROM secciones_plantilla WHERE id_version = $1 ORDER BY orden",
      [idVersion],
    )
  ).map((s) => `${s.orden}:${s.id_competencia}`);
const cabeceraDe = async (idPlantilla) =>
  (
    await consultar(
      "SELECT nombre, objetivo, vigencia_desde::text AS vigencia_desde, vigencia_hasta::text AS vigencia_hasta FROM plantillas_evaluacion WHERE id_plantilla = $1",
      [idPlantilla],
    )
  )[0];
const existe = async (idPlantilla) =>
  (
    await consultar(
      "SELECT 1 FROM plantillas_evaluacion WHERE id_plantilla = $1",
      [idPlantilla],
    )
  ).length === 1;
const lista = (...ids) =>
  ids.map((idCompetencia, i) => `${i + 1}:${idCompetencia}`);

async function limpiarDatosDePrueba() {
  const plantillas = (
    await consultar(
      "SELECT id_plantilla FROM plantillas_evaluacion WHERE id_departamento_destino::text LIKE $1 OR id_empleado_creador::text LIKE $1",
      [PATRON_ID],
    )
  ).map((p) => p.id_plantilla);
  const porVersion = `id_version IN (SELECT id_version FROM versiones_plantilla WHERE id_plantilla = ANY($1::uuid[]))`;
  const porSeccion = `id_seccion IN (SELECT id_seccion FROM secciones_plantilla WHERE ${porVersion})`;
  await pool.query(
    `DELETE FROM preguntas_evaluacion WHERE id_criterio IN (SELECT id_criterio FROM criterios_evaluacion WHERE ${porSeccion})`,
    [plantillas],
  );
  await pool.query(`DELETE FROM criterios_evaluacion WHERE ${porSeccion}`, [
    plantillas,
  ]);
  await pool.query(`DELETE FROM secciones_plantilla WHERE ${porVersion}`, [
    plantillas,
  ]);
  await pool.query(
    `DELETE FROM versiones_plantilla WHERE id_plantilla = ANY($1::uuid[])`,
    [plantillas],
  );
  await pool.query(
    `DELETE FROM plantillas_evaluacion WHERE id_plantilla = ANY($1::uuid[])`,
    [plantillas],
  );
  await pool.query(`DELETE FROM competencias WHERE nombre LIKE $1`, [
    `${PREFIJO} %`,
  ]);
  await pool.query(`DELETE FROM empleados WHERE id_empleado::text LIKE $1`, [
    PATRON_ID,
  ]);
  await pool.query(
    `DELETE FROM departamentos WHERE id_departamento::text LIKE $1`,
    [PATRON_ID],
  );
}

async function ejecutarPruebas() {
  console.log(" CRITERIOS DE ACEPTACIÓN Y FRONTERAS DE ERROR ");

  await limpiarDatosDePrueba();

  const empleadosFalso = await levantarEmpleadosFalso();
  const urlEmpleados = `http://127.0.0.1:${empleadosFalso.address().port}`;
  const servicio = await levantarServicio(urlEmpleados);
  const servicioSinEmpleados = await levantarServicio("http://127.0.0.1:1");
  API_BASE = servicio.base;

  try {
    await probar();
  } finally {
    servicio.detener();
    servicioSinEmpleados.detener();
    empleadosFalso.close();
  }

  async function probar() {
    // Catálogo de partida: dos competencias laborales y un factor operativo, creados por la API.
    const nuevaCompetencia = async (nombre, tipo) =>
      (
        await llamarApi("/competencias", {
          metodo: "POST",
          empleado: CREADOR,
          cuerpo: { nombre: `${PREFIJO} ${nombre}`, tipo },
        })
      ).body;
    const atencion = await nuevaCompetencia(
      "Atención al cliente",
      "COMPETENCIA_LABORAL",
    );
    const equipo = await nuevaCompetencia(
      "Trabajo en equipo",
      "COMPETENCIA_LABORAL",
    );
    const metas = await nuevaCompetencia(
      "Cumplimiento de metas",
      "FACTOR_OPERATIVO",
    );
    const [A, B, M] = [
      atencion.id_competencia,
      equipo.id_competencia,
      metas.id_competencia,
    ];

    console.log("\n--- CRITERIO 1: Creación de la plantilla en borrador ---");

    const nombre1 = `${PREFIJO} Creación`;
    const creada = await crearPlantilla({ nombre: nombre1 });
    registrarResultado(
      "Criterio 1",
      "1.1 Crear con nombre, área, objetivo y vigencia responde 201 y la deja en borrador, versión 1",
      creada.status === 201 &&
        creada.body.estado_codigo === "BORRADOR" &&
        creada.body.version_actual.numero_version === 1 &&
        creada.body.area.id_departamento === AREA_A,
      creada.body,
    );
    const idCreada = creada.body?.id_plantilla;
    const versionesCreada = await versionesDe(idCreada);
    registrarResultado(
      "Criterio 1",
      "1.2 En la base hay una sola versión, en estado borrador y sin fecha ni responsable de publicación",
      versionesCreada.length === 1 &&
        versionesCreada[0].id_estado_version === 1 &&
        versionesCreada[0].publicada_en === null &&
        versionesCreada[0].id_empleado_publicador === null,
      versionesCreada,
    );
    const cabecera = await cabeceraDe(idCreada);
    registrarResultado(
      "Criterio 1",
      "1.3 La cabecera guarda el nombre, el objetivo y la vigencia indicados",
      cabecera.nombre === nombre1 &&
        cabecera.objetivo === datos().objetivo &&
        cabecera.vigencia_desde === "2090-01-01" &&
        cabecera.vigencia_hasta === "2090-12-31",
      cabecera,
    );
    const replicas = await consultar(
      "SELECT (SELECT count(*) FROM departamentos WHERE id_departamento = $1) AS area, (SELECT count(*) FROM empleados WHERE id_empleado = $2) AS creador",
      [AREA_A, CREADOR],
    );
    registrarResultado(
      "Criterio 1",
      "1.4 El área y quien registra quedan copiados en la réplica local desde EmployeeService",
      Number(replicas[0].area) === 1 && Number(replicas[0].creador) === 1,
      replicas[0],
    );

    const espacios = await crearPlantilla({
      nombre: `  ${PREFIJO}   Espacios   de   más  `,
    });
    registrarResultado(
      "Criterio 1",
      "1.5 El nombre se guarda sin espacios sobrantes",
      espacios.status === 201 &&
        espacios.body.nombre === `${PREFIJO} Espacios de más`,
      espacios.body?.nombre,
    );

    const antes = Number(
      (
        await consultar(
          "SELECT count(*) AS total FROM plantillas_evaluacion WHERE id_departamento_destino::text LIKE $1",
          [PATRON_ID],
        )
      )[0].total,
    );
    const vacia = await llamarApi("/plantillas", {
      metodo: "POST",
      empleado: CREADOR,
      cuerpo: { nombre: "  " },
    });
    registrarResultado(
      "Criterio 1",
      "1.6 Sin los datos obligatorios responde 400 con un detalle por campo y no guarda nada",
      vacia.status === 400 &&
        [
          "nombre",
          "objetivo",
          "id_departamento",
          "vigencia_desde",
          "vigencia_hasta",
        ].every((c) => vacia.body.detalles.some((d) => d.campo === c)),
      vacia.body,
    );
    const alReves = await crearPlantilla({
      nombre: `${PREFIJO} Fechas`,
      vigencia_desde: "2090-06-01",
      vigencia_hasta: "2090-05-31",
    });
    const imposible = await crearPlantilla({
      nombre: `${PREFIJO} Fecha imposible`,
      vigencia_desde: "2090-02-30",
    });
    registrarResultado(
      "Criterio 1",
      "1.7 Una vigencia que termina antes de empezar, o con una fecha que no existe, responde 400",
      alReves.status === 400 &&
        alReves.body.detalles[0].campo === "vigencia_hasta" &&
        imposible.status === 400 &&
        imposible.body.detalles[0].campo === "vigencia_desde",
      { alReves: alReves.body, imposible: imposible.body },
    );
    const sinArea = await crearPlantilla({
      nombre: `${PREFIJO} Sin área`,
      id_departamento: AREA_INEXISTENTE,
    });
    registrarResultado(
      "Criterio 1",
      "1.8 Un área que no existe en EmployeeService responde 422",
      sinArea.status === 422 &&
        sinArea.body.detalles[0].campo === "id_departamento",
      sinArea.body,
    );
    const sinPersona = await crearPlantilla(
      { nombre: `${PREFIJO} Sin persona` },
      DESCONOCIDO,
    );
    registrarResultado(
      "Criterio 1",
      "1.9 Quien registra debe ser un empleado conocido: responde 403",
      sinPersona.status === 403,
      sinPersona.body,
    );
    const despues = Number(
      (
        await consultar(
          "SELECT count(*) AS total FROM plantillas_evaluacion WHERE id_departamento_destino::text LIKE $1",
          [PATRON_ID],
        )
      )[0].total,
    );
    registrarResultado(
      "Criterio 1",
      "1.10 Ninguna de las solicitudes rechazadas dejó una plantilla guardada a medias",
      despues === antes,
      { antes, despues },
    );

    const listado = await llamarApi("/plantillas", { empleado: CREADOR });
    const enListado = listado.body?.find((p) => p.id_plantilla === idCreada);
    const soloBorradores = await llamarApi("/plantillas?estado=BORRADOR", {
      empleado: CREADOR,
    });
    const soloPublicadas = await llamarApi("/plantillas?estado=PUBLICADA", {
      empleado: CREADOR,
    });
    const porArea = await llamarApi(`/plantillas?id_departamento=${AREA_B}`, {
      empleado: CREADOR,
    });
    const porTexto = await llamarApi(
      `/plantillas?q=${encodeURIComponent(`${PREFIJO} Creación`)}`,
      { empleado: CREADOR },
    );
    registrarResultado(
      "Criterio 1",
      "1.11 El listado muestra la plantilla con su estado y se puede filtrar por estado, área y texto",
      enListado?.estado_codigo === "BORRADOR" &&
        soloBorradores.body.some((p) => p.id_plantilla === idCreada) &&
        !soloPublicadas.body.some((p) => p.id_plantilla === idCreada) &&
        !porArea.body.some((p) => p.id_plantilla === idCreada) &&
        porTexto.body.length === 1 &&
        porTexto.body[0].id_plantilla === idCreada,
      { enListado, porTexto: porTexto.body?.length },
    );
    const detalle = await llamarApi(`/plantillas/${idCreada}`, {
      empleado: CREADOR,
    });
    registrarResultado(
      "Criterio 1",
      "1.12 El detalle trae la plantilla con la lista de sus versiones",
      detalle.status === 200 &&
        detalle.body.versiones.length === 1 &&
        detalle.body.versiones[0].estado_codigo === "BORRADOR",
      detalle.body,
    );

    console.log(
      "\n--- CRITERIO 2: Secciones y validación previa a la publicación ---",
    );

    const c2 = (await crearPlantilla({ nombre: `${PREFIJO} Secciones` })).body;
    const v2 = c2.version_actual.id_version;

    const sinSecciones = await publicar(c2.id_plantilla, v2);
    registrarResultado(
      "Criterio 2",
      "2.1 Una versión sin secciones no se puede publicar: responde 422 y señala que faltan",
      sinSecciones.status === 422 &&
        sinSecciones.body.detalles.some((d) => d.campo === "secciones"),
      sinSecciones.body,
    );
    registrarResultado(
      "Criterio 2",
      "2.2 Tras el rechazo la versión sigue en borrador",
      (await versionesDe(c2.id_plantilla))[0].id_estado_version === 1,
      await versionesDe(c2.id_plantilla),
    );

    const armada = await guardarSecciones(c2.id_plantilla, v2, [A, B, M]);
    registrarResultado(
      "Criterio 2",
      "2.3 Guardar secciones de competencias y de factores operativos responde 200 y respeta el orden",
      armada.status === 200 &&
        armada.body.secciones
          .map((s) => s.competencia.id_competencia)
          .join() === [A, B, M].join() &&
        armada.body.secciones.map((s) => s.competencia.tipo_codigo).join() ===
          "COMPETENCIA_LABORAL,COMPETENCIA_LABORAL,FACTOR_OPERATIVO",
      armada.body,
    );
    registrarResultado(
      "Criterio 2",
      "2.4 En la base cada sección queda con su posición",
      (await seccionesDe(v2)).join() === lista(A, B, M).join(),
      await seccionesDe(v2),
    );

    const reordenada = await guardarSecciones(c2.id_plantilla, v2, [M, A]);
    registrarResultado(
      "Criterio 2",
      "2.5 Reordenar y quitar una sección actualiza la lista: las que se conservan cambian de posición y la otra desaparece",
      reordenada.status === 200 &&
        (await seccionesDe(v2)).join() === lista(M, A).join(),
      await seccionesDe(v2),
    );
    await guardarSecciones(c2.id_plantilla, v2, [A, B, M]);

    const antesDeRechazos = (await seccionesDe(v2)).join();
    const inexistente = await guardarSecciones(c2.id_plantilla, v2, [
      A,
      id(500),
    ]);
    const repetida = await guardarSecciones(c2.id_plantilla, v2, [A, A]);
    const malFormada = await llamarApi(
      `${rutaVersion(c2.id_plantilla, v2)}/secciones`,
      {
        metodo: "PUT",
        empleado: CREADOR,
        cuerpo: { secciones: [{ id_competencia: "x" }] },
      },
    );
    const sinLista = await llamarApi(
      `${rutaVersion(c2.id_plantilla, v2)}/secciones`,
      { metodo: "PUT", empleado: CREADOR, cuerpo: {} },
    );
    registrarResultado(
      "Criterio 2",
      "2.6 Una competencia que no existe da 422; repetida, mal formada o sin lista, 400; y las secciones guardadas no cambian",
      inexistente.status === 422 &&
        repetida.status === 400 &&
        malFormada.status === 400 &&
        sinLista.status === 400 &&
        (await seccionesDe(v2)).join() === antesDeRechazos,
      {
        inexistente: inexistente.status,
        repetida: repetida.status,
        malFormada: malFormada.status,
        sinLista: sinLista.status,
      },
    );

    await pool.query(
      "UPDATE competencias SET esta_activa = FALSE WHERE id_competencia = $1",
      [B],
    );
    const conDesactivada = await publicar(c2.id_plantilla, v2);
    const agregarDesactivada = await guardarSecciones(
      c2.id_plantilla,
      c2.version_actual.id_version,
      [A, B, M],
    );
    await pool.query(
      "UPDATE competencias SET esta_activa = TRUE WHERE id_competencia = $1",
      [B],
    );
    registrarResultado(
      "Criterio 2",
      "2.7 Con una competencia desactivada no se puede publicar, y el mensaje la nombra",
      conDesactivada.status === 422 &&
        conDesactivada.body.detalles.some((d) =>
          d.mensaje.includes("Trabajo en equipo"),
        ) &&
        agregarDesactivada.status === 200,
      {
        conDesactivada: conDesactivada.body,
        agregarDesactivada: agregarDesactivada.status,
      },
    );

    const vencida = (
      await crearPlantilla({
        nombre: `${PREFIJO} Vencida`,
        vigencia_desde: "2020-01-01",
        vigencia_hasta: "2020-12-31",
      })
    ).body;
    await guardarSecciones(
      vencida.id_plantilla,
      vencida.version_actual.id_version,
      [A],
    );
    const publicarVencida = await publicar(
      vencida.id_plantilla,
      vencida.version_actual.id_version,
    );
    registrarResultado(
      "Criterio 2",
      "2.8 Una plantilla cuya vigencia ya terminó no se puede publicar",
      publicarVencida.status === 422 &&
        publicarVencida.body.detalles.some((d) => d.campo === "vigencia_hasta"),
      publicarVencida.body,
    );

    const todoJunto = (
      await crearPlantilla({
        nombre: `${PREFIJO} Varios pendientes`,
        vigencia_desde: "2020-01-01",
        vigencia_hasta: "2020-12-31",
      })
    ).body;
    const variosPendientes = await publicar(
      todoJunto.id_plantilla,
      todoJunto.version_actual.id_version,
    );
    registrarResultado(
      "Criterio 2",
      "2.9 Si faltan varias cosas, la respuesta las lista todas juntas",
      variosPendientes.status === 422 &&
        variosPendientes.body.detalles.length === 2,
      variosPendientes.body,
    );

    const repetidaCompetencia = await llamarApi("/competencias", {
      metodo: "POST",
      empleado: CREADOR,
      cuerpo: {
        nombre: `  ${PREFIJO.toLowerCase()}   atención al cliente `,
        tipo: "COMPETENCIA_LABORAL",
      },
    });
    const competenciaInvalida = await llamarApi("/competencias", {
      metodo: "POST",
      empleado: CREADOR,
      cuerpo: { nombre: "", tipo: "otro" },
    });
    const catalogo = await llamarApi("/competencias?tipo=FACTOR_OPERATIVO", {
      empleado: CREADOR,
    });
    registrarResultado(
      "Criterio 2",
      "2.10 El catálogo no admite nombres repetidos (409) ni datos inválidos (400), y se filtra por tipo",
      repetidaCompetencia.status === 409 &&
        competenciaInvalida.status === 400 &&
        catalogo.body.some((c) => c.id_competencia === M) &&
        !catalogo.body.some((c) => c.id_competencia === A),
      { repetida: repetidaCompetencia.body, filtro: catalogo.body?.length },
    );

    console.log("\n--- CRITERIO 3: Publicación y bloqueo de la estructura ---");

    const publicada = await publicar(c2.id_plantilla, v2);
    const filaPublicada = (await versionesDe(c2.id_plantilla))[0];
    registrarResultado(
      "Criterio 3",
      "3.1 Publicar una versión completa responde 200 y queda publicada, con su fecha y quien la publicó",
      publicada.status === 200 &&
        publicada.body.estado_codigo === "PUBLICADA" &&
        publicada.body.editable === false &&
        publicada.body.publicador === "Publicador QA Plantilla" &&
        filaPublicada.id_estado_version === 2 &&
        filaPublicada.publicada_en !== null &&
        filaPublicada.id_empleado_publicador === PUBLICADOR,
      { respuesta: publicada.body, base: filaPublicada },
    );
    const disponibles = await llamarApi("/plantillas?estado=PUBLICADA", {
      empleado: CREADOR,
    });
    registrarResultado(
      "Criterio 3",
      "3.2 La plantilla publicada aparece entre las disponibles para asignar",
      disponibles.body.some((p) => p.id_plantilla === c2.id_plantilla),
      disponibles.body?.length,
    );

    const seccionesAntes = (await seccionesDe(v2)).join();
    const cabeceraAntes = await cabeceraDe(c2.id_plantilla);
    const editarSecciones = await guardarSecciones(c2.id_plantilla, v2, [M]);
    const editarCabecera = await editarPlantilla(c2.id_plantilla, {
      nombre: `${PREFIJO} Secciones renombrada`,
      vigencia_desde: "2090-01-01",
      vigencia_hasta: "2090-12-31",
    });
    const borrar = await llamarApi(`/plantillas/${c2.id_plantilla}`, {
      metodo: "DELETE",
      empleado: CREADOR,
    });
    const publicarOtraVez = await publicar(c2.id_plantilla, v2);
    registrarResultado(
      "Criterio 3",
      "3.3 Una vez publicada ya no se pueden modificar sus secciones ni sus datos base, ni eliminarla ni publicarla otra vez (409)",
      [editarSecciones, editarCabecera, borrar, publicarOtraVez].every(
        (r) => r.status === 409,
      ),
      [editarSecciones, editarCabecera, borrar, publicarOtraVez].map(
        (r) => r.status,
      ),
    );
    registrarResultado(
      "Criterio 3",
      "3.4 Tras los intentos rechazados la base conserva exactamente la misma estructura y cabecera",
      (await seccionesDe(v2)).join() === seccionesAntes &&
        JSON.stringify(await cabeceraDe(c2.id_plantilla)) ===
          JSON.stringify(cabeceraAntes) &&
        (await existe(c2.id_plantilla)),
      {
        secciones: await seccionesDe(v2),
        cabecera: await cabeceraDe(c2.id_plantilla),
      },
    );

    // Para comprobar que la nueva versión copia también criterios y preguntas, se cuelgan directo en la base.
    const [seccionConCriterio] = await consultar(
      "SELECT id_seccion FROM secciones_plantilla WHERE id_version = $1 AND orden = 1",
      [v2],
    );
    const [criterio] = await consultar(
      "INSERT INTO criterios_evaluacion (id_seccion, nombre, orden) VALUES ($1, $2, 1) RETURNING id_criterio",
      [seccionConCriterio.id_seccion, `${PREFIJO} criterio`],
    );
    await pool.query(
      "INSERT INTO preguntas_evaluacion (id_criterio, id_escala, texto, peso_porcentual, es_obligatoria, orden) VALUES ($1, $2, $3, 100, TRUE, 1)",
      [criterio.id_criterio, ESCALA_LIKERT, `${PREFIJO} pregunta`],
    );

    const nuevaVersion = await llamarApi(
      `/plantillas/${c2.id_plantilla}/versiones`,
      { metodo: "POST", empleado: CREADOR },
    );
    const v2b = nuevaVersion.body?.id_version;
    const copia = await consultar(
      `SELECT (SELECT count(*) FROM secciones_plantilla WHERE id_version = $1) AS secciones,
              (SELECT count(*) FROM criterios_evaluacion c JOIN secciones_plantilla s USING (id_seccion) WHERE s.id_version = $1) AS criterios,
              (SELECT count(*) FROM preguntas_evaluacion p JOIN criterios_evaluacion c USING (id_criterio) JOIN secciones_plantilla s USING (id_seccion) WHERE s.id_version = $1) AS preguntas,
              (SELECT count(*) FROM secciones_plantilla WHERE id_version = $2) AS secciones_origen`,
      [v2b, v2],
    );
    registrarResultado(
      "Criterio 3",
      "3.5 Crear una nueva versión parte de la publicada: borrador número 2 con las mismas secciones, criterios y preguntas copiados",
      nuevaVersion.status === 201 &&
        nuevaVersion.body.numero_version === 2 &&
        nuevaVersion.body.estado_codigo === "BORRADOR" &&
        Number(copia[0].secciones) === 3 &&
        Number(copia[0].criterios) === 1 &&
        Number(copia[0].preguntas) === 1 &&
        Number(copia[0].secciones_origen) === 3 &&
        (await seccionesDe(v2b)).join() === (await seccionesDe(v2)).join(),
      { respuesta: nuevaVersion.body, copia: copia[0] },
    );
    const otraVersion = await llamarApi(
      `/plantillas/${c2.id_plantilla}/versiones`,
      { metodo: "POST", empleado: CREADOR },
    );
    registrarResultado(
      "Criterio 3",
      "3.6 Mientras haya un borrador abierto no se crea otra versión (409)",
      otraVersion.status === 409,
      otraVersion.body,
    );

    const editarBorradorNuevo = await guardarSecciones(c2.id_plantilla, v2b, [
      A,
      M,
    ]);
    const versionesMientras = await versionesDe(c2.id_plantilla);
    registrarResultado(
      "Criterio 3",
      "3.7 El borrador nuevo sí se edita, y mientras tanto la versión 1 sigue publicada y sin cambios",
      editarBorradorNuevo.status === 200 &&
        versionesMientras.map((v) => v.id_estado_version).join() === "2,1" &&
        (await seccionesDe(v2)).join() === seccionesAntes,
      versionesMientras,
    );
    const noSeElimina = await llamarApi(`/plantillas/${c2.id_plantilla}`, {
      metodo: "DELETE",
      empleado: CREADOR,
    });
    registrarResultado(
      "Criterio 3",
      "3.8 Una plantilla que ya se publicó no se elimina aunque tenga un borrador nuevo (409)",
      noSeElimina.status === 409,
      noSeElimina.body,
    );

    const publicarNueva = await publicar(c2.id_plantilla, v2b);
    const estadosFinales = await versionesDe(c2.id_plantilla);
    registrarResultado(
      "Criterio 3",
      "3.9 Al publicar la versión 2 la versión 1 queda archivada: solo hay una publicada",
      publicarNueva.status === 200 &&
        estadosFinales.map((v) => v.id_estado_version).join() === "3,2",
      estadosFinales,
    );
    const archivada = await guardarSecciones(c2.id_plantilla, v2, [A]);
    registrarResultado(
      "Criterio 3",
      "3.10 La versión archivada tampoco se puede modificar (409)",
      archivada.status === 409,
      archivada.body,
    );

    const borrable = (await crearPlantilla({ nombre: `${PREFIJO} Borrable` }))
      .body;
    await guardarSecciones(
      borrable.id_plantilla,
      borrable.version_actual.id_version,
      [A, M],
    );
    const eliminar = await llamarApi(`/plantillas/${borrable.id_plantilla}`, {
      metodo: "DELETE",
      empleado: CREADOR,
    });
    registrarResultado(
      "Criterio 3",
      "3.11 Un borrador que nunca se publicó se elimina junto con sus versiones y secciones",
      eliminar.status === 200 &&
        !(await existe(borrable.id_plantilla)) &&
        (await versionesDe(borrable.id_plantilla)).length === 0,
      eliminar.body,
    );

    console.log("\n--- CRITERIO 4: Alerta de duplicidad ---");

    const nombre4 = `${PREFIJO} Duplicidad`;
    const original = await crearPlantilla({
      nombre: nombre4,
      vigencia_desde: "2091-01-01",
      vigencia_hasta: "2091-12-31",
    });
    const exacta = await crearPlantilla({
      nombre: nombre4,
      vigencia_desde: "2091-01-01",
      vigencia_hasta: "2091-12-31",
    });
    registrarResultado(
      "Criterio 4",
      "4.1 El mismo nombre, área y periodo se rechaza con la alerta de duplicidad (409) y no se guarda otra",
      original.status === 201 &&
        exacta.status === 409 &&
        exacta.body.detalles[0].campo === "nombre" &&
        (await totalPlantillas(nombre4)) === 1,
      { original: original.status, exacta: exacta.body },
    );
    registrarResultado(
      "Criterio 4",
      "4.2 La alerta dice cuál es la plantilla que ya existe y su vigencia",
      /2091-01-01 al 2091-12-31/.test(
        exacta.body?.detalles?.[0]?.mensaje ?? "",
      ),
      exacta.body,
    );
    const mayusculas = await crearPlantilla({
      nombre: `  ${nombre4.toUpperCase()}  `,
      vigencia_desde: "2091-03-01",
      vigencia_hasta: "2091-06-30",
    });
    registrarResultado(
      "Criterio 4",
      "4.3 No importan las mayúsculas ni los espacios en los extremos: es el mismo nombre (409)",
      mayusculas.status === 409,
      mayusculas.body,
    );
    const roce = await crearPlantilla({
      nombre: nombre4,
      vigencia_desde: "2091-12-31",
      vigencia_hasta: "2092-03-31",
    });
    registrarResultado(
      "Criterio 4",
      "4.4 Basta con que un solo día de la vigencia coincida para que sea duplicada (409)",
      roce.status === 409,
      roce.body,
    );
    const otraArea = await crearPlantilla({
      nombre: nombre4,
      id_departamento: AREA_B,
      vigencia_desde: "2091-01-01",
      vigencia_hasta: "2091-12-31",
    });
    registrarResultado(
      "Criterio 4",
      "4.5 El mismo nombre y periodo en otra área sí se permite",
      otraArea.status === 201,
      otraArea.body,
    );
    const siguiente = await crearPlantilla({
      nombre: nombre4,
      vigencia_desde: "2092-01-01",
      vigencia_hasta: "2092-12-31",
    });
    registrarResultado(
      "Criterio 4",
      "4.6 El mismo nombre y área en un periodo que no se cruza sí se permite",
      siguiente.status === 201,
      siguiente.body,
    );

    const choqueAlEditar = await editarPlantilla(siguiente.body.id_plantilla, {
      nombre: nombre4,
      vigencia_desde: "2091-06-01",
      vigencia_hasta: "2092-12-31",
    });
    const cabeceraSiguiente = await cabeceraDe(siguiente.body.id_plantilla);
    registrarResultado(
      "Criterio 4",
      "4.7 Editar una plantilla hasta que choque con otra da 409 y no cambia lo guardado",
      choqueAlEditar.status === 409 &&
        cabeceraSiguiente.vigencia_desde === "2092-01-01",
      { respuesta: choqueAlEditar.body, cabecera: cabeceraSiguiente },
    );
    const sobreSiMisma = await editarPlantilla(original.body.id_plantilla, {
      nombre: nombre4,
      objetivo: "Objetivo corregido.",
      vigencia_desde: "2091-01-01",
      vigencia_hasta: "2091-12-31",
    });
    registrarResultado(
      "Criterio 4",
      "4.8 Guardar una plantilla sin cambiar su nombre no choca consigo misma",
      sobreSiMisma.status === 200 &&
        sobreSiMisma.body.objetivo === "Objetivo corregido.",
      sobreSiMisma.body,
    );

    const nombreConcurrente = `${PREFIJO} Concurrencia`;
    const simultaneas = await Promise.all(
      Array.from({ length: 8 }, () =>
        crearPlantilla({
          nombre: nombreConcurrente,
          vigencia_desde: "2093-01-01",
          vigencia_hasta: "2093-12-31",
        }),
      ),
    );
    const estados = simultaneas.map((r) => r.status).sort();
    registrarResultado(
      "Criterio 4",
      "4.9 Ocho solicitudes simultáneas con el mismo nombre, área y periodo: solo una se guarda y las demás reciben 409",
      estados.filter((s) => s === 201).length === 1 &&
        estados.filter((s) => s === 409).length === 7 &&
        (await totalPlantillas(nombreConcurrente)) === 1,
      estados,
    );
    let codigoBase = null;
    try {
      await pool.query(
        "INSERT INTO plantillas_evaluacion (id_departamento_destino, id_empleado_creador, nombre, objetivo, vigencia_desde, vigencia_hasta) VALUES ($1, $2, $3, 'x', '2093-05-01', '2093-06-01')",
        [AREA_A, CREADOR, nombreConcurrente.toUpperCase()],
      );
    } catch (e) {
      codigoBase = e.code;
    }
    registrarResultado(
      "Criterio 4",
      "4.10 La propia base de datos impide el duplicado aunque se intente saltar el servicio (restricción de exclusión)",
      codigoBase === "23P01",
      codigoBase,
    );

    console.log(
      "\n--- FRONTERAS: identificación, identificadores y errores ---",
    );

    const sinEmpleado = await llamarApi("/plantillas");
    const empleadoMalo = await llamarApi("/plantillas", {
      empleado: "no-es-un-uuid",
    });
    registrarResultado(
      "Fronteras",
      "5.1 Sin identificar al empleado responde 401; con un identificador mal formado, 403",
      sinEmpleado.status === 401 && empleadoMalo.status === 403,
      { sin: sinEmpleado.status, malo: empleadoMalo.status },
    );

    const idMalo = await llamarApi("/plantillas/abc", { empleado: CREADOR });
    const versionMala = await llamarApi(
      `/plantillas/${c2.id_plantilla}/versiones/abc`,
      { empleado: CREADOR },
    );
    registrarResultado(
      "Fronteras",
      "5.2 Un identificador mal formado responde 400 en la plantilla y en la versión",
      idMalo.status === 400 && versionMala.status === 400,
      { idMalo: idMalo.status, versionMala: versionMala.status },
    );

    const noExiste = await Promise.all([
      llamarApi(`/plantillas/${INEXISTENTE}`, { empleado: CREADOR }),
      editarPlantilla(INEXISTENTE, {}),
      llamarApi(`/plantillas/${INEXISTENTE}`, {
        metodo: "DELETE",
        empleado: CREADOR,
      }),
      llamarApi(`/plantillas/${INEXISTENTE}/versiones`, {
        metodo: "POST",
        empleado: CREADOR,
      }),
      llamarApi(rutaVersion(INEXISTENTE, INEXISTENTE), { empleado: CREADOR }),
    ]);
    registrarResultado(
      "Fronteras",
      "5.3 Una plantilla o una versión que no existe responde 404 en cada operación",
      noExiste.every((r) => r.status === 404),
      noExiste.map((r) => r.status),
    );

    const deOtra = await llamarApi(
      rutaVersion(original.body.id_plantilla, v2),
      { empleado: CREADOR },
    );
    registrarResultado(
      "Fronteras",
      "5.4 Una versión que pertenece a otra plantilla responde 404",
      deOtra.status === 404,
      deOtra.body,
    );

    const jsonRoto = await llamarApi("/plantillas", {
      metodo: "POST",
      empleado: CREADOR,
      crudo: "{no es json",
    });
    registrarResultado(
      "Fronteras",
      "5.5 Un JSON inválido responde 400",
      jsonRoto.status === 400,
      jsonRoto.body,
    );

    const estadoMalo = await llamarApi("/plantillas?estado=ACTIVA", {
      empleado: CREADOR,
    });
    registrarResultado(
      "Fronteras",
      "5.6 Un filtro de estado desconocido responde 400",
      estadoMalo.status === 400 &&
        estadoMalo.body.detalles[0].campo === "estado",
      estadoMalo.body,
    );

    const antesCaido = await totalPlantillas(
      `${PREFIJO} EmployeeService caído`,
    );
    const caido = await llamarApi("/plantillas", {
      metodo: "POST",
      empleado: CREADOR,
      cuerpo: datos({ nombre: `${PREFIJO} EmployeeService caído` }),
      base: servicioSinEmpleados.base,
    });
    registrarResultado(
      "Fronteras",
      "5.7 Si EmployeeService no responde se devuelve 503 y no se guarda nada",
      caido.status === 503 &&
        (await totalPlantillas(`${PREFIJO} EmployeeService caído`)) ===
          antesCaido,
      caido.body,
    );

    registrarResultado(
      "Fronteras",
      "5.8 Los errores traen «error» y, en 400 y 422, la lista «detalles»",
      typeof idMalo.body?.error === "string" &&
        typeof noExiste[0].body?.error === "string" &&
        Array.isArray(vacia.body?.detalles) &&
        Array.isArray(sinSecciones.body?.detalles),
      { idMalo: idMalo.body, vacia: vacia.body },
    );
  }

  console.log(
    "\n================================================================================",
  );
  console.log(" RESUMEN DE LA EJECUCIÓN");
  console.log(
    "================================================================================",
  );
  console.log(`Pruebas ejecutadas: ${totalPruebas}`);
  console.log(
    `Aprobadas:          ${aprobadas} (${Math.round((aprobadas / totalPruebas) * 100)}%)`,
  );
  console.log(`Falladas:           ${falladas}`);
  console.log(
    "================================================================================\n",
  );

  try {
    await limpiarDatosDePrueba();
    console.log(" Datos de prueba eliminados (solo los de esta suite).");
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

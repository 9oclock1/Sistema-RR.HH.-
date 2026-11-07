// Prueba de integración de KAN-22 contra una PerformanceDB real (creada con db/init.sql).
// Levanta PerformanceService como proceso aparte y simula EmployeeService con un servidor HTTP mínimo.
// Solo se ejecuta si se indica la base de pruebas; NO usar la base de desarrollo, la prueba borra lo que crea:
//   DATABASE_URL_PRUEBAS=postgres://test:test@localhost:55432/PerformanceDB npm run test:integracion
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { Pool } = require("pg");

const URL_DB = process.env.DATABASE_URL_PRUEBAS;
const omitir = !URL_DB && "Defina DATABASE_URL_PRUEBAS para ejecutar la integración con PostgreSQL.";

const LIKERT = "00000000-0000-4000-8000-000000000001";
const CUMPLIMIENTO = "00000000-0000-4000-8000-000000000002";
const CREADOR = "e2200000-0000-4000-8000-000000000001";
const PUBLICADOR = "e2200000-0000-4000-8000-000000000002";
const DESCONOCIDO = "e2200000-0000-4000-8000-0000000000ff";
const AREA = "d2200000-0000-4000-8000-000000000001";
const AREA_2 = "d2200000-0000-4000-8000-000000000002";
const SUFIJO = Date.now().toString(36);

const EMPLEADOS = {
  [CREADOR]: { id_empleado: CREADOR, nombres: "Ana", apellidos: "Rojas" },
  [PUBLICADOR]: { id_empleado: PUBLICADOR, nombres: "Luis", apellidos: "Mamani" },
};
const DEPARTAMENTOS = [
  { id_departamento: AREA, nombre: "Cajas" },
  { id_departamento: AREA_2, nombre: "Créditos" },
];

let db;
let servicioEmpleados;
let proceso;
let base;
const creadas = { plantillas: new Set(), escalas: new Set(), competencias: new Set() };

async function api(metodo, ruta, { cuerpo, empleado } = {}) {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { ...(cuerpo && { "Content-Type": "application/json" }), ...(empleado && { "X-Empleado-Id": empleado }) },
    body: cuerpo && JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  return { estado: respuesta.status, datos: texto ? JSON.parse(texto) : null };
}

const puertoLibre = () =>
  new Promise((resolver) => {
    const servidor = http.createServer().listen(0, () => {
      const { port } = servidor.address();
      servidor.close(() => resolver(port));
    });
  });

before(async () => {
  if (omitir) return;
  db = new Pool({ connectionString: URL_DB });

  servicioEmpleados = http.createServer((req, res) => {
    const responder = (estado, datos) => {
      res.writeHead(estado, { "Content-Type": "application/json" });
      res.end(JSON.stringify(datos));
    };
    if (req.url === "/departamentos") return responder(200, DEPARTAMENTOS);
    const empleado = EMPLEADOS[req.url.replace("/empleados/", "")];
    return empleado ? responder(200, empleado) : responder(404, { error: "No existe" });
  });
  await new Promise((resolver) => servicioEmpleados.listen(0, resolver));

  const puerto = await puertoLibre();
  base = `http://127.0.0.1:${puerto}`;
  proceso = spawn(process.execPath, ["index.js"], {
    cwd: path.join(__dirname, "..", ".."),
    env: {
      ...process.env,
      PORT: String(puerto),
      DATABASE_URL: URL_DB,
      EMPLOYEE_SERVICE_URL: `http://127.0.0.1:${servicioEmpleados.address().port}`,
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((resolver, rechazar) => {
    proceso.stdout.on("data", (dato) => String(dato).includes("corriendo") && resolver());
    proceso.on("exit", (codigo) => rechazar(new Error(`PerformanceService terminó con código ${codigo}`)));
  });
});

after(async () => {
  if (omitir) return;
  proceso?.kill();
  servicioEmpleados?.close();
  // Borra lo creado, de las hojas a la raíz (la base no tiene ON DELETE CASCADE).
  const plantillas = [...creadas.plantillas];
  if (plantillas.length > 0) {
    const versiones = `SELECT id_version FROM versiones_plantilla WHERE id_plantilla = ANY($1::uuid[])`;
    const secciones = `SELECT id_seccion FROM secciones_plantilla WHERE id_version IN (${versiones})`;
    const criterios = `SELECT id_criterio FROM criterios_evaluacion WHERE id_seccion IN (${secciones})`;
    await db.query(`DELETE FROM preguntas_evaluacion WHERE id_criterio IN (${criterios})`, [plantillas]);
    await db.query(`DELETE FROM criterios_evaluacion WHERE id_seccion IN (${secciones})`, [plantillas]);
    await db.query(`DELETE FROM secciones_plantilla WHERE id_version IN (${versiones})`, [plantillas]);
    await db.query("DELETE FROM versiones_plantilla WHERE id_plantilla = ANY($1::uuid[])", [plantillas]);
    await db.query("DELETE FROM plantillas_evaluacion WHERE id_plantilla = ANY($1::uuid[])", [plantillas]);
  }
  await db.query("DELETE FROM niveles_escala WHERE id_escala = ANY($1::uuid[])", [[...creadas.escalas]]);
  await db.query("DELETE FROM escalas_valoracion WHERE id_escala = ANY($1::uuid[])", [[...creadas.escalas]]);
  await db.query("DELETE FROM competencias WHERE id_competencia = ANY($1::uuid[])", [[...creadas.competencias]]);
  await db.query("DELETE FROM empleados WHERE id_empleado = ANY($1::uuid[])", [[CREADOR, PUBLICADOR]]);
  await db.query("DELETE FROM departamentos WHERE id_departamento = ANY($1::uuid[])", [[AREA, AREA_2]]);
  await db.end();
});

const datosBase = (extra = {}) => ({
  nombre: `Desempeño de cajeros ${SUFIJO}`,
  objetivo: "Medir el desempeño semestral de los cajeros.",
  id_departamento_destino: AREA,
  vigencia_desde: "2026-01-01",
  vigencia_hasta: "2026-12-31",
  ...extra,
});

const pregunta = (texto, peso_porcentual, extra = {}) => ({ texto, peso_porcentual, id_escala: LIKERT, ...extra });

// Estado compartido entre pasos: cada prueba continúa el flujo de la anterior.
const flujo = {};

test("las escalas de partida de init.sql se listan con sus niveles", { skip: omitir }, async () => {
  const { estado, datos } = await api("GET", "/escalas");
  assert.equal(estado, 200);
  const likert = datos.find((e) => e.id_escala === LIKERT);
  assert.equal(likert.tipo, "CUANTITATIVA");
  assert.deepEqual(
    likert.niveles.map((n) => [n.valor, n.etiqueta]),
    [[1, "Muy deficiente"], [2, "Deficiente"], [3, "Aceptable"], [4, "Bueno"], [5, "Excelente"]]
  );
  assert.equal(datos.find((e) => e.id_escala === CUMPLIMIENTO).tipo, "CUALITATIVA");
});

test("crea competencias del catálogo y rechaza nombres repetidos", { skip: omitir }, async () => {
  const laboral = await api("POST", "/competencias", {
    cuerpo: { nombre: `Atención al cliente ${SUFIJO}`, tipo: "COMPETENCIA_LABORAL" },
  });
  assert.equal(laboral.estado, 201);
  assert.equal(laboral.datos.tipo, "COMPETENCIA_LABORAL");
  creadas.competencias.add(laboral.datos.id_competencia);

  const operativo = await api("POST", "/competencias", {
    cuerpo: { nombre: `Arqueo de caja ${SUFIJO}`, tipo: "FACTOR_OPERATIVO", descripcion: "Cuadre diario" },
  });
  assert.equal(operativo.estado, 201);
  creadas.competencias.add(operativo.datos.id_competencia);
  Object.assign(flujo, { laboral: laboral.datos.id_competencia, operativo: operativo.datos.id_competencia });

  const repetida = await api("POST", "/competencias", {
    cuerpo: { nombre: `Atención al cliente ${SUFIJO}`, tipo: "FACTOR_OPERATIVO" },
  });
  assert.equal(repetida.estado, 409);

  const { datos } = await api("GET", "/competencias");
  assert.ok(datos.some((c) => c.id_competencia === flujo.operativo && c.tipo_nombre === "Factor operativo"));
});

test("criterio 3: crea una escala cualitativa y valida sus niveles", { skip: omitir }, async () => {
  const invalida = await api("POST", "/escalas", {
    cuerpo: { nombre: `Frecuencia ${SUFIJO}`, tipo: "CUALITATIVA", niveles: [{ valor: 1, etiqueta: "Nunca" }] },
  });
  assert.equal(invalida.estado, 400);
  assert.ok(invalida.datos.detalles.some((d) => d.campo === "niveles"));

  const { estado, datos } = await api("POST", "/escalas", {
    cuerpo: {
      nombre: `Frecuencia ${SUFIJO}`,
      tipo: "CUALITATIVA",
      niveles: [
        { valor: 3, etiqueta: "Siempre" },
        { valor: 1, etiqueta: "Nunca" },
        { valor: 2, etiqueta: "A veces" },
      ],
    },
  });
  assert.equal(estado, 201);
  assert.deepEqual(
    datos.niveles.map((n) => n.etiqueta),
    ["Nunca", "A veces", "Siempre"]
  );
  assert.equal(datos.en_uso, false);
  creadas.escalas.add(datos.id_escala);
  flujo.frecuencia = datos.id_escala;
});

test("pide un empleado registrado para crear la plantilla", { skip: omitir }, async () => {
  const cuerpo = { ...datosBase(), secciones: [] };
  assert.equal((await api("POST", "/plantillas", { cuerpo })).estado, 401);
  assert.equal((await api("POST", "/plantillas", { cuerpo, empleado: DESCONOCIDO })).estado, 403);
  const areaInexistente = await api("POST", "/plantillas", {
    cuerpo: { ...cuerpo, id_departamento_destino: "d2200000-0000-4000-8000-0000000000ff" },
    empleado: CREADOR,
  });
  assert.equal(areaInexistente.estado, 400);
  assert.equal(areaInexistente.datos.detalles[0].campo, "id_departamento_destino");
});

test("criterio 1: crea la plantilla en borrador con secciones, criterios y preguntas ponderadas", { skip: omitir }, async () => {
  const { estado, datos } = await api("POST", "/plantillas", {
    empleado: CREADOR,
    cuerpo: {
      ...datosBase(),
      secciones: [
        {
          id_competencia: flujo.laboral,
          criterios: [
            { nombre: "Trato", descripcion: "Cordialidad", preguntas: [pregunta("Saluda al cliente", 30), pregunta("Resuelve dudas", 20)] },
          ],
        },
        {
          id_competencia: flujo.operativo,
          criterios: [
            {
              nombre: "Cuadre",
              preguntas: [pregunta("Cuadra la caja", 25, { id_escala: CUMPLIMIENTO, es_obligatoria: false })],
            },
          ],
        },
      ],
    },
  });
  assert.equal(estado, 201, JSON.stringify(datos));
  creadas.plantillas.add(datos.id_plantilla);
  Object.assign(flujo, { idPlantilla: datos.id_plantilla, v1: datos.id_version });

  assert.equal(datos.estado, "BORRADOR");
  assert.equal(datos.numero_version, 1);
  assert.equal(datos.departamento, "Cajas");
  assert.equal(datos.vigencia_desde, "2026-01-01");
  assert.equal(datos.datos_editables, true);
  assert.deepEqual(
    datos.secciones.map((s) => [s.tipo_competencia, s.peso]),
    [["COMPETENCIA_LABORAL", 50], ["FACTOR_OPERATIVO", 25]]
  );
  const opcional = datos.secciones[1].criterios[0].preguntas[0];
  assert.equal(opcional.es_obligatoria, false);
  assert.equal(opcional.id_escala, CUMPLIMIENTO);
  assert.deepEqual(datos.balance, { suma: 75, diferencia: 25, balanceado: false });

  // Réplicas mínimas de EmployeeDB.
  const { rows } = await db.query(
    `SELECT e.nombres, d.nombre, p.id_empleado_creador FROM plantillas_evaluacion p
     JOIN empleados e ON e.id_empleado = p.id_empleado_creador
     JOIN departamentos d ON d.id_departamento = p.id_departamento_destino WHERE p.id_plantilla = $1`,
    [datos.id_plantilla]
  );
  assert.deepEqual(rows[0], { nombres: "Ana", nombre: "Cajas", id_empleado_creador: CREADOR });
});

test("rechaza competencias repetidas en la plantilla y escalas inexistentes", { skip: omitir }, async () => {
  const seccion = { id_competencia: flujo.laboral, criterios: [] };
  const repetida = await api("PUT", `/plantillas/versiones/${flujo.v1}`, {
    cuerpo: { ...datosBase(), secciones: [seccion, seccion] },
  });
  assert.equal(repetida.estado, 400);
  assert.equal(repetida.datos.detalles[0].campo, "secciones[1].id_competencia");

  const sinEscala = await api("PUT", `/plantillas/versiones/${flujo.v1}`, {
    cuerpo: {
      ...datosBase(),
      secciones: [
        { id_competencia: flujo.laboral, criterios: [{ nombre: "X", preguntas: [pregunta("Y", 10, { id_escala: DESCONOCIDO })] }] },
      ],
    },
  });
  assert.equal(sinEscala.estado, 400);
  assert.equal(sinEscala.datos.detalles[0].campo, "secciones[0].criterios[0].preguntas[0].id_escala");
});

test("criterio 2: impide publicar si los pesos no suman 100 y muestra el desbalance", { skip: omitir }, async () => {
  const { estado, datos } = await api("POST", `/plantillas/versiones/${flujo.v1}/publicacion`, { empleado: PUBLICADOR });
  assert.equal(estado, 422);
  assert.equal(datos.detalles[0].campo, "pesos");
  assert.match(datos.detalles[0].mensaje, /faltan 25 %/);
});

test("criterio 2: guarda el borrador balanceado y lo publica", { skip: omitir }, async () => {
  const actual = (await api("GET", `/plantillas/versiones/${flujo.v1}`)).datos;
  const secciones = actual.secciones.map((s) => ({
    id_competencia: s.id_competencia,
    criterios: s.criterios.map((c) => ({ nombre: c.nombre, descripcion: c.descripcion, preguntas: c.preguntas })),
  }));
  secciones[1].criterios[0].preguntas.push(pregunta("Reporta faltantes", 25, { id_escala: flujo.frecuencia }));

  const guardada = await api("PUT", `/plantillas/versiones/${flujo.v1}`, {
    cuerpo: { ...datosBase({ id_departamento_destino: AREA_2 }), secciones },
  });
  assert.equal(guardada.estado, 200, JSON.stringify(guardada.datos));
  assert.equal(guardada.datos.departamento, "Créditos");
  assert.equal(guardada.datos.balance.balanceado, true);

  const publicada = await api("POST", `/plantillas/versiones/${flujo.v1}/publicacion`, { empleado: PUBLICADOR });
  assert.equal(publicada.estado, 200, JSON.stringify(publicada.datos));
  assert.equal(publicada.datos.estado, "PUBLICADA");
  assert.equal(publicada.datos.publicador, "Luis Mamani");
  assert.ok(publicada.datos.publicada_en);
  assert.equal(publicada.datos.datos_editables, false);
});

test("criterio 4: una versión publicada no se modifica, no se elimina ni se vuelve a publicar", { skip: omitir }, async () => {
  const cambio = await api("PUT", `/plantillas/versiones/${flujo.v1}`, { cuerpo: { ...datosBase(), secciones: [] } });
  assert.equal(cambio.estado, 409);
  assert.match(cambio.datos.error, /Cree una nueva versión/);
  assert.equal((await api("DELETE", `/plantillas/versiones/${flujo.v1}`)).estado, 409);
  assert.equal((await api("POST", `/plantillas/versiones/${flujo.v1}/publicacion`, { empleado: PUBLICADOR })).estado, 409);
});

test("criterio 3: una escala usada en una versión publicada conserva tipo y niveles", { skip: omitir }, async () => {
  const cambiaNiveles = await api("PUT", `/escalas/${flujo.frecuencia}`, {
    cuerpo: { nombre: `Frecuencia ${SUFIJO}`, tipo: "CUALITATIVA", niveles: [{ valor: 1, etiqueta: "No" }, { valor: 2, etiqueta: "Sí" }] },
  });
  assert.equal(cambiaNiveles.estado, 409);

  const renombrada = await api("PUT", `/escalas/${flujo.frecuencia}`, {
    cuerpo: {
      nombre: `Frecuencia observada ${SUFIJO}`,
      tipo: "CUALITATIVA",
      niveles: [
        { valor: 1, etiqueta: "Nunca" },
        { valor: 2, etiqueta: "A veces" },
        { valor: 3, etiqueta: "Siempre" },
      ],
    },
  });
  assert.equal(renombrada.estado, 200, JSON.stringify(renombrada.datos));
  assert.equal(renombrada.datos.en_uso_publicado, true);
  assert.equal((await api("DELETE", `/escalas/${flujo.frecuencia}`)).estado, 409);
});

test("criterio 4: crea la versión 2 en borrador copiando la estructura, y no duplica el borrador", { skip: omitir }, async () => {
  const nueva = await api("POST", `/plantillas/versiones/${flujo.v1}/nueva-version`);
  assert.equal(nueva.estado, 201, JSON.stringify(nueva.datos));
  assert.equal(nueva.datos.numero_version, 2);
  assert.equal(nueva.datos.estado, "BORRADOR");
  assert.equal(nueva.datos.datos_editables, false);
  assert.equal(nueva.datos.balance.balanceado, true);
  assert.equal(nueva.datos.secciones.flatMap((s) => s.criterios).flatMap((c) => c.preguntas).length, 4);
  flujo.v2 = nueva.datos.id_version;

  const otraVez = await api("POST", `/plantillas/versiones/${flujo.v1}/nueva-version`);
  assert.equal(otraVez.estado, 200);
  assert.equal(otraVez.datos.id_version, flujo.v2);
});

test("en la versión 2 los datos base quedan fijos y solo cambia la estructura", { skip: omitir }, async () => {
  const { datos } = await api("GET", `/plantillas/versiones/${flujo.v2}`);
  const secciones = [
    {
      id_competencia: datos.secciones[0].id_competencia,
      criterios: [{ nombre: "Trato", preguntas: [pregunta("Saluda al cliente", 60), pregunta("Resuelve dudas", 40)] }],
    },
  ];
  const guardada = await api("PUT", `/plantillas/versiones/${flujo.v2}`, {
    cuerpo: { ...datosBase({ nombre: "Otro nombre" }), secciones },
  });
  assert.equal(guardada.estado, 200, JSON.stringify(guardada.datos));
  assert.equal(guardada.datos.nombre, datosBase().nombre);
  assert.equal(guardada.datos.departamento, "Créditos");

  // La versión 1 no cambió.
  const v1 = (await api("GET", `/plantillas/versiones/${flujo.v1}`)).datos;
  assert.equal(v1.secciones.length, 2);
});

test("publicar la versión 2 archiva la versión 1", { skip: omitir }, async () => {
  const publicada = await api("POST", `/plantillas/versiones/${flujo.v2}/publicacion`, { empleado: CREADOR });
  assert.equal(publicada.estado, 200, JSON.stringify(publicada.datos));

  const { datos } = await api("GET", "/plantillas");
  const propias = datos.filter((v) => v.id_plantilla === flujo.idPlantilla);
  assert.deepEqual(
    propias.map((v) => [v.numero_version, v.estado, v.total_preguntas, v.suma_pesos, v.balanceado]),
    [
      [2, "PUBLICADA", 2, 100, true],
      [1, "ARCHIVADA", 4, 100, true],
    ]
  );
});

test("no permite dos plantillas con el mismo nombre y área si sus vigencias se cruzan", { skip: omitir }, async () => {
  const cuerpo = { ...datosBase({ id_departamento_destino: AREA_2, vigencia_desde: "2026-06-01", vigencia_hasta: "2027-05-31" }), secciones: [] };
  const cruzada = await api("POST", "/plantillas", { cuerpo, empleado: CREADOR });
  assert.equal(cruzada.estado, 409);
  assert.match(cruzada.datos.error, /vigencia que se cruza/);

  const otraVigencia = await api("POST", "/plantillas", {
    cuerpo: { ...cuerpo, vigencia_desde: "2027-01-01", vigencia_hasta: "2027-12-31" },
    empleado: CREADOR,
  });
  assert.equal(otraVigencia.estado, 201, JSON.stringify(otraVigencia.datos));
  creadas.plantillas.add(otraVigencia.datos.id_plantilla);
  flujo.borradorUnico = otraVigencia.datos;
});

test("eliminar el único borrador elimina también la plantilla", { skip: omitir }, async () => {
  const { id_version: idVersion, id_plantilla: idPlantilla } = flujo.borradorUnico;
  assert.equal((await api("DELETE", `/plantillas/versiones/${idVersion}`)).estado, 204);
  assert.equal((await api("GET", `/plantillas/versiones/${idVersion}`)).estado, 404);
  const { rowCount } = await db.query("SELECT 1 FROM plantillas_evaluacion WHERE id_plantilla = $1", [idPlantilla]);
  assert.equal(rowCount, 0);
});

test("una escala sin uso se elimina", { skip: omitir }, async () => {
  const creada = await api("POST", "/escalas", {
    cuerpo: { nombre: `Temporal ${SUFIJO}`, tipo: "CUANTITATIVA", niveles: [{ valor: 0, etiqueta: "No" }, { valor: 1, etiqueta: "Sí" }] },
  });
  assert.equal(creada.estado, 201);
  creadas.escalas.add(creada.datos.id_escala);
  assert.equal((await api("DELETE", `/escalas/${creada.datos.id_escala}`)).estado, 204);
});

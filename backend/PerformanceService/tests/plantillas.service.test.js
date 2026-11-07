const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/plantillas.model");
const empleados = require("../src/services/empleados.service");
const transaccion = require("../src/config/transaccion");
const servicio = require("../src/services/plantillas.service");
const { ESTADO_VERSION } = require("../src/utils/catalogos");

const ID = "9f1c2d3e-0000-4000-8000-000000000001";
const ID_NUEVA = "9f1c2d3e-0000-4000-8000-000000000002";
const PLANTILLA = "9f1c2d3e-0000-4000-8000-0000000000aa";
const EMPLEADO = "e0000000-0000-4000-8000-000000000001";
const AREA = "d0000000-0000-4000-8000-000000000001";
const LIKERT = "00000000-0000-4000-8000-000000000001";
const COMPETENCIA = "c0000000-0000-4000-8000-000000000001";

const pregunta = (peso_porcentual) => ({ texto: "Pregunta", peso_porcentual, es_obligatoria: true, id_escala: LIKERT });
const seccion = (preguntas) => ({
  id_competencia: COMPETENCIA,
  competencia: "Productividad",
  criterios: [{ nombre: "Metas", preguntas }],
});
const datos = (preguntas) => ({
  nombre: "Cajeros",
  objetivo: "Medir el desempeño de cajeros.",
  id_departamento_destino: AREA,
  vigencia_desde: "2026-01-01",
  vigencia_hasta: "2026-12-31",
  secciones: [seccion(preguntas)],
});

let version;
let estructura;

beforeEach(() => {
  mock.restoreAll();
  version = {
    id_version: ID,
    id_plantilla: PLANTILLA,
    numero_version: 1,
    nombre: "Cajeros",
    id_estado_version: ESTADO_VERSION.BORRADOR,
    estado: "BORRADOR",
    tiene_publicadas: false,
  };
  estructura = [seccion([pregunta(60), pregunta(40)])];
  mock.method(transaccion, "enTransaccion", async (trabajo) => trabajo({}));
  mock.method(modelo, "obtenerVersion", async () => version);
  mock.method(modelo, "obtenerEstructura", async () => estructura);
  mock.method(modelo, "competenciasActivas", async () => new Set([COMPETENCIA]));
  mock.method(modelo, "escalasExistentes", async () => new Set([LIKERT]));
  mock.method(modelo, "replicarEmpleado", async () => {});
  mock.method(modelo, "replicarDepartamento", async () => {});
  mock.method(modelo, "actualizarPlantilla", async () => {});
  mock.method(modelo, "reemplazarEstructura", async () => {});
  mock.method(empleados, "obtenerEmpleado", async (id) => ({ id_empleado: id, nombres: "Ana", apellidos: "Rojas" }));
  mock.method(empleados, "obtenerDepartamento", async (id) => ({ id_departamento: id, nombre: "Cajas" }));
});

const fallaCon = async (promesa, estado, patron) =>
  assert.rejects(promesa, (error) => error.estado === estado && patron.test(error.message));

test("criterio 1: crea la plantilla con su versión 1 en borrador y replica al creador y el área", async () => {
  mock.method(modelo, "crearPlantilla", async () => PLANTILLA);
  const crearVersion = mock.method(modelo, "crearVersion", async () => ID);

  const resultado = await servicio.crear(EMPLEADO, datos([pregunta(70)]));

  assert.equal(modelo.replicarEmpleado.mock.calls[0].arguments[1].id_empleado, EMPLEADO);
  assert.equal(modelo.replicarDepartamento.mock.calls[0].arguments[1].id_departamento, AREA);
  assert.equal(modelo.crearPlantilla.mock.calls[0].arguments[2], EMPLEADO);
  assert.deepEqual(crearVersion.mock.calls[0].arguments.slice(1), [PLANTILLA]);
  const [, id, secciones] = modelo.reemplazarEstructura.mock.calls[0].arguments;
  assert.equal(id, ID);
  assert.equal(secciones[0].criterios[0].preguntas[0].peso_porcentual, 70);
  assert.equal(resultado.datos_editables, true);
  assert.equal(resultado.balance.balanceado, true);
});

test("no crea la plantilla si el creador no es empleado o el área no existe", async () => {
  empleados.obtenerEmpleado.mock.mockImplementation(async () => null);
  await fallaCon(servicio.crear(EMPLEADO, datos([pregunta(100)])), 403, /empleado registrado/);
  empleados.obtenerEmpleado.mock.mockImplementation(async (id) => ({ id_empleado: id, nombres: "A", apellidos: "B" }));
  empleados.obtenerDepartamento.mock.mockImplementation(async () => null);
  await assert.rejects(servicio.crear(EMPLEADO, datos([pregunta(100)])), (error) =>
    error.detalles.some((d) => d.campo === "id_departamento_destino")
  );
});

test("rechaza competencias inactivas y escalas inexistentes", async () => {
  modelo.competenciasActivas.mock.mockImplementation(async () => new Set());
  modelo.escalasExistentes.mock.mockImplementation(async () => new Set());
  await assert.rejects(servicio.actualizar(ID, datos([pregunta(100)])), (error) => {
    const campos = error.detalles.map((d) => d.campo);
    assert.ok(campos.includes("secciones[0].id_competencia"));
    assert.ok(campos.includes("secciones[0].criterios[0].preguntas[0].id_escala"));
    return true;
  });
  assert.equal(modelo.reemplazarEstructura.mock.callCount(), 0);
});

test("informa el cruce de vigencias de una plantilla con el mismo nombre y área", async () => {
  modelo.actualizarPlantilla.mock.mockImplementation(async () => {
    throw Object.assign(new Error("exclusion"), { code: "23P01" });
  });
  await fallaCon(servicio.actualizar(ID, datos([pregunta(100)])), 409, /vigencia que se cruza/);
});

test("criterio 1: guarda la estructura de un borrador y sus datos base", async () => {
  const resultado = await servicio.actualizar(ID, datos([pregunta(70)]));
  assert.equal(modelo.actualizarPlantilla.mock.calls[0].arguments[1], PLANTILLA);
  assert.equal(modelo.reemplazarEstructura.mock.calls[0].arguments[1], ID);
  assert.equal(resultado.secciones[0].peso, 100);
  assert.equal(resultado.secciones[0].criterios[0].peso, 100);
});

test("los datos base quedan fijos cuando la plantilla ya tiene una versión publicada", async () => {
  version.tiene_publicadas = true;
  version.numero_version = 2;
  const resultado = await servicio.actualizar(ID, { secciones: datos([pregunta(100)]).secciones });
  assert.equal(modelo.actualizarPlantilla.mock.callCount(), 0);
  assert.equal(modelo.reemplazarEstructura.mock.callCount(), 1);
  assert.equal(resultado.datos_editables, false);
});

test("criterio 2: impide publicar si los pesos no suman 100 y muestra el desbalance", async () => {
  estructura = [seccion([pregunta(60), pregunta(25)])];
  const publicar = mock.method(modelo, "publicar", async () => {});
  await assert.rejects(servicio.publicar(EMPLEADO, ID), (error) => {
    assert.equal(error.estado, 422);
    const [detalle] = error.detalles;
    assert.equal(detalle.campo, "pesos");
    assert.equal(detalle.suma, 85);
    assert.equal(detalle.diferencia, 15);
    assert.match(detalle.mensaje, /faltan 15 %/);
    return true;
  });
  assert.equal(publicar.mock.callCount(), 0);
});

test("criterio 2: impide publicar si los pesos superan 100", async () => {
  estructura = [seccion([pregunta(60), pregunta(50)])];
  await assert.rejects(servicio.publicar(EMPLEADO, ID), (error) => error.estado === 422 && /sobran 10 %/.test(error.detalles[0].mensaje));
});

test("criterio 2: publica cuando la suma es exactamente 100 y registra a quien publica", async () => {
  const publicar = mock.method(modelo, "publicar", async () => {
    version = { ...version, id_estado_version: ESTADO_VERSION.PUBLICADA, estado: "PUBLICADA" };
  });
  const resultado = await servicio.publicar(EMPLEADO, ID);
  assert.deepEqual(publicar.mock.calls[0].arguments.slice(1), [ID, PLANTILLA, EMPLEADO]);
  assert.equal(modelo.replicarEmpleado.mock.calls[0].arguments[1].id_empleado, EMPLEADO);
  assert.equal(resultado.estado, "PUBLICADA");
  assert.equal(resultado.datos_editables, false);
});

test("impide publicar una plantilla sin preguntas, con una sección o un criterio vacío", async () => {
  estructura = [];
  await fallaCon(servicio.publicar(EMPLEADO, ID), 422, /no tiene preguntas/);
  estructura = [seccion([pregunta(100)]), { competencia: "Actitud", criterios: [] }];
  await fallaCon(servicio.publicar(EMPLEADO, ID), 422, /«Actitud» no tiene criterios/);
  estructura = [{ competencia: "Actitud", criterios: [{ nombre: "Trato", preguntas: [pregunta(100)] }, { nombre: "Respeto", preguntas: [] }] }];
  await fallaCon(servicio.publicar(EMPLEADO, ID), 422, /«Respeto» no tiene preguntas/);
});

test("criterio 4: una versión publicada no admite cambios en preguntas ni pesos", async () => {
  version.id_estado_version = ESTADO_VERSION.PUBLICADA;
  await fallaCon(servicio.actualizar(ID, datos([pregunta(100)])), 409, /Cree una nueva versión/);
  assert.equal(modelo.reemplazarEstructura.mock.callCount(), 0);
  assert.equal(modelo.actualizarPlantilla.mock.callCount(), 0);
});

test("criterio 4: una versión publicada no se puede eliminar ni volver a publicar", async () => {
  version.id_estado_version = ESTADO_VERSION.PUBLICADA;
  await fallaCon(servicio.eliminar(ID), 409, /Solo se pueden eliminar versiones en borrador/);
  await fallaCon(servicio.publicar(EMPLEADO, ID), 409, /ya fue publicada/);
});

test("criterio 4: crea una nueva versión en borrador con la estructura de la publicada", async () => {
  version.id_estado_version = ESTADO_VERSION.PUBLICADA;
  mock.method(modelo, "obtenerBorrador", async () => undefined);
  mock.method(modelo, "siguienteNumero", async () => 2);
  const crearVersion = mock.method(modelo, "crearVersion", async () => ID_NUEVA);

  const { creada } = await servicio.crearVersion(ID);

  assert.equal(creada, true);
  assert.deepEqual(crearVersion.mock.calls[0].arguments.slice(1), [PLANTILLA, 2]);
  const [, id, secciones] = modelo.reemplazarEstructura.mock.calls[0].arguments;
  assert.equal(id, ID_NUEVA);
  assert.equal(secciones, estructura);
});

test("criterio 4: si la plantilla ya tiene un borrador, lo reutiliza", async () => {
  version.id_estado_version = ESTADO_VERSION.ARCHIVADA;
  mock.method(modelo, "obtenerBorrador", async () => ({ id_version: ID_NUEVA }));
  const crearVersion = mock.method(modelo, "crearVersion", async () => ID_NUEVA);

  const { creada } = await servicio.crearVersion(ID);

  assert.equal(creada, false);
  assert.equal(crearVersion.mock.callCount(), 0);
});

test("no crea versiones a partir de un borrador", async () => {
  await fallaCon(servicio.crearVersion(ID), 409, /todavía es un borrador/);
});

test("responde 404 ante identificadores inválidos o inexistentes", async () => {
  await fallaCon(servicio.obtener("no-es-uuid"), 404, /no encontrada/);
  version = undefined;
  await fallaCon(servicio.publicar(EMPLEADO, ID), 404, /no encontrada/);
});

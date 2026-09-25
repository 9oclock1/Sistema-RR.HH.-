const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/marcajes.model");
const empleados = require("../src/services/empleados.service");
const servicio = require("../src/services/marcajes.service");
const { ORIGEN_MARCAJE, TIPO_MARCAJE } = require("../src/utils/marcajes");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const entradaDeAna = {
  id_empleado: ANA,
  tipo_codigo: "ENTRADA",
  fecha_hora_marcaje: new Date("2026-09-24T12:03:00Z"),
};

let registrar;

beforeEach(() => {
  mock.restoreAll();
  mock.method(empleados, "obtener", async (id) => (id === ANA ? { nombres: "Ana", apellidos: "Quispe", activo: true } : null));
  mock.method(modelo, "listarDeHoy", async () => []);
  mock.method(modelo, "fechaJornadaActual", async () => "2026-09-24");
  registrar = mock.method(modelo, "registrar", async (datos) => ({ ...entradaDeAna, ...datos }));
});

test("registra la entrada del portal con el tipo y origen correctos", async () => {
  await servicio.registrarEntrada(ANA);
  assert.deepEqual(registrar.mock.calls[0].arguments[0], {
    idEmpleado: ANA,
    idTipo: TIPO_MARCAJE.ENTRADA,
    idOrigen: ORIGEN_MARCAJE.PORTAL,
    codigoDispositivo: undefined,
  });
});

test("no consulta EmployeeService ni guarda si el identificador no es UUID", async () => {
  await assert.rejects(servicio.registrarEntrada("abc"), { estado: 403 });
  assert.equal(empleados.obtener.mock.callCount(), 0);
  assert.equal(registrar.mock.callCount(), 0);
});

test("no guarda la entrada de un empleado inactivo", async () => {
  empleados.obtener.mock.mockImplementation(async () => ({ activo: false }));
  await assert.rejects(servicio.registrarEntrada(ANA), { estado: 403 });
  assert.equal(registrar.mock.callCount(), 0);
});

test("rechaza la segunda entrada de la jornada sin guardarla", async () => {
  modelo.listarDeHoy.mock.mockImplementation(async () => [entradaDeAna]);
  await assert.rejects(servicio.registrarEntrada(ANA), {
    estado: 409,
    message: "Ya registró su entrada de hoy a las 08:03.",
  });
  assert.equal(registrar.mock.callCount(), 0);
});

test("dos marcajes simultáneos: el que choca con la restricción única recibe 409", async () => {
  let consultas = 0;
  modelo.listarDeHoy.mock.mockImplementation(async () => (consultas++ === 0 ? [] : [entradaDeAna]));
  registrar.mock.mockImplementation(async () => {
    throw Object.assign(new Error("duplicate key"), { code: "23505" });
  });
  await assert.rejects(servicio.registrarEntrada(ANA), {
    estado: 409,
    message: "Ya registró su entrada de hoy a las 08:03.",
  });
});

test("otros errores de base de datos no se ocultan como duplicado", async () => {
  registrar.mock.mockImplementation(async () => {
    throw Object.assign(new Error("fallo"), { code: "08006" });
  });
  await assert.rejects(servicio.registrarEntrada(ANA), { code: "08006" });
});

test("la consulta de jornada devuelve la hora de ingreso registrada", async () => {
  modelo.listarDeHoy.mock.mockImplementation(async () => [entradaDeAna]);
  const jornada = await servicio.consultarJornada(ANA);
  assert.equal(jornada.fecha_jornada, "2026-09-24");
  assert.deepEqual(jornada.empleado, { id_empleado: ANA, nombres: "Ana", apellidos: "Quispe" });
  assert.equal(jornada.entrada, entradaDeAna);
});

test("la consulta de jornada sin marcaje devuelve entrada nula", async () => {
  assert.equal((await servicio.consultarJornada(ANA)).entrada, null);
});

test("el marcaje biométrico usa el mismo registro con origen y dispositivo", async () => {
  await servicio.registrarEntradaBiometrica({ id_empleado: ` ${ANA.toUpperCase()} ` }, "BIO-01");
  assert.deepEqual(registrar.mock.calls[0].arguments[0], {
    idEmpleado: ANA,
    idTipo: TIPO_MARCAJE.ENTRADA,
    idOrigen: ORIGEN_MARCAJE.BIOMETRICO,
    codigoDispositivo: "BIO-01",
  });
});

test("el marcaje biométrico exige el identificador del empleado", async () => {
  for (const cuerpo of [undefined, {}, { id_empleado: "  " }, { id_empleado: 123 }]) {
    await assert.rejects(servicio.registrarEntradaBiometrica(cuerpo, "BIO-01"), { estado: 400 });
  }
  assert.equal(registrar.mock.callCount(), 0);
});

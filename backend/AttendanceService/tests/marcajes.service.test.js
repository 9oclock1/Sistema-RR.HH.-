const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/marcajes.model");
const empleados = require("../src/services/empleados.service");
const servicio = require("../src/services/marcajes.service");
const { ORIGEN_MARCAJE, TIPO_MARCAJE, ESTADO_MARCAJE } = require("../src/utils/marcajes");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const entradaDeAna = {
  id_empleado: ANA,
  tipo_codigo: "ENTRADA",
  fecha_jornada: "2026-09-24",
  fecha_hora_marcaje: new Date("2026-09-24T12:03:00Z"),
};

let registrar;

beforeEach(() => {
  mock.restoreAll();
  mock.method(empleados, "obtener", async (id) => (id === ANA ? { nombres: "Ana", apellidos: "Quispe", activo: true } : null));
  mock.method(modelo, "listarRecientes", async () => []);
  mock.method(modelo, "momentoActual", async () => ({ ahora: new Date("2026-09-24T21:10:00Z"), hoy: "2026-09-24" }));
  registrar = mock.method(modelo, "registrar", async (datos) => ({ ...entradaDeAna, ...datos }));
});

test("registra la entrada del portal con el tipo y origen correctos", async () => {
  await servicio.registrarEntrada(ANA);
  assert.deepEqual(registrar.mock.calls[0].arguments[0], {
    idEmpleado: ANA,
    idTipo: TIPO_MARCAJE.ENTRADA,
    idOrigen: ORIGEN_MARCAJE.PORTAL,
    idEstado: ESTADO_MARCAJE.REGISTRADO,
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
  modelo.listarRecientes.mock.mockImplementation(async () => [entradaDeAna]);
  await assert.rejects(servicio.registrarEntrada(ANA), {
    estado: 409,
    message: "Ya registró su entrada de hoy a las 08:03.",
  });
  assert.equal(registrar.mock.callCount(), 0);
});

test("dos marcajes simultáneos: el que choca con la restricción única recibe 409", async () => {
  let consultas = 0;
  modelo.listarRecientes.mock.mockImplementation(async () => (consultas++ === 0 ? [] : [entradaDeAna]));
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
  modelo.listarRecientes.mock.mockImplementation(async () => [entradaDeAna]);
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
    idEstado: ESTADO_MARCAJE.REGISTRADO,
    codigoDispositivo: "BIO-01",
  });
});

test("el marcaje biométrico exige el identificador del empleado", async () => {
  for (const cuerpo of [undefined, {}, { id_empleado: "  " }, { id_empleado: 123 }]) {
    await assert.rejects(servicio.registrarEntradaBiometrica(cuerpo, "BIO-01"), { estado: 400 });
  }
  assert.equal(registrar.mock.callCount(), 0);
});

const salidaDeAna = {
  id_empleado: ANA,
  tipo_codigo: "SALIDA",
  estado_codigo: "REGISTRADO",
  fecha_jornada: "2026-09-24",
  fecha_hora_marcaje: new Date("2026-09-24T21:10:30Z"),
};
const conMarcajes = (...marcajes) => modelo.listarRecientes.mock.mockImplementation(async () => marcajes);
const devolver = (fila) => registrar.mock.mockImplementation(async () => fila);

test("registra la salida con la entrada de la jornada y calcula las horas trabajadas", async () => {
  conMarcajes(entradaDeAna);
  devolver(salidaDeAna);
  const resumen = await servicio.registrarSalida(ANA);
  assert.deepEqual(registrar.mock.calls[0].arguments[0], {
    idEmpleado: ANA,
    idTipo: TIPO_MARCAJE.SALIDA,
    idOrigen: ORIGEN_MARCAJE.PORTAL,
    idEstado: ESTADO_MARCAJE.REGISTRADO,
    codigoDispositivo: undefined,
    fechaJornada: "2026-09-24",
  });
  assert.equal(resumen.entrada, entradaDeAna);
  assert.equal(resumen.salida, salidaDeAna);
  assert.equal(resumen.minutos_trabajados, 547);
  assert.equal(resumen.inconsistencia, null);
});

test("turno nocturno: la salida cierra la jornada del día anterior", async () => {
  const entradaNocturna = {
    ...entradaDeAna,
    fecha_jornada: "2026-09-23",
    fecha_hora_marcaje: new Date("2026-09-24T02:00:00Z"),
  };
  modelo.momentoActual.mock.mockImplementation(async () => ({ ahora: new Date("2026-09-24T10:00:00Z"), hoy: "2026-09-24" }));
  conMarcajes(entradaNocturna);
  devolver({ ...salidaDeAna, fecha_jornada: "2026-09-23", fecha_hora_marcaje: new Date("2026-09-24T10:00:00Z") });
  const resumen = await servicio.registrarSalida(ANA);
  assert.equal(registrar.mock.calls[0].arguments[0].fechaJornada, "2026-09-23");
  assert.equal(resumen.fecha_jornada, "2026-09-23");
  assert.equal(resumen.minutos_trabajados, 480);
});

test("salida sin entrada: se guarda pendiente de justificación e informa la inconsistencia", async () => {
  devolver({ ...salidaDeAna, estado_codigo: "PENDIENTE_JUSTIFICACION" });
  const resumen = await servicio.registrarSalida(ANA);
  const datos = registrar.mock.calls[0].arguments[0];
  assert.equal(datos.idEstado, ESTADO_MARCAJE.PENDIENTE_JUSTIFICACION);
  assert.equal(datos.fechaJornada, "2026-09-24");
  assert.equal(resumen.entrada, null);
  assert.equal(resumen.minutos_trabajados, null);
  assert.equal(
    resumen.inconsistencia,
    "No tiene entrada registrada en la jornada. La salida quedó pendiente de justificación."
  );
});

test("rechaza la segunda salida de la jornada sin guardarla", async () => {
  conMarcajes(entradaDeAna, salidaDeAna);
  await assert.rejects(servicio.registrarSalida(ANA), {
    estado: 409,
    message: "Ya registró su salida de hoy a las 17:10.",
  });
  assert.equal(registrar.mock.callCount(), 0);
});

test("rechaza repetir una salida pendiente de justificación", async () => {
  conMarcajes({ ...salidaDeAna, estado_codigo: "PENDIENTE_JUSTIFICACION" });
  await assert.rejects(servicio.registrarSalida(ANA), { estado: 409 });
  assert.equal(registrar.mock.callCount(), 0);
});

test("turno nocturno: repetir la salida después de medianoche no crea otra", async () => {
  const entradaNocturna = { ...entradaDeAna, fecha_jornada: "2026-09-23", fecha_hora_marcaje: new Date("2026-09-24T02:00:00Z") };
  const salidaNocturna = { ...salidaDeAna, fecha_jornada: "2026-09-23", fecha_hora_marcaje: new Date("2026-09-24T10:00:00Z") };
  modelo.momentoActual.mock.mockImplementation(async () => ({ ahora: new Date("2026-09-24T10:05:00Z"), hoy: "2026-09-24" }));
  conMarcajes(entradaNocturna, salidaNocturna);
  await assert.rejects(servicio.registrarSalida(ANA), {
    estado: 409,
    message: "Ya registró su salida de hoy a las 06:00.",
  });
  assert.equal(registrar.mock.callCount(), 0);
});

test("rechaza la entrada después de una salida en la misma jornada", async () => {
  conMarcajes({ ...salidaDeAna, estado_codigo: "PENDIENTE_JUSTIFICACION" });
  await assert.rejects(servicio.registrarEntrada(ANA), {
    estado: 409,
    message: "La jornada ya está cerrada: registró su salida a las 17:10.",
  });
  assert.equal(registrar.mock.callCount(), 0);
});

test("dos salidas simultáneas: la que choca con la restricción única recibe 409", async () => {
  let consultas = 0;
  modelo.listarRecientes.mock.mockImplementation(async () =>
    consultas++ === 0 ? [entradaDeAna] : [entradaDeAna, salidaDeAna]
  );
  registrar.mock.mockImplementation(async () => {
    throw Object.assign(new Error("duplicate key"), { code: "23505" });
  });
  await assert.rejects(servicio.registrarSalida(ANA), {
    estado: 409,
    message: "Ya registró su salida de hoy a las 17:10.",
  });
});

test("no guarda la salida de un empleado inactivo", async () => {
  empleados.obtener.mock.mockImplementation(async () => ({ activo: false }));
  await assert.rejects(servicio.registrarSalida(ANA), { estado: 403 });
  assert.equal(registrar.mock.callCount(), 0);
});

test("la salida biométrica usa el mismo registro con origen y dispositivo", async () => {
  conMarcajes(entradaDeAna);
  devolver(salidaDeAna);
  await servicio.registrarSalidaBiometrica({ id_empleado: ANA }, "BIO-01");
  const datos = registrar.mock.calls[0].arguments[0];
  assert.equal(datos.idTipo, TIPO_MARCAJE.SALIDA);
  assert.equal(datos.idOrigen, ORIGEN_MARCAJE.BIOMETRICO);
  assert.equal(datos.codigoDispositivo, "BIO-01");
});

test("la salida biométrica exige el identificador del empleado", async () => {
  await assert.rejects(servicio.registrarSalidaBiometrica({}, "BIO-01"), { estado: 400 });
  assert.equal(registrar.mock.callCount(), 0);
});

test("la consulta de jornada muestra entrada, salida y horas trabajadas", async () => {
  conMarcajes(entradaDeAna, salidaDeAna);
  const jornada = await servicio.consultarJornada(ANA);
  assert.equal(jornada.entrada, entradaDeAna);
  assert.equal(jornada.salida, salidaDeAna);
  assert.equal(jornada.minutos_trabajados, 547);
  assert.equal(jornada.inconsistencia, null);
});

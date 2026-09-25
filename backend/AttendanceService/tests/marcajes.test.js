const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  verificarEmpleadoActivo,
  entradaDuplicada,
  salidaDuplicada,
  jornadaCerrada,
  describirInconsistencia,
  esEntrada,
  esSalida,
  jornadaEnCurso,
  salidaRegistrada,
} = require("../src/utils/marcajes");
const { horaBolivia } = require("../src/utils/jornada");
const { leerDispositivos } = require("../src/utils/dispositivos");

const rechazo = (estado, mensaje) => (error) => error.estado === estado && error.message === mensaje;

test("empleado activo puede marcar", () => {
  const empleado = { id_empleado: "x", activo: true };
  assert.equal(verificarEmpleadoActivo(empleado), empleado);
});

test("usuario sin empleado registrado es rechazado con motivo", () => {
  assert.throws(
    () => verificarEmpleadoActivo(null),
    rechazo(403, "El usuario no corresponde a un empleado registrado.")
  );
});

test("empleado inactivo es rechazado con motivo", () => {
  const motivo = "El empleado no está activo, por lo que no puede registrar marcajes.";
  assert.throws(() => verificarEmpleadoActivo({ activo: false }), rechazo(403, motivo));
  assert.throws(() => verificarEmpleadoActivo({}), rechazo(403, motivo));
});

test("el duplicado informa la hora de la entrada existente", () => {
  const error = entradaDuplicada({ fecha_hora_marcaje: new Date("2026-09-24T12:03:00Z") });
  assert.equal(error.estado, 409);
  assert.equal(error.message, "Ya registró su entrada de hoy a las 08:03.");
});

test("el duplicado sin marcaje disponible no muestra hora", () => {
  assert.equal(entradaDuplicada(undefined).message, "Ya registró su entrada de hoy.");
});

test("hora de Bolivia es UTC-4 y cambia de día a las 04:00 UTC", () => {
  assert.equal(horaBolivia(new Date("2026-09-25T03:59:00Z")), "23:59");
  assert.equal(horaBolivia(new Date("2026-09-25T04:00:00Z")), "00:00");
});

test("identifica marcajes de entrada", () => {
  assert.equal(esEntrada({ tipo_codigo: "ENTRADA" }), true);
  assert.equal(esEntrada({ tipo_codigo: "SALIDA" }), false);
});

test("lee dispositivos biométricos con su clave", () => {
  const dispositivos = leerDispositivos(" BIO-01 : clave1 ,BIO-02:cla:ve2");
  assert.deepEqual([...dispositivos], [
    ["clave1", "BIO-01"],
    ["cla:ve2", "BIO-02"],
  ]);
});

test("ignora dispositivos mal configurados", () => {
  assert.equal(leerDispositivos("sin-separador,:clave,BIO-03:").size, 0);
  assert.equal(leerDispositivos(undefined).size, 0);
});

const marcaje = (tipo_codigo, fecha_jornada, fechaHora) => ({
  tipo_codigo,
  fecha_jornada,
  fecha_hora_marcaje: new Date(fechaHora),
});
const momento = (fechaHora, hoy = "2026-09-24") => ({ hoy, ahora: new Date(fechaHora) });
const entradaNocturna = marcaje("ENTRADA", "2026-09-23", "2026-09-23T22:00:00-04:00");

test("identifica marcajes de salida", () => {
  assert.equal(esSalida({ tipo_codigo: "SALIDA" }), true);
  assert.equal(esSalida({ tipo_codigo: "ENTRADA" }), false);
});

test("la jornada en curso es la de hoy con su entrada y salida", () => {
  const entrada = marcaje("ENTRADA", "2026-09-24", "2026-09-24T08:03:00-04:00");
  const salida = marcaje("SALIDA", "2026-09-24", "2026-09-24T17:10:00-04:00");
  assert.deepEqual(jornadaEnCurso([entrada, salida], momento("2026-09-24T18:00:00-04:00")), {
    fecha_jornada: "2026-09-24",
    entrada,
    salida,
  });
});

test("turno nocturno: la jornada anterior abierta sigue en curso después de medianoche", () => {
  const jornada = jornadaEnCurso([entradaNocturna], momento("2026-09-24T06:00:00-04:00"));
  assert.equal(jornada.fecha_jornada, "2026-09-23");
  assert.equal(jornada.entrada, entradaNocturna);
});

test("la jornada anterior abierta deja de estar en curso a las 16 horas", () => {
  const jornada = jornadaEnCurso([entradaNocturna], momento("2026-09-24T14:00:00-04:00"));
  assert.deepEqual(jornada, { fecha_jornada: "2026-09-24", entrada: null, salida: null });
});

test("la jornada anterior ya cerrada no está en curso", () => {
  const salida = marcaje("SALIDA", "2026-09-23", "2026-09-24T06:00:00-04:00");
  const jornada = jornadaEnCurso([entradaNocturna, salida], momento("2026-09-24T06:05:00-04:00"));
  assert.equal(jornada.fecha_jornada, "2026-09-24");
});

test("los marcajes de hoy prevalecen sobre una jornada anterior abierta", () => {
  const entradaHoy = marcaje("ENTRADA", "2026-09-24", "2026-09-24T01:00:00-04:00");
  const jornada = jornadaEnCurso([entradaNocturna, entradaHoy], momento("2026-09-24T02:00:00-04:00"));
  assert.equal(jornada.entrada, entradaHoy);
});

test("la salida de la jornada en curso impide otra salida", () => {
  const salida = marcaje("SALIDA", "2026-09-24", "2026-09-24T17:10:00-04:00");
  assert.equal(salidaRegistrada({ entrada: null, salida }, [salida], new Date()), salida);
});

test("con entrada abierta no hay salida previa", () => {
  const salidaAnterior = marcaje("SALIDA", "2026-09-23", "2026-09-24T06:00:00-04:00");
  const jornada = { entrada: marcaje("ENTRADA", "2026-09-24", "2026-09-24T22:00:00-04:00"), salida: null };
  assert.equal(salidaRegistrada(jornada, [salidaAnterior], new Date("2026-09-24T23:00:00-04:00")), null);
});

test("sin entrada abierta, una salida de hace menos de 8 horas cuenta como registrada", () => {
  const salida = marcaje("SALIDA", "2026-09-23", "2026-09-24T06:00:00-04:00");
  const vacia = { entrada: null, salida: null };
  assert.equal(salidaRegistrada(vacia, [salida], new Date("2026-09-24T06:05:00-04:00")), salida);
  assert.equal(salidaRegistrada(vacia, [salida], new Date("2026-09-24T14:00:00-04:00")), null);
});

test("la salida duplicada informa la hora de la salida existente", () => {
  const error = salidaDuplicada({ fecha_hora_marcaje: new Date("2026-09-24T21:10:00Z") });
  assert.equal(error.estado, 409);
  assert.equal(error.message, "Ya registró su salida de hoy a las 17:10.");
});

test("una entrada tras la salida informa que la jornada está cerrada", () => {
  const error = jornadaCerrada({ fecha_hora_marcaje: new Date("2026-09-24T21:10:00Z") });
  assert.equal(error.estado, 409);
  assert.equal(error.message, "La jornada ya está cerrada: registró su salida a las 17:10.");
});

test("solo la salida pendiente de justificación describe una inconsistencia", () => {
  assert.match(describirInconsistencia({ estado_codigo: "PENDIENTE_JUSTIFICACION" }), /pendiente de justificación/);
  assert.equal(describirInconsistencia({ estado_codigo: "REGISTRADO" }), null);
  assert.equal(describirInconsistencia(null), null);
});

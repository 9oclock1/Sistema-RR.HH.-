const { test } = require("node:test");
const assert = require("node:assert/strict");
const { verificarEmpleadoActivo, entradaDuplicada, esEntrada } = require("../src/utils/marcajes");
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

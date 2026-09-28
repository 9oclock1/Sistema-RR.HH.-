const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarTurno } = require("../src/utils/validarTurno");

const valido = {
  nombre: "Mañana",
  id_tipo_jornada: 1,
  hora_inicio: "08:00",
  hora_fin: "16:00",
  minutos_refrigerio: 60,
  minutos_tolerancia: 5,
};

const rechaza = (datos, campo) =>
  assert.throws(
    () => validarTurno(datos),
    (error) => error.estado === 400 && error.detalles.some((detalle) => detalle.campo === campo)
  );

test("acepta un turno válido y aplica valores por defecto", () => {
  assert.deepEqual(validarTurno({ ...valido, nombre: "  Mañana  ", minutos_refrigerio: undefined, minutos_tolerancia: undefined }), {
    ...valido,
    minutos_refrigerio: 0,
    minutos_tolerancia: 0,
    esta_activo: true,
  });
});

test("acepta horas con segundos en cero", () => {
  assert.equal(validarTurno({ ...valido, hora_inicio: "08:00:00" }).hora_inicio, "08:00");
});

test("acepta un turno nocturno que cruza la medianoche", () => {
  assert.doesNotThrow(() => validarTurno({ ...valido, id_tipo_jornada: 3, hora_inicio: "22:00", hora_fin: "06:00" }));
});

test("rechaza campos requeridos faltantes", () => {
  rechaza({}, "nombre");
  rechaza({}, "id_tipo_jornada");
  rechaza({}, "hora_inicio");
  rechaza({}, "hora_fin");
});

test("rechaza horas con formato inválido", () => {
  rechaza({ ...valido, hora_inicio: "8:00" }, "hora_inicio");
  rechaza({ ...valido, hora_fin: "24:00" }, "hora_fin");
  rechaza({ ...valido, hora_fin: "16:00:30" }, "hora_fin");
});

test("rechaza hora de inicio igual a la de fin", () => {
  rechaza({ ...valido, hora_fin: "08:00" }, "hora_fin");
});

test("rechaza minutos negativos o no enteros", () => {
  rechaza({ ...valido, minutos_refrigerio: -1 }, "minutos_refrigerio");
  rechaza({ ...valido, minutos_tolerancia: 2.5 }, "minutos_tolerancia");
  rechaza({ ...valido, minutos_tolerancia: "5" }, "minutos_tolerancia");
});

test("rechaza refrigerio o tolerancia mayores o iguales a la duración", () => {
  rechaza({ ...valido, minutos_refrigerio: 480 }, "minutos_refrigerio");
  rechaza({ ...valido, minutos_tolerancia: 480 }, "minutos_tolerancia");
});

test("rechaza esta_activo no booleano", () => {
  rechaza({ ...valido, esta_activo: "si" }, "esta_activo");
});

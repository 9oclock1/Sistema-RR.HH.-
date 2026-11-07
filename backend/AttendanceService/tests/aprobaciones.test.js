// KAN-53 (RF-33): reglas puras de la bandeja de aprobaciones.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  calcularPrioridad,
  ordenarBandeja,
  calcularCobertura,
  requiereAutorizacionRrhh,
} = require("../src/utils/aprobaciones");

const HOY = "2026-11-02";

test("prioridad ALTA si empieza en 7 días o menos, o si ya empezó", () => {
  assert.equal(calcularPrioridad({ fechaInicio: "2026-11-09", hoy: HOY }), "ALTA");
  assert.equal(calcularPrioridad({ fechaInicio: "2026-11-02", hoy: HOY }), "ALTA");
  assert.equal(calcularPrioridad({ fechaInicio: "2026-10-28", hoy: HOY }), "ALTA");
});

test("prioridad MEDIA hasta 30 días y BAJA después", () => {
  assert.equal(calcularPrioridad({ fechaInicio: "2026-11-10", hoy: HOY }), "MEDIA");
  assert.equal(calcularPrioridad({ fechaInicio: "2026-12-02", hoy: HOY }), "MEDIA");
  assert.equal(calcularPrioridad({ fechaInicio: "2026-12-03", hoy: HOY }), "BAJA");
});

test("una licencia que exige a RRHH es ALTA aunque falte mucho", () => {
  assert.equal(calcularPrioridad({ fechaInicio: "2027-03-01", hoy: HOY, exigeRrhh: true }), "ALTA");
});

const item = (id, estado, prioridad, fecha, extra = {}) => ({
  id_solicitud: id,
  estado: { codigo: estado },
  prioridad,
  fecha_inicio: fecha,
  creado_en: new Date("2026-10-30T10:00:00Z"),
  ...extra,
});

test("la bandeja pone primero las pendientes por prioridad y fecha, y luego las resueltas más recientes", () => {
  const orden = ordenarBandeja([
    item("baja", "PENDIENTE", "BAJA", "2027-01-10"),
    item("vieja", "APROBADA", null, "2026-09-01", { resuelto_en: "2026-09-02T10:00:00Z" }),
    item("alta-tarde", "PENDIENTE", "ALTA", "2026-11-08"),
    item("reciente", "RECHAZADA", null, "2026-10-01", { resuelto_en: "2026-10-20T10:00:00Z" }),
    item("alta-pronto", "PENDIENTE", "ALTA", "2026-11-03"),
  ]).map((i) => i.id_solicitud);

  assert.deepEqual(orden, ["alta-pronto", "alta-tarde", "baja", "reciente", "vieja"]);
});

test("ordenar no modifica la lista original", () => {
  const original = [item("b", "PENDIENTE", "BAJA", "2027-01-10"), item("a", "PENDIENTE", "ALTA", "2026-11-03")];
  ordenarBandeja(original);
  assert.equal(original[0].id_solicitud, "b");
});

const ausencia = (inicio, fin, estado = "APROBADA") => ({ fecha_inicio: inicio, fecha_fin: fin, estado_codigo: estado });

test("cobertura: sin compañeros ausentes solo falta el solicitante", () => {
  const c = calcularCobertura({ fechaInicio: "2026-11-09", fechaFin: "2026-11-13", equipoTotal: 8, ausencias: [] });
  assert.equal(c.maximo_ausentes_simultaneos, 1);
  assert.equal(c.porcentaje_equipo, 13);
  assert.equal(c.nivel_impacto, "BAJO");
});

test("cobertura: cuenta el máximo de ausentes aprobados el mismo día, no la suma de solapes", () => {
  // Dos compañeros ausentes en días distintos del rango: nunca coinciden con más de uno a la vez.
  const c = calcularCobertura({
    fechaInicio: "2026-11-09",
    fechaFin: "2026-11-13",
    equipoTotal: 4,
    ausencias: [ausencia("2026-11-09", "2026-11-10"), ausencia("2026-11-12", "2026-11-13")],
  });
  assert.equal(c.maximo_ausentes_simultaneos, 2);
  assert.equal(c.nivel_impacto, "ALTO");
});

test("cobertura: ausentes que coinciden el mismo día suben el máximo y el nivel", () => {
  const c = calcularCobertura({
    fechaInicio: "2026-11-09",
    fechaFin: "2026-11-13",
    equipoTotal: 5,
    ausencias: [ausencia("2026-11-10", "2026-11-12"), ausencia("2026-11-11", "2026-11-11")],
  });
  assert.equal(c.maximo_ausentes_simultaneos, 3);
  assert.equal(c.porcentaje_equipo, 60);
  assert.equal(c.nivel_impacto, "ALTO");
});

test("cobertura: las pendientes no restan cobertura segura pero se informan aparte", () => {
  const c = calcularCobertura({
    fechaInicio: "2026-11-09",
    fechaFin: "2026-11-13",
    equipoTotal: 10,
    ausencias: [ausencia("2026-11-09", "2026-11-13", "PENDIENTE")],
  });
  assert.equal(c.maximo_ausentes_simultaneos, 1);
  assert.equal(c.maximo_con_pendientes, 2);
  assert.equal(c.nivel_impacto, "BAJO");
});

test("cobertura: impacto medio entre 25% y 50% del equipo", () => {
  const c = calcularCobertura({
    fechaInicio: "2026-11-09",
    fechaFin: "2026-11-09",
    equipoTotal: 6,
    ausencias: [ausencia("2026-11-09", "2026-11-09")],
  });
  assert.equal(c.porcentaje_equipo, 33);
  assert.equal(c.nivel_impacto, "MEDIO");
});

test("cobertura: sin tamaño de equipo no inventa un porcentaje", () => {
  const c = calcularCobertura({ fechaInicio: "2026-11-09", fechaFin: "2026-11-09", equipoTotal: 0, ausencias: [] });
  assert.equal(c.porcentaje_equipo, null);
  assert.equal(c.nivel_impacto, "SIN_DATOS");
});

test("cobertura: un rango muy largo no recorre más de 92 días", () => {
  const c = calcularCobertura({ fechaInicio: "2026-01-01", fechaFin: "2030-01-01", equipoTotal: 3, ausencias: [] });
  assert.equal(c.maximo_ausentes_simultaneos, 1);
});

test("una licencia sobre su tope solo la aprueba gerente o RRHH; el rechazo es libre", () => {
  const excedida = { excede_limite_dias: true };
  assert.equal(requiereAutorizacionRrhh(excedida, "APROBADA", "supervisor"), true);
  assert.equal(requiereAutorizacionRrhh(excedida, "APROBADA", undefined), true);
  assert.equal(requiereAutorizacionRrhh(excedida, "APROBADA", "gerente"), false);
  assert.equal(requiereAutorizacionRrhh(excedida, "APROBADA", "admin"), false);
  assert.equal(requiereAutorizacionRrhh(excedida, "RECHAZADA", "supervisor"), false);
  assert.equal(requiereAutorizacionRrhh({ excede_limite_dias: false }, "APROBADA", "supervisor"), false);
});

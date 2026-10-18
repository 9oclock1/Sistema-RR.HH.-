const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ESTADO_HORAS_EXTRA,
  TIPO_DIA,
  tipoDia,
  maximoAprobable,
  minutosNocturnos,
  minutosMinimosExtra,
  segregarJornada,
  tramosAprobados,
  liquidarJornada,
  estadoInicial,
  calculoDesdeFila,
} = require("../src/utils/horasExtra");

const bo = (fechaHora) => new Date(`${fechaHora}:00-04:00`);
const min = (fechaHora) => Math.floor(bo(fechaHora).getTime() / 60000);
const turno = (fecha, inicio, fechaFin, fin, refrigerio = 0) => ({
  inicioProgramado: bo(`${fecha}T${inicio}`),
  finProgramado: bo(`${fechaFin}T${fin}`),
  minutosRefrigerio: refrigerio,
});
const jornada = (entrada, salida, programado = {}) => ({ entrada: bo(entrada), salida: bo(salida), ...programado });

test("franja nocturna: de 20:00 a 06:00 de Bolivia", () => {
  assert.equal(minutosNocturnos(min("2026-10-05T19:00"), min("2026-10-05T21:00")), 60);
  assert.equal(minutosNocturnos(min("2026-10-06T05:00"), min("2026-10-06T07:00")), 60);
  assert.equal(minutosNocturnos(min("2026-10-05T22:00"), min("2026-10-06T06:00")), 480);
  assert.equal(minutosNocturnos(min("2026-10-05T08:00"), min("2026-10-05T19:59")), 0);
  assert.equal(minutosNocturnos(min("2026-10-05T00:00"), min("2026-10-06T00:00")), 600);
  assert.equal(minutosNocturnos(min("2026-10-05T10:00"), min("2026-10-05T09:00")), 0);
});

test("turno diurno con salida tardía: el tiempo después del fin es extra", () => {
  const calculo = segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T18:00", turno("2026-10-05", "08:00", "2026-10-05", "16:00", 60)));
  assert.equal(calculo.minutos_trabajados, 600);
  assert.equal(calculo.minutos_ordinarios, 420);
  assert.equal(calculo.minutos_ordinarios_nocturnos, 0);
  assert.equal(calculo.minutos_extra, 120);
  assert.equal(calculo.minutos_anticipados, 0);
});

test("el tiempo antes del inicio queda aparte como anticipado", () => {
  const calculo = segregarJornada(jornada("2026-10-05T07:00", "2026-10-05T16:00", turno("2026-10-05", "08:00", "2026-10-05", "16:00", 60)));
  assert.equal(calculo.minutos_ordinarios, 420);
  assert.equal(calculo.minutos_extra, 0);
  assert.equal(calculo.minutos_anticipados, 60);
});

test("sin turno programado todo lo trabajado es extra", () => {
  const calculo = segregarJornada(jornada("2026-10-05T09:00", "2026-10-05T13:30"));
  assert.equal(calculo.minutos_ordinarios, 0);
  assert.equal(calculo.minutos_extra, 270);
});

test("por debajo del mínimo, el tiempo fuera del turno no cuenta como extra", () => {
  const programado = turno("2026-10-05", "08:00", "2026-10-05", "16:00");
  assert.equal(segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T16:14", programado), 15).minutos_extra, 0);
  assert.equal(segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T16:15", programado), 15).minutos_extra, 15);
});

test("mínimo de minutos extra configurable, 15 por defecto", () => {
  const anterior = process.env.MINUTOS_MINIMOS_EXTRA;
  delete process.env.MINUTOS_MINIMOS_EXTRA;
  assert.equal(minutosMinimosExtra(), 15);
  process.env.MINUTOS_MINIMOS_EXTRA = "0";
  assert.equal(minutosMinimosExtra(), 0);
  process.env.MINUTOS_MINIMOS_EXTRA = "abc";
  assert.equal(minutosMinimosExtra(), 15);
  if (anterior === undefined) delete process.env.MINUTOS_MINIMOS_EXTRA;
  else process.env.MINUTOS_MINIMOS_EXTRA = anterior;
});

test("tipo de día: domingo, feriado o hábil; un feriado en domingo es domingo", () => {
  assert.equal(tipoDia("2026-10-18"), TIPO_DIA.DOMINGO);
  assert.equal(tipoDia("2026-10-19"), TIPO_DIA.HABIL);
  assert.equal(tipoDia("2026-11-02", true), TIPO_DIA.FERIADO);
  assert.equal(tipoDia("2026-06-21", true), TIPO_DIA.DOMINGO);
});

test("en día hábil se pagan como máximo 2 horas extra; el resto no cuenta", () => {
  const calculo = segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T19:30", turno("2026-10-05", "08:00", "2026-10-05", "16:00", 60)));
  assert.equal(maximoAprobable(calculo), 120);
  const pago = liquidarJornada(calculo, { aprobados: 210 });
  assert.equal(pago.minutos_extra_pagables, 120);
  assert.equal(pago.minutos_extra_habil, 120);
  assert.equal(pago.minutos_feriado, 0);
  assert.equal(pago.minutos_domingo, 0);
});

test("sin aprobación no se paga ninguna hora extra", () => {
  const calculo = segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T19:00", turno("2026-10-05", "08:00", "2026-10-05", "16:00")));
  assert.deepEqual(liquidarJornada(calculo), {
    minutos_extra_pagables: 0,
    minutos_extra_habil: 0,
    minutos_extra_domingo: 0,
    minutos_extra_feriado: 0,
    minutos_domingo: 0,
    minutos_feriado: 0,
    minutos_descanso: 0,
    minutos_extra_nocturnos: 0,
    minutos_nocturnos: 0,
  });
});

test("en feriado lo ordinario y las extra van en columnas separadas", () => {
  const calculo = segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T17:00", turno("2026-10-05", "08:00", "2026-10-05", "16:00", 60)));
  const pago = liquidarJornada(calculo, { aprobados: 60, tipoDia: TIPO_DIA.FERIADO });
  assert.equal(pago.minutos_feriado, 420);
  assert.equal(pago.minutos_extra_feriado, 60);
  assert.equal(pago.minutos_extra_habil, 0);
});

test("en domingo lo ordinario y las extra van aparte, aunque no se apruebe extra", () => {
  const calculo = segregarJornada(jornada("2026-10-04T08:00", "2026-10-04T17:00", turno("2026-10-04", "08:00", "2026-10-04", "16:00", 60)));
  const pago = liquidarJornada(calculo, { aprobados: 60, tipoDia: TIPO_DIA.DOMINGO });
  assert.equal(pago.minutos_domingo, 420);
  assert.equal(pago.minutos_extra_domingo, 60);
  assert.equal(pago.minutos_extra_habil, 0);
  assert.equal(liquidarJornada(calculo, { tipoDia: TIPO_DIA.DOMINGO }).minutos_domingo, 420);
});

test("sin turno: las primeras 8 h aprobadas son la jornada del día y luego hasta 2 h extra", () => {
  const calculo = segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T19:00"));
  assert.equal(calculo.minutos_extra, 660);
  assert.equal(maximoAprobable(calculo), 600);
  const habil = liquidarJornada(calculo, { aprobados: 660 });
  assert.equal(habil.minutos_extra_pagables, 600);
  assert.equal(habil.minutos_descanso, 480);
  assert.equal(habil.minutos_extra_habil, 120);
  const domingo = liquidarJornada(calculo, { aprobados: 300, tipoDia: TIPO_DIA.DOMINGO });
  assert.equal(domingo.minutos_domingo, 300);
  assert.equal(domingo.minutos_extra_domingo, 0);
  assert.equal(domingo.minutos_descanso, 0);
  const feriado = liquidarJornada(calculo, { aprobados: 540, tipoDia: TIPO_DIA.FERIADO });
  assert.equal(feriado.minutos_feriado, 480);
  assert.equal(feriado.minutos_extra_feriado, 60);
});

test("lo aprobado se toma primero después del turno y luego del tiempo anticipado", () => {
  const calculo = segregarJornada(jornada("2026-10-05T07:00", "2026-10-05T17:00", turno("2026-10-05", "08:00", "2026-10-05", "16:00")));
  assert.deepEqual(tramosAprobados(calculo, 90), [
    [min("2026-10-05T16:00"), min("2026-10-05T17:00")],
    [min("2026-10-05T07:30"), min("2026-10-05T08:00")],
  ]);
  assert.equal(liquidarJornada(calculo, { aprobados: 500 }).minutos_extra_pagables, 120);
});

test("estado inicial: sin tiempo fuera del turno no hay nada que revisar", () => {
  const programado = turno("2026-10-05", "08:00", "2026-10-05", "16:00");
  assert.equal(estadoInicial(segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T16:00", programado))).idEstado, ESTADO_HORAS_EXTRA.SIN_EXTRA);
  assert.equal(estadoInicial(segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T17:00", programado))).idEstado, ESTADO_HORAS_EXTRA.PENDIENTE);
});

test("los tramos guardados se rehacen igual que al calcular", () => {
  const programado = turno("2026-10-05", "22:00", "2026-10-06", "06:00", 30);
  const calculo = segregarJornada(jornada("2026-10-05T21:00", "2026-10-06T08:00", programado));
  const fila = {
    entrada_en: bo("2026-10-05T21:00"),
    salida_en: bo("2026-10-06T08:00"),
    inicio_programado: programado.inicioProgramado,
    fin_programado: programado.finProgramado,
    ...calculo,
  };
  const rehecho = calculoDesdeFila(fila);
  assert.deepEqual(rehecho.tramos_extra, calculo.tramos_extra);
  assert.deepEqual(rehecho.tramo_anticipado, calculo.tramo_anticipado);
});

const { validarRevision, validarAutorizacion, MAXIMO_MINUTOS_AUTORIZABLES } = require("../src/utils/horasExtra");
const conExtra = { con_turno: true, minutos_extra: 90, minutos_anticipados: 30 };
const errorEn = (campo) => (e) => e.estado === 400 && e.detalles.some((d) => d.campo === campo);

test("autorización previa: se aprueba sola hasta lo autorizado y el tope de 2 h", () => {
  const calculo = segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T17:30", turno("2026-10-05", "08:00", "2026-10-05", "16:00")));
  assert.deepEqual(estadoInicial(calculo, { minutos_autorizados: 90 }), { idEstado: ESTADO_HORAS_EXTRA.APROBADA, aprobados: 90 });
  assert.deepEqual(estadoInicial(calculo, { minutos_autorizados: 300 }), { idEstado: ESTADO_HORAS_EXTRA.APROBADA, aprobados: 90 });
  assert.deepEqual(estadoInicial(calculo, { minutos_autorizados: 60 }), { idEstado: ESTADO_HORAS_EXTRA.AJUSTADA, aprobados: 60 });
  const largo = segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T19:00", turno("2026-10-05", "08:00", "2026-10-05", "16:00")));
  assert.deepEqual(estadoInicial(largo, { minutos_autorizados: 180 }), { idEstado: ESTADO_HORAS_EXTRA.APROBADA, aprobados: 120 });
});

test("autorización previa sin tiempo fuera del turno: nada que aprobar", () => {
  const calculo = segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T16:00", turno("2026-10-05", "08:00", "2026-10-05", "16:00")));
  assert.deepEqual(estadoInicial(calculo, { minutos_autorizados: 60 }), { idEstado: ESTADO_HORAS_EXTRA.SIN_EXTRA, aprobados: null });
});

test("aprobar sin minutos aprueba lo marcado después del turno", () => {
  assert.deepEqual(validarRevision({ decision: "APROBADA" }, conExtra), {
    idEstado: ESTADO_HORAS_EXTRA.APROBADA,
    aprobados: 90,
    comentario: null,
  });
});

test("aprobar otros minutos es un ajuste y exige comentario", () => {
  assert.throws(() => validarRevision({ decision: "APROBADA", minutos_aprobados: 60 }, conExtra), errorEn("comentario"));
  const ajuste = validarRevision({ decision: "APROBADA", minutos_aprobados: 120, comentario: " Llegó antes por inventario " }, conExtra);
  assert.deepEqual(ajuste, { idEstado: ESTADO_HORAS_EXTRA.AJUSTADA, aprobados: 120, comentario: "Llegó antes por inventario" });
});

test("no se aprueba más de lo marcado fuera del turno ni cero minutos", () => {
  for (const minutos of [121, 0, -5, 1.5, "60"]) {
    assert.throws(
      () => validarRevision({ decision: "APROBADA", minutos_aprobados: minutos, comentario: "x" }, conExtra),
      errorEn("minutos_aprobados")
    );
  }
});

test("con más de 2 h marcadas se aprueba hasta el tope legal y el mensaje lo explica", () => {
  const largo = { con_turno: true, minutos_extra: 200, minutos_anticipados: 0 };
  assert.deepEqual(validarRevision({ decision: "APROBADA" }, largo), {
    idEstado: ESTADO_HORAS_EXTRA.APROBADA,
    aprobados: 120,
    comentario: null,
  });
  assert.throws(
    () => validarRevision({ decision: "APROBADA", minutos_aprobados: 150, comentario: "x" }, largo),
    (e) => e.detalles[0].mensaje === "Apruebe entre 1 y 120 minutos: la ley permite hasta 2 horas extra por día."
  );
  const descanso = { con_turno: false, minutos_extra: 700, minutos_anticipados: 0 };
  assert.equal(validarRevision({ decision: "APROBADA" }, descanso).aprobados, 600);
  assert.throws(
    () => validarRevision({ decision: "APROBADA", minutos_aprobados: 601, comentario: "x" }, descanso),
    (e) => e.detalles[0].mensaje.includes("jornada de 8 horas")
  );
});

test("rechazar exige comentario y deja cero minutos aprobados", () => {
  assert.throws(() => validarRevision({ decision: "RECHAZADA", comentario: "  " }, conExtra), errorEn("comentario"));
  assert.deepEqual(validarRevision({ decision: "RECHAZADA", comentario: "No se pidió" }, conExtra), {
    idEstado: ESTADO_HORAS_EXTRA.RECHAZADA,
    aprobados: 0,
    comentario: "No se pidió",
  });
});

test("la decisión debe ser APROBADA o RECHAZADA y el comentario texto corto", () => {
  assert.throws(() => validarRevision({ decision: "OTRA" }, conExtra), errorEn("decision"));
  assert.throws(() => validarRevision(undefined, conExtra), errorEn("decision"));
  assert.throws(() => validarRevision({ decision: "RECHAZADA", comentario: 5 }, conExtra), errorEn("comentario"));
  assert.throws(() => validarRevision({ decision: "RECHAZADA", comentario: "x".repeat(501) }, conExtra), errorEn("comentario"));
});

const ID = "4192f252-acf0-4522-a109-e051cad9a50b";
const autorizacion = (extra = {}) => ({
  id_empleado: ID,
  fecha_jornada: "2026-10-16",
  minutos_autorizados: 120,
  motivo: "Inventario",
  ...extra,
});

test("autorización válida: hoy o después, entre 1 minuto y 10 horas, con motivo", () => {
  assert.deepEqual(validarAutorizacion(autorizacion({ id_empleado: ` ${ID.toUpperCase()} `, motivo: " Inventario " }), "2026-10-16"), {
    idEmpleado: ID,
    fecha: "2026-10-16",
    minutos: 120,
    motivo: "Inventario",
  });
  assert.equal(validarAutorizacion(autorizacion({ minutos_autorizados: MAXIMO_MINUTOS_AUTORIZABLES }), "2026-10-16").minutos, 600);
});

test("autorización inválida: cada campo con su mensaje", () => {
  const hoy = "2026-10-16";
  assert.throws(() => validarAutorizacion(autorizacion({ id_empleado: "x" }), hoy), errorEn("id_empleado"));
  assert.throws(() => validarAutorizacion(autorizacion({ fecha_jornada: "2026-10-15" }), hoy), errorEn("fecha_jornada"));
  assert.throws(() => validarAutorizacion(autorizacion({ fecha_jornada: "2026-02-30" }), hoy), errorEn("fecha_jornada"));
  for (const minutos of [0, 601, 30.5, "60", null]) {
    assert.throws(() => validarAutorizacion(autorizacion({ minutos_autorizados: minutos }), hoy), errorEn("minutos_autorizados"));
  }
  assert.throws(() => validarAutorizacion(autorizacion({ motivo: " " }), hoy), errorEn("motivo"));
  assert.throws(() => validarAutorizacion(autorizacion({ motivo: "x".repeat(501) }), hoy), errorEn("motivo"));
  assert.throws(() => validarAutorizacion(undefined, hoy), errorEn("id_empleado"));
});

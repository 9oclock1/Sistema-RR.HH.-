// Pruebas matemáticas de horas extra y recargo nocturno: turnos diurnos, mixtos, nocturnos y jornadas
// que cruzan la medianoche. Cada caso parte de los marcajes y del turno, como los calcula el servicio.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { segregarJornada, liquidarJornada, estadoInicial, calculoDesdeFila, ESTADO_HORAS_EXTRA } = require("../src/utils/horasExtra");

const bo = (fechaHora) => new Date(`${fechaHora}-04:00`);
const sumarDia = (fecha) => new Date(Date.parse(`${fecha}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);

// Turno programado del día `fecha`; si termina antes de empezar, cruza la medianoche.
function turno(fecha, inicio, fin, refrigerio = 0) {
  const fechaFin = fin <= inicio ? sumarDia(fecha) : fecha;
  return {
    inicioProgramado: bo(`${fecha}T${inicio}:00`),
    finProgramado: bo(`${fechaFin}T${fin}:00`),
    minutosRefrigerio: refrigerio,
  };
}

const calcular = (entrada, salida, programado = {}, minimo = 15) =>
  segregarJornada({ entrada: bo(entrada), salida: bo(salida), ...programado }, minimo);

const casos = [
  {
    nombre: "diurno 08–16 (1 h de refrigerio), salida a la hora",
    entrada: "2026-10-05T07:58:00",
    salida: "2026-10-05T16:04:00",
    turno: turno("2026-10-05", "08:00", "16:00", 60),
    esperado: { minutos_ordinarios: 420, minutos_ordinarios_nocturnos: 0, minutos_extra: 0, minutos_anticipados: 0 },
  },
  {
    nombre: "diurno 08–16 con salida 20:30: la última media hora ya es nocturna",
    entrada: "2026-10-05T08:00:00",
    salida: "2026-10-05T20:30:00",
    turno: turno("2026-10-05", "08:00", "16:00", 60),
    esperado: { minutos_ordinarios: 420, minutos_ordinarios_nocturnos: 0, minutos_extra: 270, minutos_anticipados: 0 },
    aprobados: 270,
    pago: { minutos_extra_simples: 120, minutos_extra_dobles: 150, minutos_extra_nocturnos: 30, minutos_nocturnos: 30 },
  },
  {
    nombre: "madrugada 04–12: 2 h nocturnas ordinarias (04–06), el refrigerio sale del tiempo diurno",
    entrada: "2026-10-05T04:00:00",
    salida: "2026-10-05T12:00:00",
    turno: turno("2026-10-05", "04:00", "12:00", 60),
    esperado: { minutos_ordinarios: 420, minutos_ordinarios_nocturnos: 120, minutos_extra: 0, minutos_anticipados: 0 },
  },
  {
    nombre: "mixto 14–22 (30 min de refrigerio): 2 h nocturnas ordinarias",
    entrada: "2026-10-05T14:00:00",
    salida: "2026-10-05T22:00:00",
    turno: turno("2026-10-05", "14:00", "22:00", 30),
    esperado: { minutos_ordinarios: 450, minutos_ordinarios_nocturnos: 120, minutos_extra: 0, minutos_anticipados: 0 },
  },
  {
    nombre: "mixto 14–22 con salida 01:00 del día siguiente: 3 h extra nocturnas",
    entrada: "2026-10-05T14:00:00",
    salida: "2026-10-06T01:00:00",
    turno: turno("2026-10-05", "14:00", "22:00", 30),
    esperado: { minutos_ordinarios: 450, minutos_ordinarios_nocturnos: 120, minutos_extra: 180, minutos_anticipados: 0 },
    aprobados: 180,
    pago: { minutos_extra_simples: 120, minutos_extra_dobles: 60, minutos_extra_nocturnos: 180, minutos_nocturnos: 300 },
  },
  {
    nombre: "mixto con 1 h aprobada de 3: la hora aprobada es la primera después del turno (nocturna)",
    entrada: "2026-10-05T14:00:00",
    salida: "2026-10-06T01:00:00",
    turno: turno("2026-10-05", "14:00", "22:00", 30),
    esperado: { minutos_extra: 180 },
    aprobados: 60,
    pago: { minutos_extra_simples: 60, minutos_extra_dobles: 0, minutos_extra_nocturnos: 60, minutos_nocturnos: 180 },
  },
  {
    nombre: "nocturno 22–06 (30 min de refrigerio): todo nocturno, el refrigerio también",
    entrada: "2026-10-05T21:55:00",
    salida: "2026-10-06T06:00:00",
    turno: turno("2026-10-05", "22:00", "06:00", 30),
    esperado: { minutos_ordinarios: 450, minutos_ordinarios_nocturnos: 450, minutos_extra: 0, minutos_anticipados: 0 },
  },
  {
    nombre: "nocturno 22–06 con salida 08:00: 2 h extra diurnas",
    entrada: "2026-10-05T22:00:00",
    salida: "2026-10-06T08:00:00",
    turno: turno("2026-10-05", "22:00", "06:00", 30),
    esperado: { minutos_ordinarios: 450, minutos_ordinarios_nocturnos: 450, minutos_extra: 120, minutos_anticipados: 0 },
    aprobados: 120,
    pago: { minutos_extra_simples: 120, minutos_extra_dobles: 0, minutos_extra_nocturnos: 0, minutos_nocturnos: 450 },
  },
  {
    nombre: "nocturno 22–06 con entrada tardía 00:30 (jornada del día anterior)",
    entrada: "2026-10-06T00:30:00",
    salida: "2026-10-06T06:00:00",
    turno: turno("2026-10-05", "22:00", "06:00", 30),
    esperado: { minutos_ordinarios: 300, minutos_ordinarios_nocturnos: 300, minutos_extra: 0, minutos_anticipados: 0 },
  },
  {
    nombre: "turno 00–08 con entrada 23:30 de la víspera: 30 min anticipados nocturnos",
    entrada: "2026-10-05T23:30:00",
    salida: "2026-10-06T08:00:00",
    turno: turno("2026-10-06", "00:00", "08:00", 30),
    esperado: { minutos_ordinarios: 450, minutos_ordinarios_nocturnos: 360, minutos_extra: 0, minutos_anticipados: 30 },
    aprobados: 30,
    pago: { minutos_extra_simples: 30, minutos_extra_dobles: 0, minutos_extra_nocturnos: 30, minutos_nocturnos: 390 },
  },
  {
    nombre: "descanso trabajado de 21:00 a 03:00: todo extra y nocturno",
    entrada: "2026-10-05T21:00:00",
    salida: "2026-10-06T03:00:00",
    turno: {},
    esperado: { minutos_ordinarios: 0, minutos_ordinarios_nocturnos: 0, minutos_extra: 360, minutos_anticipados: 0 },
    aprobados: 360,
    pago: { minutos_extra_simples: 120, minutos_extra_dobles: 240, minutos_extra_nocturnos: 360, minutos_nocturnos: 360 },
  },
  {
    nombre: "feriado en turno nocturno con 1 h extra: todo doble",
    entrada: "2026-10-05T22:00:00",
    salida: "2026-10-06T07:00:00",
    turno: turno("2026-10-05", "22:00", "06:00", 30),
    esferiado: true,
    esperado: { minutos_ordinarios: 450, minutos_ordinarios_nocturnos: 450, minutos_extra: 60 },
    aprobados: 60,
    pago: { minutos_extra_simples: 0, minutos_extra_dobles: 510, minutos_feriado: 450, minutos_extra_nocturnos: 0, minutos_nocturnos: 450 },
  },
  {
    nombre: "atraso y salida anticipada: menos ordinarias, ninguna extra",
    entrada: "2026-10-05T09:10:00",
    salida: "2026-10-05T15:00:00",
    turno: turno("2026-10-05", "08:00", "16:00", 60),
    esperado: { minutos_ordinarios: 290, minutos_extra: 0, minutos_anticipados: 0 },
  },
  {
    nombre: "los segundos no suman: entrada 08:00:59 y salida 17:00:30 dan 1 h extra",
    entrada: "2026-10-05T08:00:59",
    salida: "2026-10-05T17:00:30",
    turno: turno("2026-10-05", "08:00", "16:00", 60),
    esperado: { minutos_ordinarios: 420, minutos_extra: 60 },
  },
];

for (const caso of casos) {
  test(caso.nombre, () => {
    const calculo = calcular(caso.entrada, caso.salida, caso.turno);
    for (const [campo, valor] of Object.entries(caso.esperado)) assert.equal(calculo[campo], valor, campo);
    if (!caso.pago) return;
    const pago = liquidarJornada(calculo, { aprobados: caso.aprobados, esFeriado: Boolean(caso.esferiado) });
    for (const [campo, valor] of Object.entries(caso.pago)) assert.equal(pago[campo], valor, campo);
    // Lo guardado en la base rinde el mismo pago al revisar.
    const fila = {
      entrada_en: bo(caso.entrada),
      salida_en: bo(caso.salida),
      inicio_programado: caso.turno.inicioProgramado ?? null,
      fin_programado: caso.turno.finProgramado ?? null,
      ...calculo,
    };
    assert.deepEqual(liquidarJornada(calculoDesdeFila(fila), { aprobados: caso.aprobados, esFeriado: Boolean(caso.esferiado) }), pago);
  });
}

test("el tope de 2 h simples es por jornada, aunque la extra cruce la medianoche", () => {
  const calculo = calcular("2026-10-05T14:00:00", "2026-10-06T02:30:00", turno("2026-10-05", "14:00", "22:00", 30));
  const pago = liquidarJornada(calculo, { aprobados: calculo.minutos_extra });
  assert.equal(calculo.minutos_extra, 270);
  assert.equal(pago.minutos_extra_simples, 120);
  assert.equal(pago.minutos_extra_dobles, 150);
});

test("el mínimo vale para cada tramo: 10 min antes y 14 después no cuentan; 15 después sí", () => {
  const programado = turno("2026-10-05", "08:00", "16:00", 60);
  const poco = calcular("2026-10-05T07:50:00", "2026-10-05T16:14:00", programado);
  assert.deepEqual([poco.minutos_anticipados, poco.minutos_extra], [0, 0]);
  assert.equal(estadoInicial(poco).idEstado, ESTADO_HORAS_EXTRA.SIN_EXTRA);
  const justo = calcular("2026-10-05T07:50:00", "2026-10-05T16:15:00", programado);
  assert.equal(justo.minutos_extra, 15);
  assert.equal(estadoInicial(justo).idEstado, ESTADO_HORAS_EXTRA.PENDIENTE);
});

test("ordinarias + extra + anticipadas nunca superan lo trabajado", () => {
  const programado = turno("2026-10-05", "22:00", "06:00", 30);
  for (let entrada = 0; entrada <= 300; entrada += 45) {
    for (let salida = 360; salida <= 900; salida += 75) {
      const desde = new Date(bo("2026-10-05T20:00:00").getTime() + entrada * 60000);
      const hasta = new Date(bo("2026-10-05T20:00:00").getTime() + salida * 60000);
      const c = segregarJornada({ entrada: desde, salida: hasta, ...programado }, 0);
      assert.ok(c.minutos_ordinarios + c.minutos_extra + c.minutos_anticipados <= c.minutos_trabajados, `${entrada}/${salida}`);
      assert.ok(c.minutos_ordinarios_nocturnos <= c.minutos_ordinarios, `${entrada}/${salida}`);
    }
  }
});

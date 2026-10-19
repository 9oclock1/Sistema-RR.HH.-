const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  contarDiasHabiles,
  calcularSaldo,
  validarFechas,
  verificarAntiguedad,
  buscarProblemas,
} = require("../src/utils/solicitudesVacacion");

const EN_PROCESO_12 = { id_estado_movimiento: 1, dias: 12 };
const AGOSTO = [{ fecha: "2026-08-06", nombre: "Día de la Independencia" }];

test("cuenta de lunes a viernes y excluye fines de semana", () => {
  // Lunes 9 a domingo 22 de noviembre de 2026.
  const calculo = contarDiasHabiles("2026-11-09", "2026-11-22");
  assert.equal(calculo.dias_calendario, 14);
  assert.equal(calculo.dias_habiles, 10);
  assert.equal(calculo.dias_descanso, 4);
  assert.deepEqual(calculo.feriados, []);
});

test("excluye los feriados que caen en día hábil y los informa", () => {
  // Lunes 3 a viernes 7 de agosto de 2026, con el jueves 6 feriado.
  const calculo = contarDiasHabiles("2026-08-03", "2026-08-07", AGOSTO);
  assert.equal(calculo.dias_habiles, 4);
  assert.deepEqual(calculo.feriados, AGOSTO);
});

test("un feriado en fin de semana no se descuenta dos veces", () => {
  const calculo = contarDiasHabiles("2027-05-01", "2027-05-03", [{ fecha: "2027-05-01", nombre: "Día del Trabajo" }]);
  assert.equal(calculo.dias_habiles, 1);
  assert.equal(calculo.dias_descanso, 2);
  assert.deepEqual(calculo.feriados, []);
});

test("un solo día de fin de semana no tiene días hábiles", () => {
  assert.equal(contarDiasHabiles("2026-11-14", "2026-11-14").dias_habiles, 0);
});

test("el rango cruza fin de mes y de año", () => {
  const calculo = contarDiasHabiles("2026-12-28", "2027-01-05", [
    { fecha: "2027-01-01", nombre: "Año Nuevo" },
  ]);
  assert.equal(calculo.dias_calendario, 9);
  assert.equal(calculo.dias_habiles, 6);
});

test("un turno publicado manda sobre el fin de semana: trabajo hábil, descanso no", () => {
  // Lunes 9 a domingo 15 de noviembre de 2026: descansa el martes y trabaja el sábado.
  const turnos = [
    { fecha: "2026-11-10", es_descanso: true },
    { fecha: "2026-11-14", es_descanso: false },
  ];
  const calculo = contarDiasHabiles("2026-11-09", "2026-11-15", [], turnos);
  assert.equal(calculo.dias_habiles, 5);
  assert.equal(calculo.dias_descanso, 2);
});

test("un feriado no se cuenta aunque el día tenga turno de trabajo", () => {
  const calculo = contarDiasHabiles("2026-11-02", "2026-11-02", [{ fecha: "2026-11-02", nombre: "Todos los Difuntos" }], [
    { fecha: "2026-11-02", es_descanso: false },
  ]);
  assert.equal(calculo.dias_habiles, 0);
  assert.equal(calculo.feriados.length, 1);
});

test("el saldo descuenta los días comprometidos y fija la fecha mínima de inicio", () => {
  const saldo = calcularSaldo({ fechaIngreso: "2024-01-15", hoy: "2026-10-18", movimientos: [EN_PROCESO_12] });
  assert.equal(saldo.anios_servicio, 2);
  assert.equal(saldo.dias_ganados, 30);
  assert.equal(saldo.dias_disponibles, 18);
  assert.equal(saldo.habilitado, true);
  assert.equal(saldo.habilitado_desde, null);
  assert.equal(saldo.fecha_minima_inicio, "2026-10-25");
});

test("sin un año de antigüedad no está habilitado e indica desde cuándo", () => {
  const saldo = calcularSaldo({ fechaIngreso: "2026-02-02", hoy: "2026-10-18", movimientos: [] });
  assert.equal(saldo.habilitado, false);
  assert.equal(saldo.habilitado_desde, "2027-02-02");
  assert.throws(() => verificarAntiguedad(saldo), {
    estado: 403,
    message: "Aún no cumple un año de antigüedad. Podrá solicitar vacaciones desde el 02/02/2027.",
  });
});

test("valida formato y orden de las fechas", () => {
  assert.deepEqual(validarFechas({ fecha_inicio: "2026-11-09", fecha_fin: "2026-11-13" }), {
    fechaInicio: "2026-11-09",
    fechaFin: "2026-11-13",
  });
  for (const datos of [
    undefined,
    {},
    { fecha_inicio: "2026-02-30", fecha_fin: "2026-03-02" },
    { fecha_inicio: "09/11/2026", fecha_fin: "2026-11-13" },
    { fecha_inicio: "2026-11-13", fecha_fin: "2026-11-09" },
    { fecha_inicio: "2026-11-01", fecha_fin: "2027-03-01" },
  ]) {
    assert.throws(() => validarFechas(datos), { estado: 400 });
  }
});

const saldo = calcularSaldo({ fechaIngreso: "2024-01-15", hoy: "2026-10-18", movimientos: [{ id_estado_movimiento: 1, dias: 20 }] });
const codigos = (problemas) => problemas.map((problema) => problema.codigo);

test("sin problemas cuando cumple saldo, anticipación y no se solapa", () => {
  const calculo = contarDiasHabiles("2026-11-09", "2026-11-13");
  assert.deepEqual(buscarProblemas({ fechaInicio: "2026-11-09", calculo, saldo, solapadas: [] }), []);
});

test("permite usar exactamente el saldo disponible", () => {
  const calculo = contarDiasHabiles("2026-11-09", "2026-11-20");
  assert.equal(calculo.dias_habiles, saldo.dias_disponibles);
  assert.deepEqual(buscarProblemas({ fechaInicio: "2026-11-09", calculo, saldo, solapadas: [] }), []);
});

test("bloquea por saldo insuficiente", () => {
  const calculo = contarDiasHabiles("2026-11-09", "2026-11-23");
  const problemas = buscarProblemas({ fechaInicio: "2026-11-09", calculo, saldo, solapadas: [] });
  assert.deepEqual(codigos(problemas), ["SALDO_INSUFICIENTE"]);
  assert.equal(problemas[0].mensaje, "Saldo insuficiente: solicita 11 días hábiles y tiene 10 disponibles.");
});

test("bloquea por conflicto con otra solicitud en curso", () => {
  const calculo = contarDiasHabiles("2026-11-09", "2026-11-10");
  const otra = { fecha_inicio: "2026-11-10", fecha_fin: "2026-11-12", estado_nombre: "Aprobada" };
  const problemas = buscarProblemas({ fechaInicio: "2026-11-09", calculo, saldo, solapadas: [otra] });
  assert.deepEqual(codigos(problemas), ["CONFLICTO_FECHAS"]);
  assert.equal(problemas[0].mensaje, "Las fechas se cruzan con su solicitud aprobada del 10/11/2026 al 12/11/2026.");
});

test("bloquea si no respeta la anticipación mínima", () => {
  const calculo = contarDiasHabiles("2026-10-20", "2026-10-21");
  const problemas = buscarProblemas({ fechaInicio: "2026-10-20", calculo, saldo, solapadas: [] });
  assert.deepEqual(codigos(problemas), ["ANTICIPACION_INSUFICIENTE"]);
});

test("bloquea un periodo sin días hábiles", () => {
  const calculo = contarDiasHabiles("2026-11-14", "2026-11-15");
  const problemas = buscarProblemas({ fechaInicio: "2026-11-14", calculo, saldo, solapadas: [] });
  assert.deepEqual(codigos(problemas), ["SIN_DIAS_HABILES"]);
});

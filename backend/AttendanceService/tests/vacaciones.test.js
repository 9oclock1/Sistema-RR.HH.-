const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  contarDiasHabiles,
  aniosCumplidos,
  diasGanados,
  calcularSaldo,
  validarFechas,
  verificarAntiguedad,
  buscarProblemas,
} = require("../src/utils/vacaciones");

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

test("años cumplidos según el aniversario de ingreso", () => {
  assert.equal(aniosCumplidos("2025-10-18", "2026-10-17"), 0);
  assert.equal(aniosCumplidos("2025-10-18", "2026-10-18"), 1);
  assert.equal(aniosCumplidos("2019-03-11", "2026-10-18"), 7);
  assert.equal(aniosCumplidos("2026-12-01", "2026-10-18"), 0);
});

test("días ganados: 15 hasta el 5.º año, 20 hasta el 10.º y 30 desde el 11.º", () => {
  assert.equal(diasGanados(0), 0);
  assert.equal(diasGanados(1), 15);
  assert.equal(diasGanados(5), 75);
  assert.equal(diasGanados(6), 95);
  assert.equal(diasGanados(10), 175);
  assert.equal(diasGanados(11), 205);
});

test("el saldo descuenta los días comprometidos y fija la fecha mínima de inicio", () => {
  const saldo = calcularSaldo({ fechaIngreso: "2024-01-15", hoy: "2026-10-18", diasComprometidos: 12 });
  assert.equal(saldo.anios_servicio, 2);
  assert.equal(saldo.dias_ganados, 30);
  assert.equal(saldo.dias_disponibles, 18);
  assert.equal(saldo.habilitado, true);
  assert.equal(saldo.habilitado_desde, null);
  assert.equal(saldo.fecha_minima_inicio, "2026-10-25");
});

test("sin un año de antigüedad no está habilitado e indica desde cuándo", () => {
  const saldo = calcularSaldo({ fechaIngreso: "2026-02-02", hoy: "2026-10-18", diasComprometidos: 0 });
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

const saldo = calcularSaldo({ fechaIngreso: "2024-01-15", hoy: "2026-10-18", diasComprometidos: 20 });
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

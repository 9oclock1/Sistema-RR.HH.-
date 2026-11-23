const { test, describe, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/db");
const desvinculacionesModel = require("../src/models/desvinculacionesModel");
const promedioModelo = require("../src/models/promedioIndemnizableModel");
const modelo = require("../src/models/saldosProporcionalesModel");
const promedioServicio = require("../src/services/promedioIndemnizableService");
const externos = require("../src/services/externos.service");
const servicio = require("../src/services/saldosProporcionalesService");
const { gestionDe, duodecimaAguinaldo, vacacionesTruncas, calcularSaldos } = require("../src/utils/saldosProporcionales");

const ID_EMPLEADO = "11111111-1111-1111-1111-111111111111";
const ID_ADMIN = "22222222-2222-2222-2222-222222222222";
const ID_PROCESO = "33333333-3333-3333-3333-333333333333";
const ADMIN = { idEmpleado: ID_ADMIN, rol: "admin" };
const CONTADOR = { idEmpleado: ID_ADMIN, rol: "contador" };

// Saldo como lo devuelve el módulo de vacaciones (AttendanceService) al corte de la fecha de retiro.
function saldo({ ingreso = "2019-03-01", anios = 7, acumulados = 110, gozados = 95, enProceso = 0, proximo = 20 } = {}) {
  const periodos = Array.from({ length: anios }, (_, i) => ({
    numero: i + 1,
    fecha_acreditacion: `${Number(ingreso.slice(0, 4)) + i + 1}${ingreso.slice(4)}`,
    dias: i + 1 >= 11 ? 30 : i + 1 >= 6 ? 20 : 15,
  }));
  return {
    fecha_ingreso: ingreso,
    anios_servicio: anios,
    saldo: { acumulados, gozados, en_proceso: enProceso, disponibles: acumulados - gozados - enProceso },
    periodos,
    proximo_periodo: { dias: proximo },
  };
}

afterEach(() => mock.restoreAll());

describe("gestionDe", () => {
  test("la gestión del aguinaldo va del 1 de diciembre al 30 de noviembre", () => {
    assert.equal(gestionDe("2026-10-15"), 2026);
    assert.equal(gestionDe("2026-11-30"), 2026);
    assert.equal(gestionDe("2026-12-01"), 2027);
  });
});

describe("criterio 1: duodécimas de aguinaldo de la gestión en curso", () => {
  test("paga la proporción del sueldo promedio por los meses y días trabajados en la gestión", () => {
    // 2025-12-01 al 2026-10-15: 10 meses y 15 días → 6000 * 10,5 / 12 = 5250
    const r = duodecimaAguinaldo({ fechaIngreso: "2019-03-01", fechaRetiro: "2026-10-15", promedio: 6000 });
    assert.equal(r.gestion, 2026);
    assert.equal(r.desde, "2025-12-01");
    assert.deepEqual([r.meses, r.dias, r.monto], [10, 15, 5250]);
    assert.equal(r.observacion, null);
  });

  test("quien ingresó durante la gestión cuenta desde su ingreso", () => {
    // 2026-03-16 al 2026-10-31: 7 meses y 16 días → 3000 * (7 + 16/30) / 12 = 1883,33
    const r = duodecimaAguinaldo({ fechaIngreso: "2026-03-16", fechaRetiro: "2026-10-31", promedio: 3000 });
    assert.equal(r.desde, "2026-03-16");
    assert.deepEqual([r.meses, r.dias, r.monto], [7, 16, 1883.33]);
  });

  test("con menos de 3 meses en la gestión no hay duodécima y se explica", () => {
    const r = duodecimaAguinaldo({ fechaIngreso: "2019-03-01", fechaRetiro: "2026-01-20", promedio: 6000 });
    assert.equal(r.monto, 0);
    assert.match(r.observacion, /1 mes y 20 días.*mínimo es 3 meses/);
  });

  test("si el aguinaldo de esa gestión ya se liquidó en su planilla, no se vuelve a pagar", () => {
    const r = duodecimaAguinaldo({ fechaIngreso: "2019-03-01", fechaRetiro: "2026-11-30", promedio: 6000, aguinaldoLiquidado: { monto: 6000 } });
    assert.equal(r.monto, 0);
    assert.match(r.observacion, /ya se liquidó/);
  });
});

describe("criterios 2 y 3: vacaciones truncas", () => {
  test("criterio 2: valoriza los días no gozados con el sueldo promedio diario", () => {
    // 110 acreditados - 95 gozados = 15 días; 6000 / 30 = 200 por día → 3000
    const v = vacacionesTruncas({ saldo: saldo(), fechaIngreso: "2019-03-01", fechaRetiro: "2026-10-15", promedio: 6000 });
    assert.equal(v.dias_pendientes, 15);
    assert.equal(v.monto_pendientes, 3000);
  });

  test("criterio 3: duodécima del año de servicio incompleto, con la escala de ese año (20 días)", () => {
    // Último aniversario 2026-03-01 → retiro 2026-10-15: 7 meses y 15 días; 20 * 7,5 / 12 = 12,5 días → 2500
    const v = vacacionesTruncas({ saldo: saldo(), fechaIngreso: "2019-03-01", fechaRetiro: "2026-10-15", promedio: 6000 });
    assert.equal(v.anio_en_curso.desde, "2026-03-01");
    assert.deepEqual([v.anio_en_curso.meses, v.anio_en_curso.dias], [7, 15]);
    assert.equal(v.dias_escala, 20);
    assert.equal(v.dias_duodecima, 12.5);
    assert.equal(v.monto_duodecima, 2500);
  });

  test("criterio 3: antes del primer año usa la escala de 15 días desde el ingreso", () => {
    // 2026-04-01 → 2026-10-31: 7 meses; 15 * 7 / 12 = 8,75 días; 3000 / 30 * 8,75 = 875
    const s = saldo({ ingreso: "2026-04-01", anios: 0, acumulados: 0, gozados: 0, proximo: 15 });
    const v = vacacionesTruncas({ saldo: s, fechaIngreso: "2026-04-01", fechaRetiro: "2026-10-31", promedio: 3000 });
    assert.equal(v.dias_pendientes, 0);
    assert.equal(v.anio_en_curso.desde, "2026-04-01");
    assert.deepEqual([v.dias_escala, v.dias_duodecima, v.monto_duodecima], [15, 8.75, 875]);
  });

  test("criterio 3: con más de 10 años la escala del año en curso es de 30 días", () => {
    const s = saldo({ ingreso: "2014-01-10", anios: 12, acumulados: 280, gozados: 280, proximo: 30 });
    const v = vacacionesTruncas({ saldo: s, fechaIngreso: "2014-01-10", fechaRetiro: "2026-07-09", promedio: 9000 });
    // 2026-01-10 → 2026-07-09: 6 meses; 30 * 6 / 12 = 15 días; 300 * 15 = 4500
    assert.deepEqual([v.dias_escala, v.dias_duodecima, v.monto_duodecima], [30, 15, 4500]);
  });

  test("los días en proceso de goce se pagan como no gozados y se informa", () => {
    const v = vacacionesTruncas({ saldo: saldo({ gozados: 90, enProceso: 5 }), fechaIngreso: "2019-03-01", fechaRetiro: "2026-10-15", promedio: 6000 });
    assert.equal(v.dias_pendientes, 20);
    assert.match(v.observaciones[0], /5 días de vacación en proceso/);
  });
});

describe("calcularSaldos", () => {
  test("suma aguinaldo, vacaciones pendientes y duodécima; el salario diario es el promedio / 30", () => {
    const r = calcularSaldos({ promedio: 6000, fechaIngreso: "2019-03-01", fechaRetiro: "2026-10-15", saldoVacaciones: saldo() });
    assert.equal(r.salario_diario, 200);
    assert.equal(r.total, 5250 + 3000 + 2500);
    assert.deepEqual(r.observaciones, []);
  });

  test("redondea al centavo una sola vez por monto", () => {
    const r = calcularSaldos({ promedio: 3416.67, fechaIngreso: "2019-03-01", fechaRetiro: "2026-10-15", saldoVacaciones: saldo() });
    assert.equal(r.salario_diario, 113.89);
    assert.equal(r.vacaciones.monto_pendientes, 1708.34); // 3416,67 * 15 / 30 = 1708,335
    assert.equal(r.total, Math.round((r.aguinaldo.monto + r.vacaciones.monto_pendientes + r.vacaciones.monto_duodecima) * 100) / 100);
  });
});

function procesoBase(extras = {}) {
  return {
    id_proceso: ID_PROCESO,
    id_empleado: ID_EMPLEADO,
    nombre_empleado: "Elena Paredes Gómez",
    fecha_ingreso: "2019-03-01",
    fecha_retiro: "2026-10-15",
    estado: "INICIADO",
    ...extras,
  };
}

function clienteFalso() {
  return { async query() { return { rows: [] }; }, release() {} };
}

describe("saldosProporcionalesService", () => {
  test("calcula con el promedio guardado, el saldo de vacaciones al día del retiro y pasa el proceso a EN_CURSO", async () => {
    mock.method(pool, "connect", async () => clienteFalso());
    mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase());
    mock.method(promedioModelo, "obtenerDesglose", async () => ({ promedio: 6000 }));
    const calcularPromedio = mock.method(promedioServicio, "calcular", async () => ({ promedio: 1 }));
    const saldoMock = mock.method(externos, "saldoVacaciones", async () => saldo());
    mock.method(modelo, "aguinaldoLiquidado", async () => null);
    mock.method(promedioModelo, "bloquearProceso", async () => ({ estado: "INICIADO" }));
    let guardado;
    mock.method(modelo, "guardar", async (_c, _id, r) => { guardado = r; });
    const enCurso = mock.method(promedioModelo, "marcarEnCurso", async () => {});
    mock.method(modelo, "obtener", async () => ({ id_proceso: ID_PROCESO }));

    await servicio.calcular(ID_PROCESO, ADMIN);
    assert.deepEqual(saldoMock.mock.calls[0].arguments, [ID_EMPLEADO, "2026-10-15"]);
    assert.equal(calcularPromedio.mock.callCount(), 0);
    assert.equal(guardado.total, 10750);
    assert.equal(enCurso.mock.callCount(), 1);
  });

  test("sin promedio calculado, lo calcula primero con la regla de RF-55", async () => {
    mock.method(pool, "connect", async () => clienteFalso());
    mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase({ estado: "EN_CURSO" }));
    mock.method(promedioModelo, "obtenerDesglose", async () => null);
    const calcularPromedio = mock.method(promedioServicio, "calcular", async () => ({ promedio: 3000 }));
    mock.method(externos, "saldoVacaciones", async () => saldo());
    mock.method(modelo, "aguinaldoLiquidado", async () => null);
    mock.method(promedioModelo, "bloquearProceso", async () => ({ estado: "EN_CURSO" }));
    let guardado;
    mock.method(modelo, "guardar", async (_c, _id, r) => { guardado = r; });
    mock.method(modelo, "obtener", async () => ({}));

    await servicio.calcular(ID_PROCESO, ADMIN);
    assert.equal(calcularPromedio.mock.callCount(), 1);
    assert.equal(guardado.promedio, 3000);
  });

  test("solo el Administrador calcula; un proceso cerrado o anulado no se calcula", async () => {
    await assert.rejects(servicio.calcular(ID_PROCESO, CONTADOR), (e) => e.estado === 403);
    for (const estado of ["CERRADO", "ANULADO"]) {
      mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase({ estado }));
      await assert.rejects(servicio.calcular(ID_PROCESO, ADMIN), (e) => e.codigo === "PROCESO_NO_ABIERTO");
    }
  });

  test("el Contador consulta; sin cálculo responde 404 con su código", async () => {
    mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase());
    mock.method(modelo, "obtener", async () => null);
    await assert.rejects(servicio.obtener(ID_PROCESO, CONTADOR), (e) => e.estado === 404 && e.codigo === "SALDOS_NO_CALCULADOS");
    await assert.rejects(servicio.obtener(ID_PROCESO, { rol: "empleado" }), (e) => e.estado === 403);
  });
});

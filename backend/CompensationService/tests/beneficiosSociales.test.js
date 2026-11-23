const { test, describe, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/db");
const desvinculacionesModel = require("../src/models/desvinculacionesModel");
const modelo = require("../src/models/beneficiosSocialesModel");
const servicio = require("../src/services/beneficiosSocialesService");
const { sumarDias } = require("../src/utils/fechas");
const {
  DIAS_MINIMOS,
  tiempoDeServicio,
  reglaIndemnizacion,
  reglaDesahucio,
  calcularBeneficios,
} = require("../src/utils/beneficiosSociales");

const ID_PROCESO = "33333333-3333-3333-3333-333333333333";
const ADMIN = { idEmpleado: "22222222-2222-2222-2222-222222222222", rol: "admin" };
const CONTADOR = { idEmpleado: null, rol: "contador" };
const PROMEDIO = 4561.11;

const CAUSALES = {
  RENUNCIA: { nombre: "Renuncia voluntaria", desahucio: false },
  CONCLUSION_CONTRATO: { nombre: "Conclusión de contrato", desahucio: false },
  DESPIDO_LEGAL: { nombre: "Despido legal (causa justificada)", desahucio: false },
  DESAHUCIO: { nombre: "Desahucio", desahucio: true },
};

function proceso(codigo, fechaIngreso, fechaRetiro, extras = {}) {
  return {
    id_proceso: ID_PROCESO,
    estado: "EN_CURSO",
    fecha_ingreso: fechaIngreso,
    fecha_retiro: fechaRetiro,
    codigo_causal: codigo,
    causal_nombre: CAUSALES[codigo].nombre,
    corresponde_desahucio: CAUSALES[codigo].desahucio,
    promedio: PROMEDIO,
    ...extras,
  };
}

// Fecha de retiro para que el servicio dure `dias` días contando el de ingreso y el de retiro.
const retiroTras = (ingreso, dias) => sumarDias(ingreso, dias - 1);

function crearClienteFalso() {
  const comandos = [];
  return {
    comandos,
    async query(sql) {
      comandos.push(String(sql).trim());
      return { rows: [] };
    },
    release() {},
  };
}

afterEach(() => mock.restoreAll());

describe("tiempoDeServicio", () => {
  test("cuenta el día de ingreso y el de retiro", () => {
    assert.deepEqual(tiempoDeServicio("2026-10-01", "2026-10-01"), { dias_servicio: 1, anios: 0, meses: 0, dias: 1 });
    assert.deepEqual(tiempoDeServicio("2026-10-01", "2026-10-31"), { dias_servicio: 31, anios: 0, meses: 1, dias: 0 });
  });

  test("años exactos: del 1 de noviembre al 31 de octubre y de 5 años", () => {
    assert.deepEqual(tiempoDeServicio("2025-11-01", "2026-10-31"), { dias_servicio: 365, anios: 1, meses: 0, dias: 0 });
    assert.deepEqual(tiempoDeServicio("2021-03-15", "2026-03-14"), { dias_servicio: 1826, anios: 5, meses: 0, dias: 0 });
  });

  test("años, meses y días", () => {
    assert.deepEqual(tiempoDeServicio("2021-08-01", "2026-11-10"), { dias_servicio: 1928, anios: 5, meses: 3, dias: 10 });
  });

  test("ingreso a fin de mes o el 29 de febrero: el mes más corto cuenta completo (a favor del trabajador)", () => {
    assert.deepEqual(tiempoDeServicio("2026-01-31", "2026-02-26"), { dias_servicio: 27, anios: 0, meses: 0, dias: 27 });
    assert.deepEqual(tiempoDeServicio("2026-01-31", "2026-02-27"), { dias_servicio: 28, anios: 0, meses: 1, dias: 0 });
    assert.deepEqual(tiempoDeServicio("2026-01-31", "2026-03-30"), { dias_servicio: 59, anios: 0, meses: 2, dias: 0 });
    assert.deepEqual(tiempoDeServicio("2024-02-29", "2025-02-27"), { dias_servicio: 365, anios: 1, meses: 0, dias: 0 });
    assert.deepEqual(tiempoDeServicio("2024-02-29", "2025-02-28"), { dias_servicio: 366, anios: 1, meses: 0, dias: 1 });
  });
});

describe("reglas por antigüedad (89, 90 y 91 días)", () => {
  const ingreso = "2026-08-01";

  test("AC2: con 89 y 90 días no corresponde indemnización", () => {
    for (const dias of [89, 90]) {
      const r = calcularBeneficios(proceso("RENUNCIA", ingreso, retiroTras(ingreso, dias)), PROMEDIO);
      assert.equal(r.dias_servicio, dias);
      assert.equal(r.corresponde_indemnizacion, false);
      assert.equal(r.monto_indemnizacion, 0);
      assert.match(r.motivo_indemnizacion, new RegExp(`^${dias} días de servicio \\(90 o menos\\)`));
      assert.deepEqual(r.renglones, []);
    }
  });

  test("AC1: con 91 días corresponde la parte proporcional de meses y días", () => {
    const r = calcularBeneficios(proceso("RENUNCIA", ingreso, retiroTras(ingreso, 91)), PROMEDIO);
    assert.equal(r.dias_servicio, 91);
    assert.equal(r.corresponde_indemnizacion, true);
    assert.deepEqual([r.anios_servicio, r.meses_servicio, r.dias_fraccion], [0, 2, 30]);
    // 4561,11 × 2 / 12 = 760,185 → 760,19; 4561,11 × 30 / 360 = 380,0925 → 380,09
    assert.deepEqual(
      r.renglones.map((x) => [x.unidad, x.cantidad, x.divisor, x.monto]),
      [
        ["MES", 2, 12, 760.19],
        ["DIA", 30, 360, 380.09],
      ]
    );
    assert.equal(r.monto_indemnizacion, 1140.28);
  });

  test("con 1 día de servicio no corresponde nada y el motivo usa singular", () => {
    const r = calcularBeneficios(proceso("DESAHUCIO", "2026-10-31", "2026-10-31"), PROMEDIO);
    assert.match(r.motivo_indemnizacion, /^1 día de servicio/);
    assert.equal(r.total, 0);
  });

  test("DIAS_MINIMOS es 90 (DS 110)", () => {
    assert.equal(DIAS_MINIMOS, 90);
  });
});

describe("indemnización", () => {
  test("AC1: 1 año exacto = un sueldo promedio", () => {
    const r = calcularBeneficios(proceso("RENUNCIA", "2025-11-01", "2026-10-31"), PROMEDIO);
    assert.deepEqual(
      r.renglones.map((x) => [x.descripcion, x.monto]),
      [["Años de servicio", 4561.11]]
    );
    assert.equal(r.monto_indemnizacion, 4561.11);
  });

  test("AC1: 5 años, 3 meses y 10 días suma los renglones redondeados", () => {
    const r = calcularBeneficios(proceso("RENUNCIA", "2021-08-01", "2026-11-10"), PROMEDIO);
    // 22805,55 + 1140,28 (1140,2775) + 126,70 (126,6975)
    assert.deepEqual(
      r.renglones.map((x) => x.monto),
      [22805.55, 1140.28, 126.7]
    );
    assert.equal(r.monto_indemnizacion, 24072.53);
    assert.equal(r.total, 24072.53);
  });

  test("corresponde también en conclusión de contrato (DS 110)", () => {
    const r = reglaIndemnizacion("CONCLUSION_CONTRATO", 1004);
    assert.equal(r.corresponde, true);
  });

  test("despido por causa justificada: no corresponde aunque supere los 90 días (LGT, art. 16)", () => {
    const r = calcularBeneficios(proceso("DESPIDO_LEGAL", "2019-03-01", "2026-10-15"), PROMEDIO);
    assert.equal(r.corresponde_indemnizacion, false);
    assert.match(r.motivo_indemnizacion, /LGT, art\. 16/);
    assert.equal(r.total, 0);
  });

  test("sin fecha de ingreso lanza 409 SIN_FECHA_INGRESO", () => {
    assert.throws(
      () => calcularBeneficios(proceso("RENUNCIA", null, "2026-10-31"), PROMEDIO),
      (err) => err.estado === 409 && err.codigo === "SIN_FECHA_INGRESO"
    );
  });
});

describe("desahucio por causal", () => {
  test("AC3: causal desahucio agrega tres sueldos promedio", () => {
    const r = calcularBeneficios(proceso("DESAHUCIO", "2021-08-01", "2026-11-10"), PROMEDIO);
    assert.equal(r.corresponde_desahucio, true);
    assert.equal(r.monto_desahucio, 13683.33);
    assert.deepEqual(r.renglones.at(-1), {
      orden: 4,
      codigo_concepto: "DESAHUCIO",
      descripcion: "Desahucio (tres sueldos promedio)",
      unidad: "SUELDO",
      cantidad: 3,
      divisor: 1,
      monto: 13683.33,
    });
    assert.equal(r.total, 37755.86);
  });

  test("AC4: renuncia, conclusión de contrato y despido legal no incluyen desahucio", () => {
    for (const codigo of ["RENUNCIA", "CONCLUSION_CONTRATO", "DESPIDO_LEGAL"]) {
      const r = calcularBeneficios(proceso(codigo, "2021-08-01", "2026-11-10"), PROMEDIO);
      assert.equal(r.corresponde_desahucio, false, codigo);
      assert.equal(r.monto_desahucio, 0, codigo);
      assert.ok(!r.renglones.some((x) => x.codigo_concepto === "DESAHUCIO"), codigo);
    }
    assert.equal(
      reglaDesahucio(proceso("RENUNCIA", "2021-08-01", "2026-11-10"), 1928).motivo,
      "La causal «Renuncia voluntaria» no da lugar a desahucio."
    );
  });

  test("desahucio dentro del período de prueba (90 días): no corresponde; con 91 días sí", () => {
    const ingreso = "2026-08-01";
    const en90 = calcularBeneficios(proceso("DESAHUCIO", ingreso, retiroTras(ingreso, 90)), PROMEDIO);
    assert.equal(en90.corresponde_desahucio, false);
    assert.match(en90.motivo_desahucio, /período de prueba/);
    const en91 = calcularBeneficios(proceso("DESAHUCIO", ingreso, retiroTras(ingreso, 91)), PROMEDIO);
    assert.equal(en91.monto_desahucio, 13683.33);
  });

  test("usa el corresponde_desahucio copiado en el proceso, no el código de la causal", () => {
    const r = reglaDesahucio({ codigo_causal: "DESAHUCIO", corresponde_desahucio: false, causal_nombre: "Desahucio" }, 500);
    assert.equal(r.corresponde, false);
  });
});

describe("beneficiosSocialesService", () => {
  test("solo el Administrador y el Contador calculan; el empleado recibe 403 sin tocar la BD", async () => {
    const conectar = mock.method(pool, "connect");
    for (const rol of [null, "empleado", "supervisor", "gerente"]) {
      await assert.rejects(
        () => servicio.calcular(ID_PROCESO, { rol }),
        (err) => err.estado === 403
      );
    }
    assert.equal(conectar.mock.callCount(), 0);
  });

  test("id inválido o proceso inexistente: 404", async () => {
    const cliente = crearClienteFalso();
    mock.method(pool, "connect", async () => cliente);
    mock.method(modelo, "bloquearProceso", async () => null);
    mock.method(desvinculacionesModel, "obtenerProceso", async () => null);

    await assert.rejects(() => servicio.calcular("no-es-uuid", ADMIN), (err) => err.estado === 404);
    await assert.rejects(() => servicio.calcular(ID_PROCESO, ADMIN), (err) => err.estado === 404);
    await assert.rejects(() => servicio.obtener(ID_PROCESO, CONTADOR), (err) => err.estado === 404);
    assert.ok(cliente.comandos.includes("ROLLBACK"));
  });

  test("proceso cerrado o anulado: 409 PROCESO_NO_ABIERTO y nada guardado", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());
    const guardar = mock.method(modelo, "guardar");
    for (const estado of ["CERRADO", "ANULADO"]) {
      mock.method(modelo, "bloquearProceso", async () => proceso("RENUNCIA", "2021-08-01", "2026-10-20", { estado }));
      await assert.rejects(
        () => servicio.calcular(ID_PROCESO, ADMIN),
        (err) => err.estado === 409 && err.codigo === "PROCESO_NO_ABIERTO"
      );
    }
    assert.equal(guardar.mock.callCount(), 0);
  });

  test("sin sueldo promedio calculado: 409 PROMEDIO_NO_CALCULADO", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());
    mock.method(modelo, "bloquearProceso", async () =>
      proceso("RENUNCIA", "2021-08-01", "2026-10-20", { promedio: null })
    );
    const guardar = mock.method(modelo, "guardar");
    await assert.rejects(
      () => servicio.calcular(ID_PROCESO, ADMIN),
      (err) => err.estado === 409 && err.codigo === "PROMEDIO_NO_CALCULADO"
    );
    assert.equal(guardar.mock.callCount(), 0);
  });

  test("el Contador calcula: guarda con su rol, marca EN_CURSO si estaba INICIADO y hace COMMIT", async () => {
    const cliente = crearClienteFalso();
    mock.method(pool, "connect", async () => cliente);
    mock.method(modelo, "bloquearProceso", async () =>
      proceso("DESAHUCIO", "2021-08-01", "2026-11-10", { estado: "INICIADO" })
    );
    let guardado = null;
    mock.method(modelo, "guardar", async (_c, id, resultado, por) => {
      guardado = { id, resultado, por };
    });
    const marcar = mock.method(modelo, "marcarEnCurso", async () => {});
    mock.method(modelo, "obtenerDesglose", async () => ({ id_proceso: ID_PROCESO, total: 37755.86 }));

    const res = await servicio.calcular(ID_PROCESO.toUpperCase(), CONTADOR);

    assert.deepEqual(res, { id_proceso: ID_PROCESO, total: 37755.86 });
    assert.equal(guardado.id, ID_PROCESO);
    assert.equal(guardado.resultado.total, 37755.86);
    assert.deepEqual(guardado.por, { calculado_por: null, calculado_por_rol: "contador" });
    assert.equal(marcar.mock.callCount(), 1);
    assert.ok(cliente.comandos.includes("COMMIT"));
  });

  test("obtener: 404 BENEFICIOS_NO_CALCULADOS sin cálculo; el empleado no consulta", async () => {
    mock.method(desvinculacionesModel, "obtenerProceso", async () => ({ id_proceso: ID_PROCESO }));
    mock.method(modelo, "obtenerDesglose", async () => null);
    await assert.rejects(
      () => servicio.obtener(ID_PROCESO, CONTADOR),
      (err) => err.estado === 404 && err.codigo === "BENEFICIOS_NO_CALCULADOS"
    );
    await assert.rejects(() => servicio.obtener(ID_PROCESO, { rol: "empleado" }), (err) => err.estado === 403);
  });
});

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { validarVigenciaEscala, cierreDeUltimaVigencia, tramoParaAnios, redondear } = require("../src/utils/antiguedad");
const { aniosDeServicio, esPrimerDiaDeMes } = require("../src/utils/fechas");

const campos = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.equal(error.estado, 400);
    return error.detalles.map((d) => d.campo).sort();
  }
  assert.fail("debía lanzar un error de validación");
};

const ESCALA_VALIDA = {
  vigente_desde: "2026-01-01",
  motivo: "Escala legal 2026",
};

const TRAMOS_VALIDOS = [
  { anios_desde: 2, anios_hasta: 4, porcentaje: 5 },
  { anios_desde: 5, anios_hasta: 7, porcentaje: 11 },
  { anios_desde: 8, anios_hasta: null, porcentaje: 18 },
];

describe("validarVigenciaEscala", () => {
  test("normaliza una escala válida y ordena los tramos", () => {
    const desordenados = [TRAMOS_VALIDOS[2], TRAMOS_VALIDOS[0], TRAMOS_VALIDOS[1]];
    const escala = validarVigenciaEscala({ ...ESCALA_VALIDA, tramos: desordenados });
    assert.equal(escala.vigente_desde, "2026-01-01");
    assert.equal(escala.motivo, "Escala legal 2026");
    assert.deepEqual(escala.tramos.map((t) => t.anios_desde), [2, 5, 8]);
  });

  test("motivo vacío queda null", () => {
    const escala = validarVigenciaEscala({ ...ESCALA_VALIDA, motivo: undefined, tramos: TRAMOS_VALIDOS });
    assert.equal(escala.motivo, null);
  });

  test("fecha de inicio inválida", () => {
    assert.deepEqual(
      campos(() => validarVigenciaEscala({ ...ESCALA_VALIDA, vigente_desde: "2026-13-01", tramos: TRAMOS_VALIDOS })),
      ["vigente_desde"]
    );
  });

  test("motivo demasiado largo", () => {
    assert.deepEqual(
      campos(() => validarVigenciaEscala({ ...ESCALA_VALIDA, motivo: "a".repeat(251), tramos: TRAMOS_VALIDOS })),
      ["motivo"]
    );
  });

  test("sin tramos", () => {
    assert.deepEqual(campos(() => validarVigenciaEscala({ ...ESCALA_VALIDA, tramos: [] })), ["tramos"]);
  });

  test("tramo con porcentaje cero, negativo o mayor a 100", () => {
    for (const porcentaje of [0, -5, 150]) {
      assert.deepEqual(
        campos(() => validarVigenciaEscala({ ...ESCALA_VALIDA, tramos: [{ anios_desde: 0, anios_hasta: null, porcentaje }] })),
        ["tramos[0].porcentaje"]
      );
    }
  });

  test("años de inicio no entero o negativo", () => {
    assert.deepEqual(
      campos(() =>
        validarVigenciaEscala({ ...ESCALA_VALIDA, tramos: [{ anios_desde: -1, anios_hasta: null, porcentaje: 5 }] })
      ),
      ["tramos[0].anios_desde"]
    );
    assert.deepEqual(
      campos(() =>
        validarVigenciaEscala({ ...ESCALA_VALIDA, tramos: [{ anios_desde: 2.5, anios_hasta: null, porcentaje: 5 }] })
      ),
      ["tramos[0].anios_desde"]
    );
  });

  test("tramo con fin antes del inicio", () => {
    assert.deepEqual(
      campos(() =>
        validarVigenciaEscala({ ...ESCALA_VALIDA, tramos: [{ anios_desde: 5, anios_hasta: 2, porcentaje: 5 }] })
      ),
      ["tramos[0].anios_hasta"]
    );
  });

  test("solo el último tramo puede quedar sin tope", () => {
    const tramos = [
      { anios_desde: 0, anios_hasta: null, porcentaje: 5 },
      { anios_desde: 5, anios_hasta: null, porcentaje: 10 },
    ];
    // Un tramo sin tope que no es el último también rompe la continuidad del siguiente: ambos se reportan.
    assert.deepEqual(campos(() => validarVigenciaEscala({ ...ESCALA_VALIDA, tramos })), [
      "tramos[0].anios_hasta",
      "tramos[1].anios_desde",
    ]);
  });

  test("rechaza huecos entre tramos", () => {
    const tramos = [
      { anios_desde: 0, anios_hasta: 4, porcentaje: 5 },
      { anios_desde: 6, anios_hasta: null, porcentaje: 10 },
    ];
    assert.deepEqual(campos(() => validarVigenciaEscala({ ...ESCALA_VALIDA, tramos })), ["tramos[1].anios_desde"]);
  });

  test("rechaza tramos que se cruzan", () => {
    const tramos = [
      { anios_desde: 0, anios_hasta: 5, porcentaje: 5 },
      { anios_desde: 3, anios_hasta: null, porcentaje: 10 },
    ];
    assert.deepEqual(campos(() => validarVigenciaEscala({ ...ESCALA_VALIDA, tramos })), ["tramos[1].anios_desde"]);
  });
});

describe("cierreDeUltimaVigencia", () => {
  test("sin vigencia previa no cierra nada", () => {
    assert.equal(cierreDeUltimaVigencia(undefined, "2027-01-01"), null);
  });

  test("cierra la vigencia abierta el día anterior", () => {
    assert.equal(cierreDeUltimaVigencia({ vigente_desde: "2026-01-01", vigente_hasta: null }, "2027-01-01"), "2026-12-31");
  });

  test("rechaza una nueva vigencia que empieza antes o el mismo día", () => {
    const ultima = { vigente_desde: "2027-01-01", vigente_hasta: null };
    assert.deepEqual(campos(() => cierreDeUltimaVigencia(ultima, "2027-01-01")), ["vigente_desde"]);
    assert.deepEqual(campos(() => cierreDeUltimaVigencia(ultima, "2026-06-01")), ["vigente_desde"]);
  });
});

describe("tramoParaAnios", () => {
  test("encuentra el tramo que cubre la antigüedad", () => {
    assert.equal(tramoParaAnios(TRAMOS_VALIDOS, 3).porcentaje, 5);
    assert.equal(tramoParaAnios(TRAMOS_VALIDOS, 6).porcentaje, 11);
    assert.equal(tramoParaAnios(TRAMOS_VALIDOS, 30).porcentaje, 18);
  });

  test("devuelve undefined si ningún tramo cubre la antigüedad", () => {
    assert.equal(tramoParaAnios(TRAMOS_VALIDOS, 1), undefined);
  });
});

describe("redondear", () => {
  test("redondea a 2 decimales", () => {
    assert.equal(redondear(1234.5 * 0.1825), 225.3);
    assert.equal(redondear(100 / 3), 33.33);
  });
});

describe("aniosDeServicio", () => {
  test("cuenta solo los aniversarios ya cumplidos", () => {
    assert.equal(aniosDeServicio("2020-11-15", "2026-11-01"), 5);
    assert.equal(aniosDeServicio("2020-11-15", "2026-11-15"), 6);
    assert.equal(aniosDeServicio("2020-11-15", "2026-12-01"), 6);
  });

  test("nunca devuelve negativo para un ingreso futuro", () => {
    assert.equal(aniosDeServicio("2027-01-01", "2026-11-01"), 0);
  });
});

describe("esPrimerDiaDeMes", () => {
  test("exige el día 01", () => {
    assert.equal(esPrimerDiaDeMes("2026-11-01"), true);
    assert.equal(esPrimerDiaDeMes("2026-11-15"), false);
  });
});

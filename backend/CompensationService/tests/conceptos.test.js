const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { validarConcepto, validarEdicion, validarVigencia, cierreDeUltima } = require("../src/utils/conceptos");
const { esFecha, diaAnterior, hoyLaPaz } = require("../src/utils/fechas");

const campos = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.equal(error.estado, 400);
    return error.detalles.map((d) => d.campo).sort();
  }
  assert.fail("debía lanzar un error de validación");
};

const PORCENTAJE = {
  codigo: "sip-vejez",
  nombre: "  Aporte de vejez ",
  tipo: "DESCUENTO",
  forma_calculo: "PORCENTAJE",
  base_calculo: "TOTAL_GANADO",
  es_de_ley: true,
  cuenta_contable_codigo: "2.1.3.01",
  cuenta_contable_nombre: "Aportes por pagar",
  valor: 10,
  vigente_desde: "2026-01-01",
};

const MONTO = {
  codigo: "BONO-TE",
  nombre: "Bono de té",
  tipo: "INGRESO",
  forma_calculo: "MONTO_FIJO",
  base_calculo: "TOTAL_GANADO",
  valor: 150.5,
  vigente_desde: "2026-11-01",
  vigente_hasta: "2026-12-31",
};

describe("validarConcepto", () => {
  test("normaliza un porcentaje válido", () => {
    const { concepto, vigencia } = validarConcepto(PORCENTAJE);
    assert.equal(concepto.codigo, "SIP-VEJEZ");
    assert.equal(concepto.nombre, "Aporte de vejez");
    assert.equal(concepto.base_calculo, "TOTAL_GANADO");
    assert.equal(concepto.descripcion, null);
    assert.deepEqual(vigencia, { valor: 10, vigente_desde: "2026-01-01", vigente_hasta: null });
  });

  test("un monto fijo ignora la base y acepta fecha de fin", () => {
    const { concepto, vigencia } = validarConcepto(MONTO);
    assert.equal(concepto.base_calculo, null);
    assert.equal(concepto.es_de_ley, false);
    assert.equal(concepto.cuenta_contable_codigo, null);
    assert.equal(vigencia.vigente_hasta, "2026-12-31");
  });

  test("sin datos marca todos los obligatorios", () => {
    assert.deepEqual(campos(() => validarConcepto({})), [
      "codigo",
      "forma_calculo",
      "nombre",
      "tipo",
      "valor",
      "vigente_desde",
    ]);
  });

  test("porcentaje sin base o mayor a 100", () => {
    assert.deepEqual(campos(() => validarConcepto({ ...PORCENTAJE, base_calculo: undefined, valor: 100.5 })), [
      "base_calculo",
      "valor",
    ]);
  });

  test("decimales: 4 en porcentajes, 2 en montos", () => {
    assert.doesNotThrow(() => validarConcepto({ ...PORCENTAJE, valor: 1.7125 }));
    assert.deepEqual(campos(() => validarConcepto({ ...PORCENTAJE, valor: 1.71255 })), ["valor"]);
    assert.deepEqual(campos(() => validarConcepto({ ...MONTO, valor: 10.555 })), ["valor"]);
  });

  test("valor cero, negativo o como texto", () => {
    for (const valor of [0, -5, "10", null, NaN]) {
      assert.deepEqual(campos(() => validarConcepto({ ...MONTO, valor })), ["valor"]);
    }
  });

  test("código con espacios o demasiado largo", () => {
    assert.deepEqual(campos(() => validarConcepto({ ...MONTO, codigo: "BONO TE" })), ["codigo"]);
    assert.deepEqual(campos(() => validarConcepto({ ...MONTO, codigo: "A".repeat(21) })), ["codigo"]);
  });

  test("cuenta contable: formato y código con nombre", () => {
    assert.deepEqual(campos(() => validarConcepto({ ...PORCENTAJE, cuenta_contable_codigo: "2-1-3" })), [
      "cuenta_contable_codigo",
    ]);
    assert.deepEqual(campos(() => validarConcepto({ ...PORCENTAJE, cuenta_contable_nombre: " " })), [
      "cuenta_contable_nombre",
    ]);
    assert.deepEqual(campos(() => validarConcepto({ ...MONTO, cuenta_contable_nombre: "Sueldos" })), [
      "cuenta_contable_codigo",
    ]);
  });

  test("fechas inválidas o fin antes del inicio", () => {
    assert.deepEqual(campos(() => validarConcepto({ ...MONTO, vigente_desde: "2026-02-30" })), ["vigente_desde"]);
    assert.deepEqual(campos(() => validarConcepto({ ...MONTO, vigente_hasta: "2026-10-31" })), ["vigente_hasta"]);
  });

  test("tipo y forma fuera del catálogo", () => {
    assert.deepEqual(campos(() => validarConcepto({ ...MONTO, tipo: "BONO", forma_calculo: "FORMULA" })), [
      "forma_calculo",
      "tipo",
    ]);
  });
});

describe("validarEdicion", () => {
  test("usa la forma guardada para exigir la base", () => {
    assert.deepEqual(campos(() => validarEdicion({ ...PORCENTAJE, base_calculo: null }, "PORCENTAJE")), [
      "base_calculo",
    ]);
    assert.equal(validarEdicion(PORCENTAJE, "MONTO_FIJO").base_calculo, null);
  });

  test("no revisa valor ni vigencia", () => {
    const { valor, vigente_desde, ...soloEditables } = PORCENTAJE;
    assert.equal(validarEdicion(soloEditables, "PORCENTAJE").codigo, "SIP-VEJEZ");
  });
});

describe("validarVigencia", () => {
  test("valida contra la forma del concepto", () => {
    assert.deepEqual(campos(() => validarVigencia({ valor: 150, vigente_desde: "2027-01-01" }, "PORCENTAJE")), [
      "valor",
    ]);
    assert.equal(validarVigencia({ valor: 150, vigente_desde: "2027-01-01" }, "MONTO_FIJO").valor, 150);
  });
});

describe("cierreDeUltima", () => {
  const nueva = { valor: 11, vigente_desde: "2027-01-01", vigente_hasta: null };

  test("sin vigencias previas no cierra nada", () => {
    assert.equal(cierreDeUltima(undefined, nueva), null);
  });

  test("cierra la vigencia abierta el día anterior", () => {
    assert.equal(cierreDeUltima({ vigente_desde: "2026-01-01", vigente_hasta: null }, nueva), "2026-12-31");
  });

  test("recorta la vigencia que se cruza con la nueva", () => {
    assert.equal(cierreDeUltima({ vigente_desde: "2026-01-01", vigente_hasta: "2027-06-30" }, nueva), "2026-12-31");
  });

  test("deja intacta la que ya terminó antes", () => {
    assert.equal(cierreDeUltima({ vigente_desde: "2026-01-01", vigente_hasta: "2026-06-30" }, nueva), null);
  });

  test("rechaza una nueva que empieza el mismo día o antes", () => {
    for (const desde of ["2027-01-01", "2026-05-01"]) {
      assert.deepEqual(
        campos(() => cierreDeUltima({ vigente_desde: "2027-01-01", vigente_hasta: null }, { ...nueva, vigente_desde: desde })),
        ["vigente_desde"]
      );
    }
  });
});

describe("fechas", () => {
  test("esFecha rechaza fechas imposibles", () => {
    assert.equal(esFecha("2028-02-29"), true);
    assert.equal(esFecha("2027-02-29"), false);
    assert.equal(esFecha("2026-1-01"), false);
    assert.equal(esFecha(20260101), false);
  });

  test("diaAnterior cruza meses y años", () => {
    assert.equal(diaAnterior("2027-01-01"), "2026-12-31");
    assert.equal(diaAnterior("2028-03-01"), "2028-02-29");
  });

  test("hoyLaPaz usa UTC-4", () => {
    assert.equal(hoyLaPaz(new Date("2026-11-05T02:00:00Z")), "2026-11-04");
    assert.equal(hoyLaPaz(new Date("2026-11-05T04:00:00Z")), "2026-11-05");
  });
});

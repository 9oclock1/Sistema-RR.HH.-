const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  validarDatosPrestamo,
  calcularCuotas,
  validarTopeDescuento,
  PORCENTAJE_MAXIMO_DESCUENTO,
} = require("../src/utils/anticipos");
const { esFecha, esPrimerDiaDeMes, sumarMeses } = require("../src/utils/fechas");

const campos = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.equal(error.estado, 400);
    return error.detalles.map((d) => d.campo).sort();
  }
  assert.fail("debía lanzar un error de validación");
};

const DATOS = {
  id_empleado: "11111111-1111-1111-1111-111111111111",
  tipo: "PRESTAMO",
  monto: 1000,
  numero_cuotas: 4,
  mes_inicio: "2026-12-01",
  motivo: "Gastos médicos",
};

describe("validarDatosPrestamo", () => {
  test("normaliza datos válidos", () => {
    const prestamo = validarDatosPrestamo(DATOS);
    assert.equal(prestamo.monto, 1000);
    assert.equal(prestamo.numero_cuotas, 4);
    assert.equal(prestamo.motivo, "Gastos médicos");
  });

  test("motivo vacío queda null", () => {
    assert.equal(validarDatosPrestamo({ ...DATOS, motivo: undefined }).motivo, null);
  });

  test("sin datos marca todos los obligatorios", () => {
    assert.deepEqual(campos(() => validarDatosPrestamo({})), ["id_empleado", "mes_inicio", "monto", "numero_cuotas", "tipo"]);
  });

  test("tipo fuera del catálogo", () => {
    assert.deepEqual(campos(() => validarDatosPrestamo({ ...DATOS, tipo: "DONACION" })), ["tipo"]);
  });

  test("monto cero, negativo o con más de 2 decimales", () => {
    for (const monto of [0, -5, 10.555, "1000"]) {
      assert.deepEqual(campos(() => validarDatosPrestamo({ ...DATOS, monto })), ["monto"]);
    }
  });

  test("número de cuotas fuera de rango o no entero", () => {
    for (const numero_cuotas of [0, 61, 2.5, "4"]) {
      assert.deepEqual(campos(() => validarDatosPrestamo({ ...DATOS, numero_cuotas })), ["numero_cuotas"]);
    }
  });

  test("mes de inicio inválido o no es el día 1", () => {
    assert.deepEqual(campos(() => validarDatosPrestamo({ ...DATOS, mes_inicio: "2026-13-01" })), ["mes_inicio"]);
    assert.deepEqual(campos(() => validarDatosPrestamo({ ...DATOS, mes_inicio: "2026-12-15" })), ["mes_inicio"]);
  });

  test("motivo demasiado largo", () => {
    assert.deepEqual(campos(() => validarDatosPrestamo({ ...DATOS, motivo: "a".repeat(251) })), ["motivo"]);
  });
});

describe("calcularCuotas", () => {
  test("reparte el monto en partes iguales cuando es exacto", () => {
    const cuotas = calcularCuotas({ monto: 1000, numero_cuotas: 4, mes_inicio: "2026-12-01" });
    assert.equal(cuotas.length, 4);
    assert.deepEqual(cuotas.map((c) => c.monto), [250, 250, 250, 250]);
    assert.deepEqual(cuotas.map((c) => c.periodo), ["2026-12-01", "2027-01-01", "2027-02-01", "2027-03-01"]);
  });

  test("la última cuota absorbe el redondeo", () => {
    const cuotas = calcularCuotas({ monto: 1000, numero_cuotas: 3, mes_inicio: "2026-12-01" });
    assert.deepEqual(cuotas.map((c) => c.monto), [333.33, 333.33, 333.34]);
    const suma = cuotas.reduce((total, c) => total + c.monto, 0);
    assert.equal(Math.round(suma * 100) / 100, 1000);
  });

  test("numera las cuotas desde 1", () => {
    const cuotas = calcularCuotas({ monto: 300, numero_cuotas: 3, mes_inicio: "2027-01-01" });
    assert.deepEqual(cuotas.map((c) => c.numero_cuota), [1, 2, 3]);
  });
});

describe("validarTopeDescuento", () => {
  test("acepta una cuota dentro del tope", () => {
    const cuotas = calcularCuotas({ monto: 1000, numero_cuotas: 5, mes_inicio: "2026-12-01" });
    const { porcentaje_cuota } = validarTopeDescuento(cuotas, 2000);
    assert.equal(porcentaje_cuota, 10);
  });

  test(`rechaza una cuota que supera el ${PORCENTAJE_MAXIMO_DESCUENTO}% del líquido pagable`, () => {
    const cuotas = calcularCuotas({ monto: 1000, numero_cuotas: 2, mes_inicio: "2026-12-01" });
    try {
      validarTopeDescuento(cuotas, 2000);
    } catch (error) {
      assert.equal(error.estado, 400);
      assert.equal(error.detalles[0].campo, "numero_cuotas");
      return;
    }
    assert.fail("debía rechazar la cuota");
  });

  test("acepta justo en el límite", () => {
    const cuotas = calcularCuotas({ monto: 200, numero_cuotas: 1, mes_inicio: "2026-12-01" });
    assert.doesNotThrow(() => validarTopeDescuento(cuotas, 1000));
  });
});

describe("fechas", () => {
  test("esFecha rechaza fechas imposibles", () => {
    assert.equal(esFecha("2026-12-01"), true);
    assert.equal(esFecha("2026-13-01"), false);
    assert.equal(esFecha("2026-12-1"), false);
  });

  test("esPrimerDiaDeMes exige el día 01", () => {
    assert.equal(esPrimerDiaDeMes("2026-12-01"), true);
    assert.equal(esPrimerDiaDeMes("2026-12-15"), false);
  });

  test("sumarMeses cruza años", () => {
    assert.equal(sumarMeses("2026-12-01", 1), "2027-01-01");
    assert.equal(sumarMeses("2026-01-01", 11), "2026-12-01");
  });
});

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { ALFABETO, generarCodigo, normalizarCodigo } = require("../utils/codigoSeguimiento");

const FORMATO = /^QJ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

describe("RF-68: código de seguimiento", () => {
  it("tiene el formato QJ-XXXX-XXXX", () => {
    for (let i = 0; i < 500; i += 1) assert.match(generarCodigo(), FORMATO);
  });

  it("usa el alfabeto Crockford: sin I, L, O ni U", () => {
    assert.equal(ALFABETO.length, 32);
    assert.doesNotMatch(ALFABETO, /[ILOU]/);
  });

  it("no se repite ni sigue una secuencia en 20 000 códigos", () => {
    const codigos = Array.from({ length: 20000 }, generarCodigo);
    assert.equal(new Set(codigos).size, codigos.length);
    const ordenados = [...codigos].sort();
    assert.notDeepEqual(codigos, ordenados);
  });

  it("reparte los caracteres de manera uniforme (no adivinable)", () => {
    const conteo = new Map();
    for (let i = 0; i < 20000; i += 1) {
      for (const caracter of generarCodigo().slice(3).replace("-", "")) {
        conteo.set(caracter, (conteo.get(caracter) ?? 0) + 1);
      }
    }
    assert.equal(conteo.size, 32);
    const esperado = (20000 * 8) / 32;
    for (const veces of conteo.values()) assert.ok(Math.abs(veces - esperado) < esperado * 0.15);
  });

  describe("normalizarCodigo", () => {
    for (const [entrada, esperado] of [
      ["QJ-7K3M-9XQ2", "QJ-7K3M-9XQ2"],
      ["qj-7k3m-9xq2", "QJ-7K3M-9XQ2"],
      ["  qj 7k3m 9xq2 ", "QJ-7K3M-9XQ2"],
      ["7K3M9XQ2", "QJ-7K3M-9XQ2"],
      ["QJ-34OK-ALDK", "QJ-340K-A1DK"],
      ["qj-34ok-aidk", "QJ-340K-A1DK"],
    ]) {
      it(`«${entrada}» → ${esperado}`, () => assert.equal(normalizarCodigo(entrada), esperado));
    }

    for (const entrada of ["", "hola", "QJ-1234", "QJ-UUUU-1234", "QJ-1234-56789", 12345678, null, undefined, "x".repeat(100)]) {
      it(`rechaza ${JSON.stringify(entrada)}`, () => assert.equal(normalizarCodigo(entrada), null));
    }
  });
});

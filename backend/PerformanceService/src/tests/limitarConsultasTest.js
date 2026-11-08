const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { crearLimitador } = require("../middlewares/limitarConsultas");

function preparar({ maximo = 3, ventanaMs = 60_000 } = {}) {
  let ahora = 1_000_000;
  const limitar = crearLimitador({ maximo, ventanaMs, ahora: () => ahora });
  const consultar = (ip) => {
    const cabeceras = {};
    let resultado;
    limitar({ ip }, { set: (clave, valor) => (cabeceras[clave] = valor) }, (error) => (resultado = error ?? "ok"));
    return { resultado, cabeceras };
  };
  return { consultar, avanzar: (ms) => (ahora += ms) };
}

describe("RF-68: límite de consultas por código (fuerza bruta)", () => {
  it("deja pasar hasta el máximo y luego responde 429 con Retry-After", () => {
    const { consultar } = preparar();
    for (let i = 0; i < 3; i += 1) assert.equal(consultar("10.0.0.1").resultado, "ok");
    const { resultado, cabeceras } = consultar("10.0.0.1");
    assert.equal(resultado.estado, 429);
    assert.equal(resultado.message, "Demasiados intentos de consulta. Espere 1 minuto e intente nuevamente.");
    assert.equal(cabeceras["Retry-After"], "60");
  });

  it("cuenta cada IP por separado", () => {
    const { consultar } = preparar();
    for (let i = 0; i < 4; i += 1) consultar("10.0.0.1");
    assert.equal(consultar("10.0.0.2").resultado, "ok");
  });

  it("vuelve a permitir consultas al terminar la ventana", () => {
    const { consultar, avanzar } = preparar();
    for (let i = 0; i < 4; i += 1) consultar("10.0.0.1");
    avanzar(30_000);
    assert.equal(consultar("10.0.0.1").cabeceras["Retry-After"], "30");
    avanzar(30_000);
    assert.equal(consultar("10.0.0.1").resultado, "ok");
  });

  it("indica los minutos en plural cuando la espera es larga", () => {
    const { consultar } = preparar({ maximo: 1, ventanaMs: 15 * 60_000 });
    consultar("10.0.0.1");
    assert.match(consultar("10.0.0.1").resultado.message, /Espere 15 minutos/);
  });
});

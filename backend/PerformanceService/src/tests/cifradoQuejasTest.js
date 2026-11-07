const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { cifrar, descifrar, cifrarTexto, descifrarTexto } = require("../utils/cifrado");

const CLAVE = randomBytes(32).toString("hex");

describe("RF-68: cifrado AES-256-GCM de las quejas", () => {
  let claveAnterior;

  beforeEach(() => {
    claveAnterior = process.env.QUEJAS_CLAVE_CIFRADO;
    process.env.QUEJAS_CLAVE_CIFRADO = CLAVE;
  });

  afterEach(() => {
    if (claveAnterior === undefined) delete process.env.QUEJAS_CLAVE_CIFRADO;
    else process.env.QUEJAS_CLAVE_CIFRADO = claveAnterior;
  });

  it("descifra el mismo texto, con tildes y saltos de línea", () => {
    const texto = "Acoso en el almacén:\nel supervisor grita «a diario».";
    assert.equal(descifrarTexto(cifrarTexto(texto)), texto);
  });

  it("guarda iv (12 bytes) + authTag (16 bytes) + texto cifrado en un solo valor", () => {
    const paquete = cifrarTexto("hola mundo");
    assert.equal(paquete.length, 12 + 16 + Buffer.byteLength("hola mundo"));
    assert.ok(!paquete.includes(Buffer.from("hola mundo")));
  });

  it("usa un iv distinto en cada cifrado: el mismo texto nunca da el mismo resultado", () => {
    const a = cifrarTexto("misma queja");
    const b = cifrarTexto("misma queja");
    assert.notDeepEqual(a, b);
    assert.notDeepEqual(a.subarray(0, 12), b.subarray(0, 12));
  });

  it("detecta un valor alterado (authTag) y no lo descifra", () => {
    const paquete = cifrar(Buffer.from("contenido sensible"));
    paquete[paquete.length - 1] ^= 0xff;
    assert.throws(() => descifrar(paquete));
  });

  it("no descifra con otra clave", () => {
    const paquete = cifrarTexto("contenido sensible");
    process.env.QUEJAS_CLAVE_CIFRADO = randomBytes(32).toString("hex");
    assert.throws(() => descifrarTexto(paquete));
  });

  it("acepta la clave en base64", () => {
    process.env.QUEJAS_CLAVE_CIFRADO = randomBytes(32).toString("base64");
    assert.equal(descifrarTexto(cifrarTexto("ok")), "ok");
  });

  for (const [caso, valor] of [
    ["vacía", ""],
    ["corta", "abc123"],
    ["de 16 bytes", randomBytes(16).toString("hex")],
  ]) {
    it(`rechaza una clave ${caso}`, () => {
      process.env.QUEJAS_CLAVE_CIFRADO = valor;
      assert.throws(() => cifrarTexto("x"), /QUEJAS_CLAVE_CIFRADO debe ser una clave de 32 bytes/);
    });
  }
});

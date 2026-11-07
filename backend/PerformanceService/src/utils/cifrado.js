const crypto = require("node:crypto");

const ALGORITMO = "aes-256-gcm";
const LARGO_IV = 12;
const LARGO_ETIQUETA = 16;

function obtenerClave() {
  const valor = process.env.QUEJAS_CLAVE_CIFRADO?.trim() ?? "";
  const clave = /^[0-9a-f]{64}$/i.test(valor) ? Buffer.from(valor, "hex") : Buffer.from(valor, "base64");
  if (clave.length !== 32) {
    throw new Error("QUEJAS_CLAVE_CIFRADO debe ser una clave de 32 bytes (64 caracteres hex o base64).");
  }
  return clave;
}

function cifrar(datos) {
  const iv = crypto.randomBytes(LARGO_IV);
  const cifrador = crypto.createCipheriv(ALGORITMO, obtenerClave(), iv, { authTagLength: LARGO_ETIQUETA });
  const cifrado = Buffer.concat([cifrador.update(datos), cifrador.final()]);
  return Buffer.concat([iv, cifrador.getAuthTag(), cifrado]);
}

function descifrar(paquete) {
  const iv = paquete.subarray(0, LARGO_IV);
  const etiqueta = paquete.subarray(LARGO_IV, LARGO_IV + LARGO_ETIQUETA);
  const descifrador = crypto.createDecipheriv(ALGORITMO, obtenerClave(), iv, { authTagLength: LARGO_ETIQUETA });
  descifrador.setAuthTag(etiqueta);
  return Buffer.concat([descifrador.update(paquete.subarray(LARGO_IV + LARGO_ETIQUETA)), descifrador.final()]);
}

const cifrarTexto = (texto) => cifrar(Buffer.from(texto, "utf8"));
const descifrarTexto = (paquete) => descifrar(paquete).toString("utf8");

module.exports = { obtenerClave, cifrar, descifrar, cifrarTexto, descifrarTexto };

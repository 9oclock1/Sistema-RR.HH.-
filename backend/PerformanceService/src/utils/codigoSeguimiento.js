const { randomInt } = require("node:crypto");

const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CARACTER_VALIDO = new RegExp(`^[${ALFABETO}]{8}$`);
const EQUIVALENTES = { O: "0", I: "1", L: "1" };

const bloque = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

const generarCodigo = () => `QJ-${bloque()}-${bloque()}`;

function normalizarCodigo(entrada) {
  if (typeof entrada !== "string" || entrada.length > 40) return null;
  let limpio = entrada.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (limpio.length === 10 && limpio.startsWith("QJ")) limpio = limpio.slice(2);
  limpio = limpio.replace(/[OIL]/g, (letra) => EQUIVALENTES[letra]);
  if (!CARACTER_VALIDO.test(limpio)) return null;
  return `QJ-${limpio.slice(0, 4)}-${limpio.slice(4)}`;
}

module.exports = { ALFABETO, generarCodigo, normalizarCodigo };

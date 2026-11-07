const { randomInt } = require("node:crypto");

const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const bloque = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

const generarCodigo = () => `QJ-${bloque()}-${bloque()}`;

module.exports = { ALFABETO, generarCodigo };

const { randomBytes, scryptSync, timingSafeEqual } = require("node:crypto");

const LARGO_CLAVE = 64;

// Formato guardado: scrypt$<sal>$<clave>, ambos en hexadecimal.
function cifrarContrasena(contrasena) {
  const sal = randomBytes(16);
  const clave = scryptSync(contrasena, sal, LARGO_CLAVE);
  return `scrypt$${sal.toString("hex")}$${clave.toString("hex")}`;
}

function verificarContrasena(contrasena, guardado) {
  const [algoritmo, sal, clave] = String(guardado ?? "").split("$");
  if (algoritmo !== "scrypt" || !sal || !clave) return false;
  const esperada = Buffer.from(clave, "hex");
  const calculada = scryptSync(contrasena, Buffer.from(sal, "hex"), esperada.length);
  return timingSafeEqual(esperada, calculada);
}

// Para un correo inexistente se compara igual contra este hash: la respuesta tarda lo mismo.
const HASH_SIN_CUENTA = cifrarContrasena(randomBytes(12).toString("hex"));

module.exports = { cifrarContrasena, verificarContrasena, HASH_SIN_CUENTA };

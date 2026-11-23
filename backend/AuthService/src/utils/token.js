const jwt = require("jsonwebtoken");

const COOKIE = "rrhh_sesion";
const DURACION_S = 8 * 60 * 60;

function secreto() {
  const valor = process.env.JWT_SECRET;
  if (!valor) throw new Error("Falta la variable de entorno JWT_SECRET");
  return valor;
}

// sub: id del empleado; rol: rol con el que opera en el portal.
const firmar = ({ id_empleado, rol }) =>
  jwt.sign({ rol }, secreto(), { algorithm: "HS256", subject: id_empleado, expiresIn: DURACION_S });

// Devuelve { idEmpleado, rol } o null si el token falta, está alterado o venció.
function verificar(token) {
  if (!token) return null;
  try {
    const datos = jwt.verify(token, secreto(), { algorithms: ["HS256"] });
    return typeof datos.sub === "string" && typeof datos.rol === "string" ? { idEmpleado: datos.sub, rol: datos.rol } : null;
  } catch (error) {
    if (error.message.startsWith("Falta")) throw error;
    return null;
  }
}

function leerCookie(cabecera, nombre = COOKIE) {
  for (const parte of String(cabecera ?? "").split(";")) {
    const [clave, ...valor] = parte.trim().split("=");
    if (clave === nombre) return decodeURIComponent(valor.join("="));
  }
  return null;
}

const opcionesCookie = { httpOnly: true, sameSite: "strict", path: "/" };

module.exports = { COOKIE, DURACION_S, firmar, verificar, leerCookie, opcionesCookie };

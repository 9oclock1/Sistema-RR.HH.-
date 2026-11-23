const jwt = require("jsonwebtoken");
const { ErrorApp } = require("../utils/errores");

const COOKIE = "rrhh_sesion";

function leerToken(req) {
  const [tipo, valor] = (req.get("Authorization") ?? "").split(" ");
  if (tipo === "Bearer" && valor) return valor;
  for (const parte of String(req.headers.cookie ?? "").split(";")) {
    const [clave, ...resto] = parte.trim().split("=");
    if (clave === COOKIE) return decodeURIComponent(resto.join("="));
  }
  return null;
}

// Identidad tomada del JWT firmado por AuthService (cookie de sesión o Authorization: Bearer). Las cabeceras
// X-Empleado-Id y X-Rol se ignoran en las rutas que usan este middleware.
module.exports = function autenticar(req, res, next) {
  const secreto = process.env.JWT_SECRET;
  if (!secreto) throw new Error("Falta la variable de entorno JWT_SECRET");
  const token = leerToken(req);
  if (!token) throw new ErrorApp(401, "Inicie sesión para continuar.", undefined, "SIN_SESION");
  let datos;
  try {
    datos = jwt.verify(token, secreto, { algorithms: ["HS256"] });
  } catch {
    throw new ErrorApp(401, "Su sesión no es válida o venció. Inicie sesión otra vez.", undefined, "SIN_SESION");
  }
  if (typeof datos.sub !== "string" || typeof datos.rol !== "string") {
    throw new ErrorApp(401, "Su sesión no es válida o venció. Inicie sesión otra vez.", undefined, "SIN_SESION");
  }
  req.identidad = { idEmpleado: datos.sub, rol: datos.rol };
  next();
};

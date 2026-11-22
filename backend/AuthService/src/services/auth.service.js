const modelo = require("../models/usuarios.model");
const { ErrorApp } = require("../utils/errores");
const { verificarContrasena, HASH_SIN_CUENTA } = require("../utils/contrasenas");
const { firmar, verificar } = require("../utils/token");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const publico = (u) => ({ id_empleado: u.id_empleado, correo: u.correo, rol: u.rol });

function validarCredenciales(cuerpo) {
  const correo = typeof cuerpo?.correo === "string" ? cuerpo.correo.trim().toLowerCase() : "";
  const contrasena = typeof cuerpo?.contrasena === "string" ? cuerpo.contrasena : "";
  const detalles = [];
  if (!correo) detalles.push({ campo: "correo", mensaje: "Ingrese su correo." });
  if (!contrasena) detalles.push({ campo: "contrasena", mensaje: "Ingrese su contraseña." });
  if (detalles.length) throw new ErrorApp(400, "Faltan datos para iniciar sesión", detalles);
  return { correo, contrasena };
}

async function iniciarSesion(cuerpo) {
  const { correo, contrasena } = validarCredenciales(cuerpo);
  const usuario = await modelo.buscarPorCorreo(correo);
  const valida = verificarContrasena(contrasena, usuario?.hash_contrasena ?? HASH_SIN_CUENTA);
  if (!usuario || !valida) throw new ErrorApp(401, "Correo o contraseña incorrectos.");
  if (!usuario.esta_activo) throw new ErrorApp(403, "Su cuenta está desactivada. Comuníquese con RRHH.");
  return { token: firmar(usuario), usuario: publico(usuario) };
}

// La sesión vale si el token es válido y la cuenta sigue activa; si no, null (el portal sigue con el usuario de
// prueba). El rol es el del token: el que ven los servicios.
async function obtenerSesion(token) {
  const datos = verificar(token);
  if (!datos || !UUID_RE.test(datos.idEmpleado)) return null;
  const usuario = await modelo.buscarPorEmpleado(datos.idEmpleado);
  if (!usuario?.esta_activo) return null;
  return { ...publico(usuario), rol: datos.rol };
}

module.exports = { iniciarSesion, obtenerSesion };

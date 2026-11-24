const jwt = require("jsonwebtoken");
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
  if (!usuario.esta_activo) {
    const revocacion = await modelo.obtenerUltimaRevocacion?.(usuario.id_empleado);
    if (revocacion?.motivo === "DESVINCULACION") {
      throw new ErrorApp(
        403,
        "Su acceso al ERP fue revocado por el cierre de su relación laboral. Comuníquese con RRHH.",
        undefined,
        "ACCESO_REVOCADO"
      );
    }
    throw new ErrorApp(403, "Su cuenta está desactivada. Comuníquese con RRHH.");
  }
  return { token: firmar(usuario), usuario: publico(usuario) };
}

// La sesión vale si el token es válido, la cuenta sigue activa y el token es posterior a la última revocación.
async function obtenerSesion(token) {
  const datos = verificar(token);
  if (!datos || !UUID_RE.test(datos.idEmpleado)) return null;
  const usuario = await modelo.buscarPorEmpleado(datos.idEmpleado);
  if (!usuario?.esta_activo) return null;
  const revocacion = await modelo.obtenerUltimaRevocacion?.(datos.idEmpleado);
  if (revocacion?.revocado_en) {
    const iat = jwt.decode(token)?.iat;
    const revocadoSeg = new Date(revocacion.revocado_en).getTime() / 1000;
    if (typeof iat !== "number" || iat < revocadoSeg) return null;
  }
  return { ...publico(usuario), rol: datos.rol };
}

function normalizarUuid(valor, campo) {
  if (valor === undefined || valor === null || valor === "") return null;
  if (typeof valor !== "string" || !UUID_RE.test(valor.trim())) {
    throw new ErrorApp(400, `El campo ${campo} debe ser un UUID válido.`);
  }
  return valor.trim().toLowerCase();
}

async function revocarAccesoEmpleado(idEmpleado, cuerpo = {}) {
  const id = normalizarUuid(idEmpleado, "idEmpleado");
  if (!id) throw new ErrorApp(400, "El identificador del colaborador es inválido.");
  const idProceso = normalizarUuid(cuerpo?.id_proceso, "id_proceso");
  const solicitadoPor = normalizarUuid(cuerpo?.solicitado_por, "solicitado_por");
  return modelo.revocarAcceso({ idEmpleado: id, idProceso, solicitadoPor });
}

async function consultarAccesoEmpleado(idEmpleado) {
  const id = normalizarUuid(idEmpleado, "idEmpleado");
  if (!id) throw new ErrorApp(400, "El identificador del colaborador es inválido.");
  const [usuario, revocacion] = await Promise.all([
    modelo.buscarPorEmpleado(id),
    modelo.obtenerUltimaRevocacion(id),
  ]);
  return {
    tiene_cuenta: Boolean(usuario),
    esta_activo: usuario ? Boolean(usuario.esta_activo) : null,
    revocado_en: revocacion?.revocado_en ?? null,
  };
}

module.exports = { iniciarSesion, obtenerSesion, revocarAccesoEmpleado, consultarAccesoEmpleado };

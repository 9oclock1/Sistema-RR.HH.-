const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const modelo = require("../models/planillasTributarias.model");
const empleadosCliente = require("../clients/empleados.cliente");

const ROLES_PLANILLAS_FISCALES = ["admin", "contador"];
const MENSAJE_SIN_PERMISO = "Solo el Administrador de RRHH o el Contador pueden consultar las planillas tributaria y de aportes.";

const ESTADOS_NO_CERRADA = { BORRADOR: "en borrador", APROBADA: "aprobada, pero aún no cerrada" };

const FORMATOS = {
  xlsx: { extension: "xlsx", tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  txt: { extension: "txt", tipo: "text/plain; charset=utf-8" },
};

const nombreMes = (periodo) =>
  new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${periodo}-01T00:00:00Z`));

function exigirResponsable({ rol } = {}) {
  if (!ROLES_PLANILLAS_FISCALES.includes((rol ?? "").trim().toLowerCase())) throw new ErrorApp(403, MENSAJE_SIN_PERMISO);
}

function validarIdPlanilla(valor) {
  if (!UUID_RE.test(valor ?? "")) throw new ErrorApp(404, "Planilla no encontrada");
  return valor.toLowerCase();
}

async function cargarPlanilla(db, idPlanilla) {
  const planilla = await modelo.obtenerPlanilla(db, validarIdPlanilla(idPlanilla));
  if (!planilla) throw new ErrorApp(404, "Planilla no encontrada");
  return planilla;
}

async function cargarPlanillaCerrada(db, idPlanilla) {
  const planilla = await cargarPlanilla(db, idPlanilla);
  if (planilla.estado !== "CERRADA") {
    throw new ErrorApp(
      409,
      `La planilla de ${nombreMes(planilla.periodo)} está ${ESTADOS_NO_CERRADA[planilla.estado] ?? planilla.estado.toLowerCase()}: solo se generan las planillas tributaria y de aportes cuando la planilla mensual está cerrada.`,
      undefined,
      "PLANILLA_NO_CERRADA"
    );
  }
  return planilla;
}

async function nombreDelResponsable(idResponsable) {
  try {
    const empleado = await empleadosCliente.obtenerEmpleado(idResponsable);
    const nombre = [empleado?.nombres, empleado?.apellidos].filter(Boolean).join(" ");
    return nombre || empleado?.nombre_completo || null;
  } catch {
    return null;
  }
}

function elegirFormato(valor, porDefecto) {
  if (valor === undefined || valor === null || valor === "") return porDefecto;
  const clave = String(valor).trim().toLowerCase();
  if (!Object.hasOwn(FORMATOS, clave)) {
    throw new ErrorApp(400, "El formato debe ser «xlsx» o «txt».", [{ campo: "formato", mensaje: "Formato inválido." }]);
  }
  return clave;
}

const sinGenerar = (nombre, periodo) =>
  new ErrorApp(404, `Todavía no se generó ${nombre} de ${nombreMes(periodo)}.`, undefined, "SIN_GENERAR");

module.exports = {
  FORMATOS,
  nombreMes,
  ROLES_PLANILLAS_FISCALES,
  exigirResponsable,
  validarIdPlanilla,
  cargarPlanilla,
  cargarPlanillaCerrada,
  elegirFormato,
  nombreDelResponsable,
  sinGenerar,
};

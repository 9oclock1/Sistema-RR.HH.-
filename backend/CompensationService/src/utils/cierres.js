const { ErrorApp } = require("./errores");

const ORIGEN_RRHH = { grupo: "F", modulo: "RRHH" };
const VERSION_ESQUEMA = 1;

const DESTINOS_CIERRE = {
  VENTAS: {
    grupo: "E",
    modulo: "Marketplace y Ventas / POS",
    accesos: ["CREDENCIALES_POS", "CAJAS_REGISTRADORAS", "ROLES_OPERATIVOS"],
  },
  INVENTARIOS: {
    grupo: "I",
    modulo: "Gestión de Inventarios y Almacén",
    accesos: ["CREDENCIALES_ALMACEN", "TERMINALES_MOVILES", "ROLES_OPERATIVOS"],
  },
  ENTREGAS: {
    grupo: "H",
    modulo: "Gestión de Entregas y Despachos",
    accesos: ["CREDENCIALES_DESPACHO", "TERMINALES_MOVILES", "ROLES_OPERATIVOS"],
  },
  CRM: {
    grupo: "B",
    modulo: "CRM",
    accesos: ["CREDENCIALES_CRM", "ROLES_OPERATIVOS"],
  },
};

const CLAVES_DESTINO = Object.keys(DESTINOS_CIERRE);
const FILTROS_ESTADO_CIERRE = ["PENDIENTE_CIERRE", "EN_PROCESO", "COMPLETADO", "CON_ALERTAS"];
const ESTADOS_REVOCACION = ["PENDIENTE", "ENVIADA", "CONFIRMADA", "RECHAZADA", "VENCIDA"];
const ESTADOS_FINIQUITO_CERRABLE = ["APROBADO", "PAGADO"];

function validarFiltroEstadoCierre(estado) {
  if (estado === undefined || estado === null || estado === "") return null;
  const normalizado = String(estado).trim().toUpperCase();
  if (!FILTROS_ESTADO_CIERRE.includes(normalizado)) {
    throw new ErrorApp(400, "Filtros inválidos", [
      { campo: "estado", mensaje: `Use uno de: ${FILTROS_ESTADO_CIERRE.join(", ")}.` },
    ]);
  }
  return normalizado;
}

function resumirEstadoCierre(revocaciones = []) {
  if (revocaciones.length === CLAVES_DESTINO.length && revocaciones.every((r) => r.estado === "CONFIRMADA")) {
    return "COMPLETADO";
  }
  if (revocaciones.some((r) => r.estado === "RECHAZADA" || r.estado === "VENCIDA")) {
    return "CON_ALERTAS";
  }
  return "EN_PROCESO";
}

function evaluarRequisitosCierre({ proceso, finiquito, cierre, estadosAbiertos = ["INICIADO", "EN_CURSO"] }) {
  if (cierre) {
    return {
      puede_cerrar: false,
      motivo: "El proceso de desvinculación ya fue cerrado definitivamente.",
      codigo: "PROCESO_YA_CERRADO",
    };
  }
  if (!proceso || !estadosAbiertos.includes(proceso.estado)) {
    return {
      puede_cerrar: false,
      motivo: "El proceso de desvinculación no está abierto.",
      codigo: "PROCESO_NO_ABIERTO",
    };
  }
  if (!finiquito || !ESTADOS_FINIQUITO_CERRABLE.includes(finiquito.estado)) {
    return {
      puede_cerrar: false,
      motivo: "Apruebe el finiquito antes de cerrar definitivamente la desvinculación.",
      codigo: "FINIQUITO_NO_APROBADO",
    };
  }
  return { puede_cerrar: true, motivo: null, codigo: null };
}

module.exports = {
  ORIGEN_RRHH,
  VERSION_ESQUEMA,
  DESTINOS_CIERRE,
  CLAVES_DESTINO,
  FILTROS_ESTADO_CIERRE,
  ESTADOS_REVOCACION,
  ESTADOS_FINIQUITO_CERRABLE,
  validarFiltroEstadoCierre,
  resumirEstadoCierre,
  evaluarRequisitosCierre,
};

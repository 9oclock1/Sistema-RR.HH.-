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
const ESCENARIOS_SIMULACION_CIERRE = ["CONFIRMADA", "RECHAZADA", "DUPLICADO", "INVALIDO"];

const TIPO_EMPLEADO_DESVINCULADO = "EMPLEADO_DESVINCULADO";
const TIPO_CONFIRMACION_REVOCACION = "CONFIRMACION_REVOCACION_ACCESOS";

const simulacionCierreActiva = () => process.env.SIMULAR_RESPUESTAS_CIERRE !== "false";

const demoraSimulacionCierreMs = () => {
  const texto = process.env.SIMULAR_RESPUESTAS_CIERRE_DEMORA_MS;
  if (texto === undefined || texto.trim() === "") return 3000;
  const n = Number(texto);
  return Number.isFinite(n) && n >= 0 ? n : 3000;
};

const revocacionPlazoSegundos = () => {
  const texto = process.env.REVOCACION_PLAZO_SEGUNDOS;
  if (texto === undefined || texto.trim() === "") return 45;
  const n = Number(texto);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 45;
};

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

function validarDestinoCierre(destino) {
  const normalizado = typeof destino === "string" ? destino.trim().toUpperCase() : "";
  if (!CLAVES_DESTINO.includes(normalizado)) {
    throw new ErrorApp(400, "Destino inválido", [
      { campo: "destino", mensaje: `Use uno de: ${CLAVES_DESTINO.join(", ")}.` },
    ]);
  }
  return normalizado;
}

function validarSimulacionEscenarioCierre(datos = {}) {
  const errores = [];
  const destino = typeof datos?.destino === "string" ? datos.destino.trim().toUpperCase() : "";
  const escenario = typeof datos?.escenario === "string" ? datos.escenario.trim().toUpperCase() : "";

  if (!CLAVES_DESTINO.includes(destino)) {
    errores.push({ campo: "destino", mensaje: `Use uno de: ${CLAVES_DESTINO.join(", ")}.` });
  }
  if (!ESCENARIOS_SIMULACION_CIERRE.includes(escenario)) {
    errores.push({ campo: "escenario", mensaje: `Use uno de: ${ESCENARIOS_SIMULACION_CIERRE.join(", ")}.` });
  }
  const motivo = typeof datos?.motivo === "string" ? datos.motivo.trim() : "";
  if (escenario === "RECHAZADA" && !motivo) {
    errores.push({ campo: "motivo", mensaje: "Indique el motivo del rechazo." });
  }
  if (errores.length > 0) {
    throw new ErrorApp(400, "Datos de simulación inválidos", errores);
  }
  const referencia = typeof datos?.referencia === "string" ? datos.referencia.trim().slice(0, 60) : "";
  return {
    destino,
    escenario,
    referencia: referencia || null,
    motivo: escenario === "RECHAZADA" ? motivo.slice(0, 255) : null,
  };
}

function validarSinRespuesta(datos = {}) {
  const destino = validarDestinoCierre(datos?.destino);
  if (typeof datos?.activo !== "boolean") {
    throw new ErrorApp(400, "Datos inválidos", [
      { campo: "activo", mensaje: "Indique verdadero o falso para el modo sin respuesta." },
    ]);
  }
  return { destino, activo: datos.activo };
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

function armarSobreCierre({ idMensaje, origen, destino, tipo, fecha, datos }) {
  return {
    encabezado: {
      id_mensaje: idMensaje,
      origen,
      destino,
      tipo,
      fecha,
      version_esquema: VERSION_ESQUEMA,
    },
    datos,
  };
}

// AC2: mensaje F → X de empleado desvinculado sin datos salariales ni del finiquito.
function armarMensajeDesvinculado({
  idMensaje,
  destino,
  idCierre,
  empleado,
  fechaRetiro,
  causal,
  cerradoEn,
  fecha = new Date().toISOString(),
}) {
  const cfg = DESTINOS_CIERRE[destino];
  return armarSobreCierre({
    idMensaje,
    origen: ORIGEN_RRHH,
    destino: { grupo: cfg.grupo, modulo: cfg.modulo },
    tipo: TIPO_EMPLEADO_DESVINCULADO,
    fecha,
    datos: {
      id_cierre: idCierre,
      empleado: {
        id_empleado: empleado.id_empleado,
        codigo_empleado: empleado.codigo_empleado,
        nombre_completo: empleado.nombre_completo,
        cargo: empleado.cargo ?? null,
        sucursal: empleado.sucursal ?? null,
      },
      fecha_retiro: fechaRetiro,
      causal,
      cerrado_en: new Date(cerradoEn).toISOString(),
      accesos_a_revocar: [...cfg.accesos],
    },
  });
}

function identificadorRecursoFijo(tipo, codigoEmpleado) {
  const codigo = codigoEmpleado || "EMP";
  switch (tipo) {
    case "CAJAS_REGISTRADORAS":
      return "CAJA-03";
    case "TERMINALES_MOVILES":
      return "TERM-17";
    case "CREDENCIALES_POS":
      return `pos.${codigo}`;
    case "CREDENCIALES_ALMACEN":
      return `alm.${codigo}`;
    case "CREDENCIALES_DESPACHO":
      return `desp.${codigo}`;
    case "CREDENCIALES_CRM":
      return `crm.${codigo}`;
    case "ROLES_OPERATIVOS":
      return `rol.${codigo}`;
    default:
      return `${tipo.toLowerCase()}.${codigo}`;
  }
}

function construirRecursosRevocados(accesos = [], codigoEmpleado = "") {
  return accesos.map((tipo) => ({
    tipo,
    identificador: identificadorRecursoFijo(tipo, codigoEmpleado),
  }));
}

function armarRespuestaSimuladaCierre({
  idMensaje,
  destino,
  idCierre,
  idMensajeOrigen,
  resultado = "CONFIRMADA",
  accesosARevocar = [],
  codigoEmpleado = "",
  referencia = null,
  motivo = null,
  fecha = new Date().toISOString(),
}) {
  const cfg = DESTINOS_CIERRE[destino];
  const esConfirmada = resultado === "CONFIRMADA";
  const refDefecto = `REV-${cfg.grupo}-${String(idCierre).slice(0, 6).toUpperCase()}`;
  const listaAccesos = accesosARevocar.length > 0 ? accesosARevocar : cfg.accesos;

  return armarSobreCierre({
    idMensaje,
    origen: { grupo: cfg.grupo, modulo: cfg.modulo },
    destino: ORIGEN_RRHH,
    tipo: TIPO_CONFIRMACION_REVOCACION,
    fecha,
    datos: {
      id_cierre: idCierre,
      id_mensaje_origen: idMensajeOrigen,
      resultado,
      recursos_revocados: esConfirmada ? construirRecursosRevocados(listaAccesos, codigoEmpleado) : [],
      referencia: esConfirmada ? referencia || refDefecto : null,
      motivo: resultado === "RECHAZADA" ? motivo : null,
    },
  });
}

module.exports = {
  ORIGEN_RRHH,
  VERSION_ESQUEMA,
  DESTINOS_CIERRE,
  CLAVES_DESTINO,
  FILTROS_ESTADO_CIERRE,
  ESTADOS_REVOCACION,
  ESTADOS_FINIQUITO_CERRABLE,
  ESCENARIOS_SIMULACION_CIERRE,
  TIPO_EMPLEADO_DESVINCULADO,
  TIPO_CONFIRMACION_REVOCACION,
  simulacionCierreActiva,
  demoraSimulacionCierreMs,
  revocacionPlazoSegundos,
  validarFiltroEstadoCierre,
  validarDestinoCierre,
  validarSimulacionEscenarioCierre,
  validarSinRespuesta,
  resumirEstadoCierre,
  evaluarRequisitosCierre,
  armarMensajeDesvinculado,
  construirRecursosRevocados,
  armarRespuestaSimuladaCierre,
};

const { createHash } = require("node:crypto");
const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");

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
const GRUPOS_DESTINO_CIERRE = Object.fromEntries(
  Object.entries(DESTINOS_CIERRE).map(([clave, cfg]) => [cfg.grupo, clave])
);
const FILTROS_ESTADO_CIERRE = ["PENDIENTE_CIERRE", "EN_PROCESO", "COMPLETADO", "CON_ALERTAS"];
const ESTADOS_REVOCACION = ["PENDIENTE", "ENVIADA", "CONFIRMADA", "RECHAZADA", "VENCIDA"];
const ESTADOS_FINIQUITO_CERRABLE = ["APROBADO", "PAGADO"];
const ESCENARIOS_SIMULACION_CIERRE = ["CONFIRMADA", "RECHAZADA", "DUPLICADO", "INVALIDO"];
const ESTADOS_MENSAJE_ENTRANTE_CIERRE = ["RECIBIDO", "PROCESADO", "IGNORADO", "EN_DLQ"];
const RESULTADOS_CIERRE = ["CONFIRMADA", "RECHAZADA"];

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

const revocacionMaximoReenvios = () => {
  const texto = process.env.REVOCACION_MAXIMO_REENVIOS;
  if (texto === undefined || texto.trim() === "") return 3;
  const n = Number(texto);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 3;
};

const cierreMaximoIntentos = () => {
  const texto = process.env.CIERRE_MAXIMO_INTENTOS;
  if (texto === undefined || texto.trim() === "") return 3;
  const n = Number(texto);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 3;
};

const esperaReentregaCierre = (intentos) => {
  const baseTexto = process.env.CIERRE_REINTENTO_BASE_MS;
  const base =
    baseTexto !== undefined && baseTexto.trim() !== "" && Number.isFinite(Number(baseTexto))
      ? Math.max(0, Number(baseTexto))
      : 1000;
  return Math.min(base * 2 ** Math.max(intentos - 1, 0), 30 * 1000);
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

const esObjeto = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);
const textoRecortado = (valor, max) => (typeof valor === "string" && valor.trim() ? valor.trim().slice(0, max) : null);

function analizarJson(texto) {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

function identificarMensajeCierre(texto) {
  const cuerpo = analizarJson(texto);
  const idRaw = cuerpo?.encabezado?.id_mensaje;
  const hash = createHash("sha256").update(String(texto ?? "")).digest("hex").slice(0, 16);
  const idMensaje =
    typeof idRaw === "string" && idRaw.trim() !== "" && idRaw.trim().length <= 100
      ? idRaw.trim()
      : `invalido-${hash}`;
  const origenRaw = cuerpo?.encabezado?.origen?.grupo;
  const origen = typeof origenRaw === "string" && origenRaw.trim() !== "" ? origenRaw.trim().slice(0, 10) : null;
  const tipoRaw = cuerpo?.encabezado?.tipo;
  const tipoEvento = typeof tipoRaw === "string" && tipoRaw.trim() !== "" ? tipoRaw.trim().slice(0, 60) : null;
  const idCierreRaw = cuerpo?.datos?.id_cierre;

  return {
    cuerpo: cuerpo === undefined ? null : cuerpo,
    idMensaje,
    origen,
    tipoEvento,
    idCierre: typeof idCierreRaw === "string" && UUID_RE.test(idCierreRaw) ? idCierreRaw.toLowerCase() : null,
    destino:
      tipoEvento === TIPO_CONFIRMACION_REVOCACION && origen && Object.hasOwn(GRUPOS_DESTINO_CIERRE, origen)
        ? GRUPOS_DESTINO_CIERRE[origen]
        : null,
  };
}

function normalizarRecursosRevocados(lista) {
  if (lista === undefined || lista === null) return [];
  if (!Array.isArray(lista)) return null;
  const salida = [];
  for (const item of lista) {
    if (!esObjeto(item)) return null;
    const tipo = textoRecortado(item.tipo, 60);
    const identificador = textoRecortado(item.identificador, 100);
    if (!tipo || !identificador) return null;
    salida.push({ tipo, identificador });
  }
  return salida;
}

function leerConfirmacionCierre(texto) {
  const cuerpo = analizarJson(texto);
  if (cuerpo === undefined) return { errores: ["El mensaje no es un JSON válido."] };
  if (!esObjeto(cuerpo)) return { errores: ["El mensaje debe ser un objeto JSON."] };

  const errores = [];
  const encabezado = cuerpo.encabezado;
  let destino = null;

  if (!esObjeto(encabezado)) {
    errores.push("Falta el encabezado del mensaje.");
  } else {
    const tipo = encabezado.tipo;
    if (tipo !== TIPO_CONFIRMACION_REVOCACION) {
      errores.push(`Tipo de evento no reconocido para cierres: ${tipo ?? "(vacío)"}.`);
    }
    const grupoOrigen = encabezado.origen?.grupo;
    if (!grupoOrigen || !Object.hasOwn(GRUPOS_DESTINO_CIERRE, grupoOrigen)) {
      errores.push(`Grupo de origen no válido para revocación de accesos: ${grupoOrigen ?? "(vacío)"}.`);
    } else {
      destino = GRUPOS_DESTINO_CIERRE[grupoOrigen];
    }
    if (encabezado.destino?.grupo !== ORIGEN_RRHH.grupo) {
      errores.push(`El destino debe ser el grupo ${ORIGEN_RRHH.grupo} (RRHH).`);
    }
  }

  const datos = cuerpo.datos;
  if (!esObjeto(datos)) {
    errores.push("Faltan los datos del mensaje.");
    return { errores };
  }
  if (typeof datos.id_cierre !== "string" || !UUID_RE.test(datos.id_cierre)) {
    errores.push("datos.id_cierre debe ser un UUID válido.");
  }
  if (typeof datos.id_mensaje_origen !== "string" || !UUID_RE.test(datos.id_mensaje_origen)) {
    errores.push("datos.id_mensaje_origen debe ser el UUID del mensaje enviado por RRHH.");
  }
  if (!RESULTADOS_CIERRE.includes(datos.resultado)) {
    errores.push("datos.resultado debe ser CONFIRMADA o RECHAZADA.");
  }

  const motivo = textoRecortado(datos.motivo, 255);
  if (datos.resultado === "RECHAZADA" && !motivo) {
    errores.push("Una respuesta RECHAZADA necesita datos.motivo.");
  }

  const recursos = normalizarRecursosRevocados(datos.recursos_revocados);
  if (datos.resultado === "CONFIRMADA" && recursos === null) {
    errores.push("datos.recursos_revocados debe ser una lista de objetos { tipo, identificador }.");
  }

  if (errores.length > 0) return { errores };
  const confirmada = datos.resultado === "CONFIRMADA";
  return {
    confirmacion: {
      destino,
      idCierre: datos.id_cierre.toLowerCase(),
      idMensajeOrigen: datos.id_mensaje_origen.toLowerCase(),
      resultado: datos.resultado,
      recursosRevocados: confirmada ? recursos : [],
      referencia: confirmada ? textoRecortado(datos.referencia, 60) : null,
      motivo: confirmada ? null : motivo,
    },
  };
}

function construirAvisoVencimientoReenvio({ nombreEmpleado, modulo, grupo, plazoSegundos, numeroReenvio, maxReenvios }) {
  return {
    asunto: `Cierre de ${nombreEmpleado}: ${modulo} no confirmó la revocación de accesos`,
    contenido: `No llegó la confirmación de ${modulo} (grupo ${grupo}) en ${plazoSegundos} s. Se reenvió el evento (reenvío ${numeroReenvio} de ${maxReenvios}).`,
  };
}

function construirAvisoVencimientoAgotado({ nombreEmpleado, modulo, maxReenvios }) {
  return {
    asunto: `Cierre de ${nombreEmpleado}: ${modulo} no confirmó la revocación de accesos`,
    contenido: `${modulo} no confirmó la revocación de accesos de ${nombreEmpleado} tras ${maxReenvios} reenvíos. Revise el caso y use «Reenviar» o coordine la revocación manual.`,
  };
}

function construirAvisoRechazoRevocacion({ nombreEmpleado, modulo, grupo, motivo }) {
  return {
    asunto: `Cierre de ${nombreEmpleado}: ${modulo} rechazó la revocación de accesos`,
    contenido: `${modulo} (grupo ${grupo}) rechazó la revocación de accesos de ${nombreEmpleado}: ${motivo}. Revise el caso y use «Reenviar».`,
  };
}

module.exports = {
  ORIGEN_RRHH,
  VERSION_ESQUEMA,
  DESTINOS_CIERRE,
  CLAVES_DESTINO,
  GRUPOS_DESTINO_CIERRE,
  FILTROS_ESTADO_CIERRE,
  ESTADOS_REVOCACION,
  ESTADOS_FINIQUITO_CERRABLE,
  ESCENARIOS_SIMULACION_CIERRE,
  ESTADOS_MENSAJE_ENTRANTE_CIERRE,
  RESULTADOS_CIERRE,
  TIPO_EMPLEADO_DESVINCULADO,
  TIPO_CONFIRMACION_REVOCACION,
  simulacionCierreActiva,
  demoraSimulacionCierreMs,
  revocacionPlazoSegundos,
  revocacionMaximoReenvios,
  cierreMaximoIntentos,
  esperaReentregaCierre,
  validarFiltroEstadoCierre,
  validarDestinoCierre,
  validarSimulacionEscenarioCierre,
  validarSinRespuesta,
  resumirEstadoCierre,
  evaluarRequisitosCierre,
  armarMensajeDesvinculado,
  construirRecursosRevocados,
  armarRespuestaSimuladaCierre,
  identificarMensajeCierre,
  leerConfirmacionCierre,
  construirAvisoVencimientoReenvio,
  construirAvisoVencimientoAgotado,
  construirAvisoRechazoRevocacion,
};

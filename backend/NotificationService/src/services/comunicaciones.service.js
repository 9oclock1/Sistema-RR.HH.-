const modelo = require("../models/comunicaciones.model");
const empleadosServicio = require("./empleados.service");
const { ErrorApp } = require("../utils/errores");
const { validarCamposObligatorios, validarUuid } = require("../utils/validaciones");
const { ALCANCE, TIPO, ALCANCE_ID, TIPO_ID } = require("../config/catalogos");

// ==========================================
// RF-64: COMUNICACIONES DIRECTAS
// ==========================================
async function enviarComunicacionDirecta({
  idUsuarioRemitente,
  idEmpleadoDestinatario,
  asunto,
  contenido,
  requiereConfirmacion = false,
  remitenteNombre = null,
}) {
  // Remitente obligatorio: no permitir fallback silencioso al destinatario
  if (!idUsuarioRemitente || typeof idUsuarioRemitente !== "string" || !idUsuarioRemitente.trim()) {
    throw new ErrorApp(401, "Identifíquese para enviar una comunicación directa.");
  }
  const idRemitenteLimpio = validarUuid(idUsuarioRemitente, "id_usuario_remitente");

  // Destinatario obligatorio y con UUID válido
  if (!idEmpleadoDestinatario || typeof idEmpleadoDestinatario !== "string" || !idEmpleadoDestinatario.trim()) {
    throw new ErrorApp(400, "Debe seleccionar un empleado destinatario.", [
      { campo: "id_empleado_destinatario", mensaje: "El destinatario es requerido." },
    ]);
  }
  const idDestinatarioLimpio = validarUuid(idEmpleadoDestinatario, "id_empleado_destinatario");

  // Criterio 2: Validación de campos obligatorios
  const { asunto: asuntoValido, contenido: contenidoValido } = validarCamposObligatorios(asunto, contenido);

  // Criterio 4: Verificar que el destinatario sea un empleado ACTIVO
  const empleadoDestino = await empleadosServicio.verificarEmpleadoActivo(idDestinatarioLimpio);

  // Resolver nombre y cargo real del remitente para que no diga siempre "Administración de RRHH"
  let remitenteNombreFinal = remitenteNombre;
  if (!remitenteNombreFinal || remitenteNombreFinal === "Supervisor / RRHH" || remitenteNombreFinal === "Supervisor") {
    const datosRem = await empleadosServicio.obtenerNombreEmpleado(idRemitenteLimpio);
    if (datosRem && datosRem.nombre_completo) {
      remitenteNombreFinal = `${datosRem.nombre_completo} (${datosRem.cargo || "Supervisor"})`;
    } else {
      remitenteNombreFinal = "Supervisor";
    }
  }

  // Criterio 1: Almacenar y entregar a la bandeja del destinatario
  const comunicacion = await modelo.crearComunicacion({
    idTipo: TIPO_ID[TIPO.DIRECTA],
    idAlcance: ALCANCE_ID[ALCANCE.INDIVIDUAL],
    idUsuarioRemitente: idRemitenteLimpio,
    remitenteNombre: remitenteNombreFinal,
    asunto: asuntoValido,
    contenido: contenidoValido,
    requiereConfirmacion: Boolean(requiereConfirmacion),
    idDepartamentoDestino: null,
    idSucursalDestino: null,
    idsEmpleadosDestinatarios: [empleadoDestino.id_empleado],
  });

  return {
    ...comunicacion,
    destinatario: {
      id_empleado: empleadoDestino.id_empleado,
      nombre_completo: `${empleadoDestino.nombres} ${empleadoDestino.apellidos}`,
    },
    mensaje: "Mensaje directo enviado exitosamente a la bandeja del empleado.",
  };
}

// ==========================================
// RF-65: DISTRIBUCIÓN INSTITUCIONAL
// ==========================================
async function emitirComunicadoInstitucional({
  idUsuarioRemitente,
  tipoCodigo,
  alcanceCodigo,
  idDepartamentoDestino = null,
  idSucursalDestino = null,
  asunto,
  contenido,
  requiereConfirmacion = false,
  remitenteNombre = null,
}) {
  // Remitente obligatorio: no permitir fallback silencioso al primer destinatario
  if (!idUsuarioRemitente || typeof idUsuarioRemitente !== "string" || !idUsuarioRemitente.trim()) {
    throw new ErrorApp(401, "Identifíquese con un rol autorizado para emitir comunicados.");
  }
  const idRemitenteLimpio = validarUuid(idUsuarioRemitente, "id_usuario_remitente");

  // Validación estricta de tipo de comunicación: rechazar tipos desconocidos sin fallback silencioso
  const tipoAProbar = tipoCodigo || TIPO.COMUNICADO;
  if (![TIPO.COMUNICADO, TIPO.CIRCULAR, TIPO.REGLAMENTO].includes(tipoAProbar)) {
    throw new ErrorApp(
      400,
      `El tipo de comunicación «${tipoCodigo}» no es válido para comunicados institucionales. Valores permitidos: [${[TIPO.COMUNICADO, TIPO.CIRCULAR, TIPO.REGLAMENTO].join(", ")}].`,
      [{ campo: "tipo_codigo", mensaje: "Tipo de comunicación inválido." }]
    );
  }

  // Validación estricta de alcance: rechazar scopes mal tipados (ej. DEPARTAMENT0) sin fallback a GENERAL
  const alcanceAProbar = alcanceCodigo || ALCANCE.GENERAL;
  if (![ALCANCE.GENERAL, ALCANCE.DEPARTAMENTO, ALCANCE.SUCURSAL].includes(alcanceAProbar)) {
    throw new ErrorApp(
      400,
      `El alcance «${alcanceCodigo}» no es válido para comunicados institucionales. Valores permitidos: [${[ALCANCE.GENERAL, ALCANCE.DEPARTAMENTO, ALCANCE.SUCURSAL].join(", ")}].`,
      [{ campo: "alcance_codigo", mensaje: "Alcance inválido." }]
    );
  }

  // Si el alcance es departamento o sucursal, validar UUID del grupo
  if (alcanceAProbar === ALCANCE.DEPARTAMENTO) {
    if (!idDepartamentoDestino) {
      throw new ErrorApp(400, "Debe especificar el departamento de destino.", [
        { campo: "id_departamento_destino", mensaje: "Seleccione un departamento válido." },
      ]);
    }
    validarUuid(idDepartamentoDestino, "id_departamento_destino");
  }

  if (alcanceAProbar === ALCANCE.SUCURSAL) {
    if (!idSucursalDestino) {
      throw new ErrorApp(400, "Debe especificar la sucursal de destino.", [
        { campo: "id_sucursal_destino", mensaje: "Seleccione una sucursal válida." },
      ]);
    }
    validarUuid(idSucursalDestino, "id_sucursal_destino");
  }

  // Criterio de validación de campos obligatorios
  const { asunto: asuntoValido, contenido: contenidoValido } = validarCamposObligatorios(asunto, contenido);

  // Obtener empleados activos según el alcance seleccionado
  const empleadosActivos = await empleadosServicio.obtenerDestinatariosGrupo({
    alcanceCodigo: alcanceAProbar,
    idDepartamento: idDepartamentoDestino,
    idSucursal: idSucursalDestino,
  });

  // Criterio de aceptación 3 de RF-65:
  // "Dado que el grupo seleccionado no cuenta con empleados activos, al intentar enviar el comunicado,
  // el sistema informa que no hay destinatarios y no registra el intento."
  if (empleadosActivos.length === 0) {
    let motivoGrupo = "el grupo seleccionado";
    if (alcanceAProbar === ALCANCE.DEPARTAMENTO) motivoGrupo = "el departamento seleccionado";
    else if (alcanceAProbar === ALCANCE.SUCURSAL) motivoGrupo = "la sucursal seleccionada";
    else if (alcanceAProbar === ALCANCE.GENERAL) motivoGrupo = "la organización";

    throw new ErrorApp(
      422,
      `No se pudo enviar el comunicado: ${motivoGrupo} no cuenta con ningún empleado activo disponible. No se registró el envío.`,
      [{ campo: "alcance", mensaje: "No existen destinatarios activos en el grupo seleccionado." }]
    );
  }

  // Criterio 1: Entrega a todos los empleados activos del grupo
  const idsEmpleados = empleadosActivos.map((e) => e.id_empleado);

  let remitenteNombreFinal = remitenteNombre;
  if (!remitenteNombreFinal || remitenteNombreFinal === "Administración de RRHH") {
    const datosRem = await empleadosServicio.obtenerNombreEmpleado(idRemitenteLimpio);
    if (datosRem && datosRem.nombre_completo) {
      remitenteNombreFinal = `${datosRem.nombre_completo} (Administración de RRHH)`;
    } else {
      remitenteNombreFinal = "Administración de RRHH";
    }
  }

  const comunicacion = await modelo.crearComunicacion({
    idTipo: TIPO_ID[tipoAProbar],
    idAlcance: ALCANCE_ID[alcanceAProbar],
    idUsuarioRemitente: idRemitenteLimpio,
    remitenteNombre: remitenteNombreFinal,
    asunto: asuntoValido,
    contenido: contenidoValido,
    requiereConfirmacion: Boolean(requiereConfirmacion),
    idDepartamentoDestino: alcanceAProbar === ALCANCE.DEPARTAMENTO ? idDepartamentoDestino : null,
    idSucursalDestino: alcanceAProbar === ALCANCE.SUCURSAL ? idSucursalDestino : null,
    idsEmpleadosDestinatarios: idsEmpleados,
  });

  // Criterio 2: Visualiza la cantidad de destinatarios alcanzados
  return {
    ...comunicacion,
    cantidad_destinatarios: idsEmpleados.length,
    mensaje: `Comunicado institucional emitido y entregado a ${idsEmpleados.length} empleado(s) activo(s).`,
  };
}

// ==========================================
// RF-66: BANDEJA DE MENSAJES DEL EMPLEADO
// ==========================================
async function consultarBandeja(idEmpleado, filtros = {}) {
  if (!idEmpleado) {
    throw new ErrorApp(401, "Identifíquese como empleado para consultar su bandeja de mensajes.");
  }
  const idEmpleadoLimpio = validarUuid(idEmpleado, "id_empleado");

  const mensajes = await modelo.listarBandejaEmpleado(idEmpleadoLimpio, filtros);
  const totalNoLeidos = mensajes.filter((m) => m.estado_codigo === "NO_LEIDO").length;

  return {
    mensajes,
    total: mensajes.length,
    no_leidos: totalNoLeidos,
  };
}

// RF-66 AC 3 & RF-67 AC 1, 4: Abrir mensaje
async function abrirMensaje(idDestinatario, idEmpleado) {
  if (!idDestinatario) {
    throw new ErrorApp(400, "Identificador de mensaje no proporcionado.");
  }
  if (!idEmpleado) {
    throw new ErrorApp(401, "Identifíquese como empleado para acceder al mensaje.");
  }

  const idDestLimpio = validarUuid(idDestinatario, "id_destinatario");
  const idEmpLimpio = validarUuid(idEmpleado, "id_empleado");

  const mensaje = await modelo.abrirMensaje(idDestLimpio, idEmpLimpio);

  if (!mensaje) {
    throw new ErrorApp(404, "El mensaje solicitado no existe o no pertenece a su bandeja.");
  }

  // RF-67: Identificar si requiere confirmación pendiente
  const requiereConfirmacion = Boolean(mensaje.requiere_confirmacion);
  const estaConfirmado = mensaje.id_estado === 3;
  const solicitaConfirmacion = requiereConfirmacion && !estaConfirmado;

  return {
    ...mensaje,
    solicita_confirmacion: solicitaConfirmacion,
    mensaje_alerta: solicitaConfirmacion
      ? "Este comunicado es de lectura obligatoria y requiere que confirme su recepción."
      : null,
  };
}

// ==========================================
// RF-67: AUDITORÍA Y CONFIRMACIÓN DE RECEPCIÓN
// ==========================================
async function confirmarRecepcion(idDestinatario, idEmpleado) {
  if (!idDestinatario) {
    throw new ErrorApp(400, "Identificador de mensaje no proporcionado.");
  }
  if (!idEmpleado) {
    throw new ErrorApp(401, "Identifíquese como empleado para confirmar la recepción.");
  }

  const idDestLimpio = validarUuid(idDestinatario, "id_destinatario");
  const idEmpLimpio = validarUuid(idEmpleado, "id_empleado");

  const dest = await modelo.confirmarRecepcion(idDestLimpio, idEmpLimpio);

  if (!dest) {
    throw new ErrorApp(404, "No se encontró el registro para confirmar la recepción.");
  }

  return {
    exito: true,
    id_destinatario: dest.id_destinatario,
    fecha_confirmacion: dest.fecha_confirmacion,
    mensaje: "Recepción del comunicado confirmada exitosamente.",
  };
}

// RF-64 AC 3 & RF-65 AC 2: Listar enviados
async function consultarEnviados(idUsuarioRemitente, { rol } = {}) {
  const esAdminOGerente = rol === "admin" || rol === "gerente";
  if (!esAdminOGerente) {
    if (!idUsuarioRemitente) {
      throw new ErrorApp(401, "Identifíquese para consultar sus comunicaciones enviadas.");
    }
    validarUuid(idUsuarioRemitente, "id_usuario_remitente");
  } else if (idUsuarioRemitente) {
    validarUuid(idUsuarioRemitente, "id_usuario_remitente");
  }
  return await modelo.listarEnviados(idUsuarioRemitente, { esAdminOGerente });
}

// RF-67 AC 2 & 3: Auditoría de confirmación
async function consultarAuditoria(idComunicacion) {
  if (!idComunicacion) {
    throw new ErrorApp(400, "Identificador de comunicación requerido.");
  }
  const idComLimpio = validarUuid(idComunicacion, "id_comunicacion");

  const auditoria = await modelo.obtenerAuditoriaComunicacion(idComLimpio);

  if (!auditoria) {
    throw new ErrorApp(404, "La comunicación especificada no existe.");
  }

  return auditoria;
}

// Helper para catálogos y destinatarios
async function obtenerCatalogos() {
  return {
    alcances: Object.values(ALCANCE),
    tipos: Object.values(TIPO),
    estados: ["NO_LEIDO", "LEIDO", "CONFIRMADO"],
  };
}

async function obtenerDestinatariosDisponibles() {
  return await empleadosServicio.listarDestinatariosDisponibles();
}

module.exports = {
  enviarComunicacionDirecta,
  emitirComunicadoInstitucional,
  consultarBandeja,
  abrirMensaje,
  confirmarRecepcion,
  consultarEnviados,
  consultarAuditoria,
  obtenerCatalogos,
  obtenerDestinatariosDisponibles,
};

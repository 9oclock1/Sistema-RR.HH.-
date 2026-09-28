const modelo = require("../models/comunicaciones.model");
const empleadosServicio = require("./empleados.service");
const { ErrorApp } = require("../utils/errores");
const { validarCamposObligatorios } = require("../utils/validaciones");
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
  remitenteNombre = "Supervisor / RRHH",
}) {
  // Criterio 2: Validación de campos obligatorios
  const { asunto: asuntoValido, contenido: contenidoValido } = validarCamposObligatorios(asunto, contenido);

  if (!idEmpleadoDestinatario || typeof idEmpleadoDestinatario !== "string" || !idEmpleadoDestinatario.trim()) {
    throw new ErrorApp(400, "Debe seleccionar un empleado destinatario.", [
      { campo: "id_empleado_destinatario", mensaje: "El destinatario es requerido." },
    ]);
  }

  // Criterio 4: Verificar que el destinatario sea un empleado ACTIVO
  const empleadoDestino = await empleadosServicio.verificarEmpleadoActivo(idEmpleadoDestinatario.trim());

  // Criterio 1: Almacenar y entregar a la bandeja del destinatario
  const comunicacion = await modelo.crearComunicacion({
    idTipo: TIPO_ID[TIPO.DIRECTA],
    idAlcance: ALCANCE_ID[ALCANCE.INDIVIDUAL],
    idUsuarioRemitente: idUsuarioRemitente || empleadoDestino.id_empleado,
    remitenteNombre,
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
  tipoCodigo = TIPO.COMUNICADO,
  alcanceCodigo = ALCANCE.GENERAL,
  idDepartamentoDestino = null,
  idSucursalDestino = null,
  asunto,
  contenido,
  requiereConfirmacion = false,
  remitenteNombre = "Administración de RRHH",
}) {
  // Criterio de validación de campos obligatorios
  const { asunto: asuntoValido, contenido: contenidoValido } = validarCamposObligatorios(asunto, contenido);

  const tipoNormalizado = Object.values(TIPO).includes(tipoCodigo) ? tipoCodigo : TIPO.COMUNICADO;
  const alcanceNormalizado = Object.values(ALCANCE).includes(alcanceCodigo) ? alcanceCodigo : ALCANCE.GENERAL;

  // Obtener empleados activos según el alcance seleccionado
  const empleadosActivos = await empleadosServicio.obtenerDestinatariosGrupo({
    alcanceCodigo: alcanceNormalizado,
    idDepartamento: idDepartamentoDestino,
    idSucursal: idSucursalDestino,
  });

  // Criterio de aceptación 3 de RF-65:
  // "Dado que el grupo seleccionado no cuenta con empleados activos, al intentar enviar el comunicado,
  // el sistema informa que no hay destinatarios y no registra el intento."
  if (empleadosActivos.length === 0) {
    let motivoGrupo = "el grupo seleccionado";
    if (alcanceNormalizado === ALCANCE.DEPARTAMENTO) motivoGrupo = "el departamento seleccionado";
    else if (alcanceNormalizado === ALCANCE.SUCURSAL) motivoGrupo = "la sucursal seleccionada";
    else if (alcanceNormalizado === ALCANCE.GENERAL) motivoGrupo = "la organización";

    throw new ErrorApp(
      422,
      `No se pudo enviar el comunicado: ${motivoGrupo} no cuenta con ningún empleado activo disponible. No se registró el envío.`,
      [{ campo: "alcance", mensaje: "No existen destinatarios activos en el grupo seleccionado." }]
    );
  }

  // Criterio 1: Entrega a todos los empleados activos del grupo
  const idsEmpleados = empleadosActivos.map((e) => e.id_empleado);

  const comunicacion = await modelo.crearComunicacion({
    idTipo: TIPO_ID[tipoNormalizado] || TIPO_ID[TIPO.COMUNICADO],
    idAlcance: ALCANCE_ID[alcanceNormalizado] || ALCANCE_ID[ALCANCE.GENERAL],
    idUsuarioRemitente: idUsuarioRemitente || idsEmpleados[0],
    remitenteNombre,
    asunto: asuntoValido,
    contenido: contenidoValido,
    requiereConfirmacion: Boolean(requiereConfirmacion),
    idDepartamentoDestino: alcanceNormalizado === ALCANCE.DEPARTAMENTO ? idDepartamentoDestino : null,
    idSucursalDestino: alcanceNormalizado === ALCANCE.SUCURSAL ? idSucursalDestino : null,
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

  const mensajes = await modelo.listarBandejaEmpleado(idEmpleado, filtros);
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

  const mensaje = await modelo.abrirMensaje(idDestinatario, idEmpleado);

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

  const dest = await modelo.confirmarRecepcion(idDestinatario, idEmpleado);

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
  return await modelo.listarEnviados(idUsuarioRemitente, { esAdminOGerente });
}

// RF-67 AC 2 & 3: Auditoría de confirmación
async function consultarAuditoria(idComunicacion) {
  if (!idComunicacion) {
    throw new ErrorApp(400, "Identificador de comunicación requerido.");
  }

  const auditoria = await modelo.obtenerAuditoriaComunicacion(idComunicacion);

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

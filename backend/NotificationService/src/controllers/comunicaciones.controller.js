const servicio = require("../services/comunicaciones.service");

async function enviarDirecta(req, res, next) {
  try {
    const { id_empleado_destinatario, asunto, contenido, requiere_confirmacion, remitente_nombre } = req.body;
    const resultado = await servicio.enviarComunicacionDirecta({
      idUsuarioRemitente: req.idUsuario,
      idEmpleadoDestinatario: id_empleado_destinatario,
      asunto,
      contenido,
      requiereConfirmacion: requiere_confirmacion,
      remitenteNombre: remitente_nombre || "Supervisor",
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
}

async function emitirInstitucional(req, res, next) {
  try {
    const {
      tipo_codigo,
      alcance_codigo,
      id_departamento_destino,
      id_sucursal_destino,
      asunto,
      contenido,
      requiere_confirmacion,
      remitente_nombre,
    } = req.body;

    const resultado = await servicio.emitirComunicadoInstitucional({
      idUsuarioRemitente: req.idUsuario,
      tipoCodigo: tipo_codigo,
      alcanceCodigo: alcance_codigo,
      idDepartamentoDestino: id_departamento_destino,
      idSucursalDestino: id_sucursal_destino,
      asunto,
      contenido,
      requiereConfirmacion: requiere_confirmacion,
      remitenteNombre: remitente_nombre || "Administración de RRHH",
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
}

async function consultarBandeja(req, res, next) {
  try {
    const { estado, busqueda } = req.query;
    const bandeja = await servicio.consultarBandeja(req.idEmpleado, { estado, busqueda });
    res.json(bandeja);
  } catch (error) {
    next(error);
  }
}

async function abrirMensaje(req, res, next) {
  try {
    const { idDestinatario } = req.params;
    const mensaje = await servicio.abrirMensaje(idDestinatario, req.idEmpleado);
    res.json(mensaje);
  } catch (error) {
    next(error);
  }
}

async function confirmarRecepcion(req, res, next) {
  try {
    const { idDestinatario } = req.params;
    const resultado = await servicio.confirmarRecepcion(idDestinatario, req.idEmpleado);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
}

async function consultarEnviados(req, res, next) {
  try {
    const enviados = await servicio.consultarEnviados(req.idUsuario, { rol: req.rol });
    res.json(enviados);
  } catch (error) {
    next(error);
  }
}

async function consultarAuditoria(req, res, next) {
  try {
    const { idComunicacion } = req.params;
    const auditoria = await servicio.consultarAuditoria(idComunicacion);
    res.json(auditoria);
  } catch (error) {
    next(error);
  }
}

async function obtenerDestinatariosDisponibles(req, res, next) {
  try {
    const datos = await servicio.obtenerDestinatariosDisponibles();
    res.json(datos);
  } catch (error) {
    next(error);
  }
}

async function obtenerCatalogos(req, res, next) {
  try {
    const catalogos = await servicio.obtenerCatalogos();
    res.json(catalogos);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  enviarDirecta,
  emitirInstitucional,
  consultarBandeja,
  abrirMensaje,
  confirmarRecepcion,
  consultarEnviados,
  consultarAuditoria,
  obtenerDestinatariosDisponibles,
  obtenerCatalogos,
};

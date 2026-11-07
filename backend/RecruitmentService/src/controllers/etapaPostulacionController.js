const servicio = require("../services/etapaPostulacionService");
const integracionService = require("../services/integracionService");
const { validarIdRuta } = require("../validators/comunes");
const { validarCambioEtapa } = require("../validators/etapaValidator");

const MENSAJES_CAMBIO = {
  CONTRATADO: "El postulante fue contratado; su alta se enviará a Contabilidad y al módulo operativo de su cargo.",
  RECHAZADO: "El postulante fue rechazado y la postulación quedó archivada.",
};

async function cambiarEtapa(req, res) {
  const idPostulacion = validarIdRuta(req.params.id, "id_postulacion");
  const datos = validarCambioEtapa(req.body);
  const resultado = await servicio.cambiarEtapa(idPostulacion, datos, req.usuario);
  const { codigo, nombre } = resultado.postulacion.etapa_actual;

  res.status(200).json({
    success: true,
    statusCode: 200,
    message: MENSAJES_CAMBIO[codigo] || `El postulante pasó a la etapa «${nombre}».`,
    data: resultado,
  });
}

async function obtenerHistorial(req, res) {
  const idPostulacion = validarIdRuta(req.params.id, "id_postulacion");
  const historial = await servicio.obtenerHistorial(idPostulacion);
  res.status(200).json({ success: true, statusCode: 200, data: historial });
}

async function obtenerCatalogo(req, res) {
  const catalogo = await servicio.obtenerCatalogo();
  res.status(200).json({ success: true, statusCode: 200, data: catalogo });
}

async function obtenerIntegraciones(req, res) {
  const idPostulacion = validarIdRuta(req.params.id, "id_postulacion");
  const integraciones = await integracionService.listarDePostulacion(idPostulacion);
  res.status(200).json({ success: true, statusCode: 200, data: integraciones });
}

async function obtenerPipeline(req, res) {
  const idConvocatoria = validarIdRuta(req.params.id, "id_convocatoria");
  const pipeline = await servicio.obtenerPipeline(idConvocatoria);
  res.status(200).json({ success: true, statusCode: 200, data: pipeline });
}

async function reintentarIntegracion(req, res) {
  const idEvento = validarIdRuta(req.params.id, "id_evento");
  const evento = await integracionService.reintentar(idEvento);
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: `El alta para ${evento.nombre_modulo} se volverá a enviar en unos segundos.`,
    data: evento,
  });
}

module.exports = {
  cambiarEtapa,
  obtenerHistorial,
  obtenerCatalogo,
  obtenerIntegraciones,
  obtenerPipeline,
  reintentarIntegracion,
};

const servicio = require("../services/etapaPostulacionService");
const { validarIdRuta } = require("../validators/comunes");
const { validarCambioEtapa } = require("../validators/etapaValidator");

const MENSAJES_CAMBIO = {
  CONTRATADO: "El postulante fue contratado.",
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

module.exports = { cambiarEtapa, obtenerHistorial, obtenerCatalogo };

const servicio = require("../services/entrevistaService");
const { validarIdRuta } = require("../validators/comunes");
const {
  validarProgramacion,
  validarReprogramacion,
  validarCancelacion,
  validarFiltroAgenda,
} = require("../validators/entrevistaValidator");

const AVISO_SOLAPAMIENTO = " Quedó guardada aunque el evaluador tiene otra entrevista en ese horario.";

async function agendar(req, res) {
  const idPostulacion = validarIdRuta(req.params.id, "id_postulacion");
  const datos = validarProgramacion(req.body);
  const resultado = await servicio.agendar(idPostulacion, datos, req.usuario);

  res.status(201).json({
    success: true,
    statusCode: 201,
    message:
      `La entrevista quedó agendada y se notificará al candidato en ${resultado.notificacion.correo_destino}.` +
      (resultado.entrevistas_solapadas.length > 0 ? AVISO_SOLAPAMIENTO : ""),
    data: resultado,
  });
}

async function reprogramar(req, res) {
  const idEntrevista = validarIdRuta(req.params.id, "id_entrevista");
  const datos = validarReprogramacion(req.body);
  const resultado = await servicio.reprogramar(idEntrevista, datos, req.usuario);

  res.status(200).json({
    success: true,
    statusCode: 200,
    message:
      "La entrevista fue reprogramada y se enviará la notificación actualizada al candidato." +
      (resultado.entrevistas_solapadas.length > 0 ? AVISO_SOLAPAMIENTO : ""),
    data: resultado,
  });
}

async function cancelar(req, res) {
  const idEntrevista = validarIdRuta(req.params.id, "id_entrevista");
  const datos = validarCancelacion(req.body);
  const resultado = await servicio.cancelar(idEntrevista, datos, req.usuario);

  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "La entrevista fue cancelada y se avisará al candidato.",
    data: resultado,
  });
}

async function obtenerDetalle(req, res) {
  const idEntrevista = validarIdRuta(req.params.id, "id_entrevista");
  const entrevista = await servicio.obtenerDetalle(idEntrevista);
  res.status(200).json({ success: true, statusCode: 200, data: entrevista });
}

async function listarDePostulacion(req, res) {
  const idPostulacion = validarIdRuta(req.params.id, "id_postulacion");
  const entrevistas = await servicio.listarDePostulacion(idPostulacion);
  res.status(200).json({ success: true, statusCode: 200, data: entrevistas });
}

async function listarAgenda(req, res) {
  const filtros = validarFiltroAgenda(req.query);
  const entrevistas = await servicio.listarAgenda(filtros);
  res.status(200).json({
    success: true,
    statusCode: 200,
    data: { desde: filtros.desde, hasta: filtros.hasta, entrevistas },
  });
}

module.exports = { agendar, reprogramar, cancelar, obtenerDetalle, listarDePostulacion, listarAgenda };

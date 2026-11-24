const ascensosService = require('../services/ascensosService');
const { validarIdRuta } = require('../validators/comunes');
const { validarFormalizacionAscenso } = require('../validators/ascensosValidator');

const ids = (req) => [validarIdRuta(req.params.id, 'id'), validarIdRuta(req.params.idPostulacion, 'idPostulacion')];

// KAN-84: el Administrador formaliza el ascenso del postulante apto seleccionado.
const formalizar = async (req, res) => {
  const [idConvocatoria, idPostulacion] = ids(req);
  const datos = validarFormalizacionAscenso(req.body);
  res.status(201).json(await ascensosService.formalizar(idConvocatoria, idPostulacion, datos, req.identidad));
};

const reintentarNotificacion = async (req, res) => {
  const [idConvocatoria, idPostulacion] = ids(req);
  res.status(200).json(await ascensosService.reintentarNotificacion(idConvocatoria, idPostulacion, req.identidad));
};

module.exports = { formalizar, reintentarNotificacion };

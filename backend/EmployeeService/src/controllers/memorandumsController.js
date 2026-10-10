const memorandumsService = require('../services/memorandumsService');
const { validarMemorandum } = require('../validators/memorandumsValidator');
const { rutaEvidencia, descartarEvidencia } = require('../middlewares/evidenciaUpload');

const crearMemorandum = async (req, res) => {
  try {
    const memorandum = validarMemorandum(req.body);
    const evidencia_adjunto_url = req.file ? rutaEvidencia(req.file) : null;

    res.status(201).json(await memorandumsService.crearMemorandum({ ...memorandum, evidencia_adjunto_url }));
  } catch (error) {
    if (req.file) await descartarEvidencia(req.file);
    throw error;
  }
};

module.exports = { crearMemorandum };

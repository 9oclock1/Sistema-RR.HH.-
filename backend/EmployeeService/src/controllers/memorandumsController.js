const memorandumsService = require('../services/memorandumsService');
const { validarMemorandum, validarClasificacion } = require('../validators/memorandumsValidator');
const { validarIdRuta } = require('../validators/comunes');
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

const listarTipos = async (req, res) => {
  const clasificacion = validarClasificacion(req.query.clasificacion);
  res.status(200).json(await memorandumsService.listarTipos(clasificacion));
};

const descargarPdf = async (req, res, next) => {
  const idMemorandum = validarIdRuta(req.params.id, 'id');
  const { ruta, nombre } = await memorandumsService.obtenerDocumentoPdf(idMemorandum);
  // La ruta ya se validó contra la carpeta de la aplicación, así que se permiten carpetas con punto (p. ej. .tmp).
  res.download(ruta, nombre, { dotfiles: 'allow' }, (error) => {
    if (error && !res.headersSent) next(error);
  });
};

module.exports = { crearMemorandum, listarTipos, descargarPdf };

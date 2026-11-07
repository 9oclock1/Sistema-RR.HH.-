const contratosService = require('../services/contratosService');
const { validarModificacion, validarFiltrosContratos, validarRegistrador, validarId } = require('../validators/contratosValidator');
const { datosDocumento, descartarDocumento } = require('../middlewares/documentoContratoUpload');
const HttpError = require('../utils/HttpError');

const registrarModificacion = async (req, res) => {
  try {
    const modificacion = validarModificacion(req.body);
    const registrador = { id: validarRegistrador(req.get('X-Usuario-Id')), rol: req.rol };
    if (!req.file) {
      const mensaje = 'Adjunte el documento de respaldo firmado en el campo «documento».';
      throw new HttpError(400, mensaje, { campos_faltantes: ['documento'], errores: [{ campo: 'documento', mensaje }] });
    }
    res.status(201).json(await contratosService.registrarModificacion(modificacion, datosDocumento(req.file), registrador));
  } catch (error) {
    if (req.file) await descartarDocumento(req.file.path);
    throw error;
  }
};

const listarHistorial = async (req, res) => {
  const filtros = validarFiltrosContratos(req.query);
  res.status(200).json(await contratosService.listarHistorial(filtros));
};

const obtenerCatalogos = async (req, res) => {
  res.status(200).json(await contratosService.obtenerCatalogos());
};

const descargarDocumento = async (req, res) => {
  const idContrato = validarId(req.params.id);
  const { ruta, nombre, tipoMime } = await contratosService.obtenerDocumento(idContrato);
  await new Promise((resolver, rechazar) => {
    res.download(ruta, nombre, { dotfiles: 'allow', headers: { 'Content-Type': tipoMime } }, (error) => (error ? rechazar(error) : resolver()));
  });
};

module.exports = { registrarModificacion, listarHistorial, obtenerCatalogos, descargarDocumento };

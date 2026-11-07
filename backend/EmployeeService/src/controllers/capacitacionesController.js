const capacitacionesService = require('../services/capacitacionesService');
const { validarCapacitacion, validarFiltrosCapacitaciones, validarId } = require('../validators/capacitacionesValidator');
const { datosCertificado, descartarCertificado } = require('../middlewares/certificadoUpload');
const HttpError = require('../utils/HttpError');

const conDescarteDeArchivo = (accion) => async (req, res) => {
  try {
    await accion(req, res);
  } catch (error) {
    if (req.file) await descartarCertificado(req.file.path);
    throw error;
  }
};

const listarCapacitaciones = async (req, res) => {
  const filtros = validarFiltrosCapacitaciones(req.query);
  res.status(200).json(await capacitacionesService.listarCapacitaciones(filtros));
};

const obtenerCapacitacion = async (req, res) => {
  const idCapacitacion = validarId(req.params.id);
  res.status(200).json(await capacitacionesService.obtenerCapacitacion(idCapacitacion));
};

const registrarCapacitacion = conDescarteDeArchivo(async (req, res) => {
  const capacitacion = validarCapacitacion(req.body);
  const certificado = req.file ? datosCertificado(req.file) : null;
  res.status(201).json(await capacitacionesService.registrarCapacitacion(capacitacion, certificado));
});

const reemplazarCapacitacion = async (req, res) => {
  const idCapacitacion = validarId(req.params.id);
  const capacitacion = validarCapacitacion(req.body, { conEmpleado: false });
  res.status(200).json(await capacitacionesService.reemplazarCapacitacion(idCapacitacion, capacitacion));
};

const eliminarCapacitacion = async (req, res) => {
  const idCapacitacion = validarId(req.params.id);
  const capacitacion = await capacitacionesService.eliminarCapacitacion(idCapacitacion);
  res.status(200).json({ mensaje: 'Capacitación eliminada correctamente.', capacitacion });
};

const reemplazarCertificado = conDescarteDeArchivo(async (req, res) => {
  const idCapacitacion = validarId(req.params.id);
  if (!req.file) {
    const mensaje = 'Adjunte el certificado en el campo «certificado».';
    throw new HttpError(400, mensaje, { campos_faltantes: ['certificado'], errores: [{ campo: 'certificado', mensaje }] });
  }
  res.status(200).json(await capacitacionesService.reemplazarCertificado(idCapacitacion, datosCertificado(req.file)));
});

const quitarCertificado = async (req, res) => {
  const idCapacitacion = validarId(req.params.id);
  const capacitacion = await capacitacionesService.quitarCertificado(idCapacitacion);
  res.status(200).json({ mensaje: 'Certificado eliminado correctamente.', capacitacion });
};

const descargarCertificado = async (req, res) => {
  const idCapacitacion = validarId(req.params.id);
  const { ruta, nombre, tipoMime } = await capacitacionesService.obtenerCertificado(idCapacitacion);
  await new Promise((resolver, rechazar) => {
    res.download(ruta, nombre, { dotfiles: 'allow', headers: { 'Content-Type': tipoMime } }, (error) => (error ? rechazar(error) : resolver()));
  });
};

module.exports = {
  listarCapacitaciones,
  obtenerCapacitacion,
  registrarCapacitacion,
  reemplazarCapacitacion,
  eliminarCapacitacion,
  reemplazarCertificado,
  quitarCertificado,
  descargarCertificado,
};

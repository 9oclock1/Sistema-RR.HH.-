const { esVacio, invalido, cuerpoComoObjeto, normalizarTexto, lanzarSiHayErrores } = require('./comunes');
const { esFechaIso } = require('../utils/fechas');

const MONTO_REGEX = /^\d{1,10}(\.\d{1,2})?$/;

const normalizarMonto = (valor, campo, errores) => {
  if (esVacio(valor)) return null;
  const texto = String(valor).trim();
  if ((typeof valor !== 'number' && typeof valor !== 'string') || !MONTO_REGEX.test(texto) || Number(texto) <= 0) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser un monto mayor a cero con hasta 2 decimales.`));
    return null;
  }
  return Number(texto);
};

// POST /convocatorias/:id/postulaciones/:idPostulacion/formalizacion (KAN-84). Todo es opcional:
// - fecha_vigencia: hoy si no se indica; si es futura, el cambio de cargo se aplica al llegar esa fecha.
// - haber_mensual_pactado: por defecto, el salario referencial del cargo (o el haber actual, si es mayor).
// - numero_contrato: número de la adenda; si no se indica se genera uno.
const validarFormalizacionAscenso = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  let fechaVigencia = null;
  if (!esVacio(datos.fecha_vigencia)) {
    if (esFechaIso(datos.fecha_vigencia)) fechaVigencia = datos.fecha_vigencia;
    else errores.push(invalido('fecha_vigencia', "El campo 'fecha_vigencia' debe ser una fecha válida con formato AAAA-MM-DD."));
  }

  const formalizacion = {
    fecha_vigencia: fechaVigencia,
    haber_mensual_pactado: normalizarMonto(datos.haber_mensual_pactado, 'haber_mensual_pactado', errores),
    numero_contrato: normalizarTexto(datos.numero_contrato, 'numero_contrato', { maxLength: 40 }, errores),
    observaciones: normalizarTexto(datos.observaciones, 'observaciones', { maxLength: 1000 }, errores),
  };
  lanzarSiHayErrores(errores);
  return formalizacion;
};

module.exports = { validarFormalizacionAscenso };

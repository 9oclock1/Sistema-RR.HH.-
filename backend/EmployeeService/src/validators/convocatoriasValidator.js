const HttpError = require('../utils/HttpError');
const {
  esVacio,
  faltante,
  invalido,
  cuerpoComoObjeto,
  normalizarTexto,
  normalizarUuid,
  lanzarSiHayErrores,
} = require('./comunes');
const { hoyEnZona, esFechaIso } = require('../utils/fechas');

const MAX_TITULO = 120;
const MAX_REQUISITOS = 2000;
const MESES_ANTIGUEDAD_POR_DEFECTO = 6;
const MAX_MESES_ANTIGUEDAD = 600;
const NOTA_REGEX = /^\d{1,3}(\.\d{1,2})?$/;

const ESTADOS = ['ABIERTA', 'PROGRAMADA', 'CERRADA'];
const FILTROS_ESTADO = {
  ABIERTA: ['ABIERTA'],
  PROGRAMADA: ['PROGRAMADA'],
  CERRADA: ['CERRADA'],
  VIGENTES: ['ABIERTA', 'PROGRAMADA'],
  TODAS: ESTADOS,
};

const normalizarMeses = (valor, errores) => {
  const campo = 'meses_antiguedad_minima';
  if (esVacio(valor)) return MESES_ANTIGUEDAD_POR_DEFECTO;
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (!Number.isInteger(numero) || numero < 0 || numero > MAX_MESES_ANTIGUEDAD) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser un número entero de meses entre 0 y ${MAX_MESES_ANTIGUEDAD}.`));
    return null;
  }
  return numero;
};

const normalizarNota = (valor, errores) => {
  const campo = 'nota_minima_desempeno';
  if (esVacio(valor)) {
    errores.push(faltante(campo));
    return null;
  }
  const texto = typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : valor;
  if (typeof texto !== 'string' || !NOTA_REGEX.test(texto.trim()) || Number(texto) > 100) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser una nota de 0 a 100 con hasta 2 decimales.`));
    return null;
  }
  return Number(texto);
};

const normalizarFecha = (valor, campo, { requerido, porDefecto = null }, errores) => {
  if (esVacio(valor)) {
    if (requerido) errores.push(faltante(campo));
    return porDefecto;
  }
  if (!esFechaIso(typeof valor === 'string' ? valor.trim() : valor)) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser una fecha válida con el formato AAAA-MM-DD.`));
    return null;
  }
  return valor.trim();
};

const validarConvocatoria = (body, ahora = new Date()) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];
  const hoy = hoyEnZona(ahora);

  const convocatoria = {
    id_cargo: normalizarUuid(datos.id_cargo, 'id_cargo', { requerido: true }, errores),
    id_sucursal: normalizarUuid(datos.id_sucursal, 'id_sucursal', { requerido: true }, errores),
    titulo: normalizarTexto(datos.titulo, 'titulo', { requerido: true, maxLength: MAX_TITULO }, errores),
    descripcion_requisitos: normalizarTexto(
      datos.descripcion_requisitos,
      'descripcion_requisitos',
      { requerido: true, maxLength: MAX_REQUISITOS },
      errores
    ),
    meses_antiguedad_minima: normalizarMeses(datos.meses_antiguedad_minima, errores),
    nota_minima_desempeno: normalizarNota(datos.nota_minima_desempeno, errores),
    fecha_inicio_postulacion: normalizarFecha(
      datos.fecha_inicio_postulacion,
      'fecha_inicio_postulacion',
      { requerido: false, porDefecto: hoy },
      errores
    ),
    fecha_cierre_postulacion: normalizarFecha(
      datos.fecha_cierre_postulacion,
      'fecha_cierre_postulacion',
      { requerido: true },
      errores
    ),
  };

  const { fecha_inicio_postulacion: inicio, fecha_cierre_postulacion: cierre } = convocatoria;
  if (inicio && inicio < hoy) {
    errores.push(invalido('fecha_inicio_postulacion', 'La fecha de inicio no puede ser anterior a hoy.'));
  } else if (inicio && cierre && cierre < inicio) {
    errores.push(invalido('fecha_cierre_postulacion', 'La fecha de cierre no puede ser anterior a la fecha de inicio.'));
  }

  lanzarSiHayErrores(errores);
  return convocatoria;
};

const validarFiltroEstado = (valor, porDefecto) => {
  if (esVacio(valor)) return FILTROS_ESTADO[porDefecto];
  const clave = typeof valor === 'string' ? valor.trim().toUpperCase() : null;
  if (!clave || !Object.hasOwn(FILTROS_ESTADO, clave)) {
    throw new HttpError(400, `El filtro 'estado' debe ser uno de: ${Object.keys(FILTROS_ESTADO).join(', ')}.`, {
      campos_faltantes: [],
      errores: [{ campo: 'estado', mensaje: 'Estado inválido.' }],
    });
  }
  return FILTROS_ESTADO[clave];
};

module.exports = { validarConvocatoria, validarFiltroEstado, ESTADOS, FILTROS_ESTADO };

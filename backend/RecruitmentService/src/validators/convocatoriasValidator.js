const HttpError = require('../utils/HttpError');
const { CODIGOS_NIVEL_EDUCACION } = require('../utils/nivelesEducacion');
const {
  esVacio,
  faltante,
  invalido,
  cuerpoComoObjeto,
  normalizarTexto,
  normalizarUuid,
  lanzarSiHayErrores,
  validarIdRuta,
} = require('./comunes');

const MAX_TITULO = 120;
const MAX_HABILIDAD = 100;
const MAX_INT = 2147483647;
const EXPERIENCIA_REGEX = /^\d{1,3}(\.\d)?$/; // numeric(4, 1)
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS = ['borrador', 'publicada', 'cerrada'];

const presente = (datos, campo) => Object.hasOwn(datos, campo);

// Un borrador puede guardarse incompleto: texto vacío se guarda como '' (las columnas son NOT NULL).
const normalizarTextoBorrador = (valor, campo, errores) => normalizarTexto(valor, campo, {}, errores) ?? '';

const normalizarCantidadVacantes = (valor, errores) => {
  const campo = 'cantidad_vacantes';
  const numero = typeof valor === 'string' && /^\d+$/.test(valor.trim()) ? Number(valor.trim()) : valor;

  if (!Number.isInteger(numero) || numero < 1 || numero > MAX_INT) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser un entero mayor o igual a 1.`));
    return null;
  }
  return numero;
};

const normalizarExperiencia = (valor, errores) => {
  const campo = 'year_experiencia_min';
  if (esVacio(valor)) {
    errores.push(faltante(campo));
    return null;
  }
  const texto = typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : valor;
  if (typeof texto !== 'string' || !EXPERIENCIA_REGEX.test(texto.trim())) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser un número entre 0 y 999.9 con hasta 1 decimal.`));
    return null;
  }
  return Number(texto.trim());
};

const normalizarNivelEducacion = (valor, errores) => {
  const campo = 'nivel_educacion_min';
  if (esVacio(valor)) return '';
  const codigo = typeof valor === 'string' ? valor.trim().toUpperCase() : null;

  if (!CODIGOS_NIVEL_EDUCACION.includes(codigo)) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser uno de: ${CODIGOS_NIVEL_EDUCACION.join(', ')}.`));
    return null;
  }
  return codigo;
};

// Lista limpia y sin duplicados (sin distinguir mayúsculas) para la comparación automática con los CV.
const normalizarHabilidades = (valor, errores) => {
  const campo = 'habilidades_clave_requeridas';
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser un arreglo de textos.`));
    return [];
  }

  const habilidades = [];
  const vistas = new Set();
  valor.forEach((item, indice) => {
    const campoItem = `${campo}[${indice}]`;
    if (typeof item !== 'string' || item.trim() === '') {
      errores.push(invalido(campoItem, `La habilidad en la posición ${indice} debe ser un texto no vacío.`));
      return;
    }
    const limpia = item.trim().replace(/\s+/g, ' ');
    if (limpia.length > MAX_HABILIDAD) {
      errores.push(invalido(campoItem, `La habilidad en la posición ${indice} supera los ${MAX_HABILIDAD} caracteres.`));
      return;
    }
    if (!vistas.has(limpia.toLowerCase())) {
      vistas.add(limpia.toLowerCase());
      habilidades.push(limpia);
    }
  });
  return habilidades;
};

// null = sin fecha límite todavía (se guarda como 'infinity' mientras sea borrador).
const normalizarFecha = (valor, campo, errores) => {
  if (esVacio(valor)) return null;
  const texto = typeof valor === 'string' ? valor.trim() : '';
  const fecha = new Date(`${texto}T00:00:00Z`);

  if (!FECHA_REGEX.test(texto) || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser una fecha válida con formato AAAA-MM-DD.`));
    return null;
  }
  return texto;
};

// Solo devuelve los campos que vienen en el cuerpo, para que la creación combine con el perfil del cargo
// y la edición sea parcial. Estado, fechas de publicación y código los maneja el sistema, no el cliente.
const validarCamposDeContenido = (datos, errores) => {
  const campos = {};

  if (presente(datos, 'titulo_puesto')) {
    campos.titulo_puesto = normalizarTexto(
      datos.titulo_puesto,
      'titulo_puesto',
      { requerido: true, maxLength: MAX_TITULO },
      errores
    );
  }
  if (presente(datos, 'descripcion_puesto')) {
    campos.descripcion_puesto = normalizarTextoBorrador(datos.descripcion_puesto, 'descripcion_puesto', errores);
  }
  if (presente(datos, 'cantidad_vacantes')) {
    campos.cantidad_vacantes = normalizarCantidadVacantes(datos.cantidad_vacantes, errores);
  }
  if (presente(datos, 'year_experiencia_min')) {
    campos.year_experiencia_min = normalizarExperiencia(datos.year_experiencia_min, errores);
  }
  if (presente(datos, 'nivel_educacion_min')) {
    campos.nivel_educacion_min = normalizarNivelEducacion(datos.nivel_educacion_min, errores);
  }
  if (presente(datos, 'habilidades_clave_requeridas')) {
    campos.habilidades_clave_requeridas = normalizarHabilidades(datos.habilidades_clave_requeridas, errores);
  }
  if (presente(datos, 'fecha_limite_postulacion')) {
    campos.fecha_limite_postulacion = normalizarFecha(datos.fecha_limite_postulacion, 'fecha_limite_postulacion', errores);
  }
  return campos;
};

const validarCreacion = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const convocatoria = {
    id_cargo_referencial: normalizarUuid(datos.id_cargo_referencial, 'id_cargo_referencial', { requerido: true }, errores),
    id_sucursal_destino: normalizarUuid(datos.id_sucursal_destino, 'id_sucursal_destino', { requerido: true }, errores),
    ...validarCamposDeContenido(datos, errores),
  };

  lanzarSiHayErrores(errores);
  return convocatoria;
};

const validarEdicion = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];
  const cambios = validarCamposDeContenido(datos, errores);

  ['id_cargo_referencial', 'id_sucursal_destino'].forEach((campo) => {
    if (presente(datos, campo)) cambios[campo] = normalizarUuid(datos[campo], campo, { requerido: true }, errores);
  });

  lanzarSiHayErrores(errores);
  if (Object.keys(cambios).length === 0) {
    throw new HttpError(400, 'No se envió ningún campo editable.', { campos_faltantes: [], errores: [] });
  }
  return cambios;
};

// Requisitos para pasar de borrador a publicada (RF-08.3). Devuelve la lista de errores (vacía = publicable).
const erroresParaPublicar = (convocatoria, fechaHoy) => {
  const errores = [];

  if (esVacio(convocatoria.titulo_puesto)) errores.push(faltante('titulo_puesto'));
  if (esVacio(convocatoria.descripcion_puesto)) errores.push(faltante('descripcion_puesto'));
  if (!CODIGOS_NIVEL_EDUCACION.includes(convocatoria.nivel_educacion_min)) errores.push(faltante('nivel_educacion_min'));
  if (convocatoria.habilidades_clave_requeridas.length === 0) errores.push(faltante('habilidades_clave_requeridas'));
  if (!(convocatoria.cantidad_vacantes >= 1)) errores.push(faltante('cantidad_vacantes'));

  if (!convocatoria.fecha_limite_postulacion) {
    errores.push(faltante('fecha_limite_postulacion'));
  } else if (convocatoria.fecha_limite_postulacion < fechaHoy) {
    errores.push(
      invalido('fecha_limite_postulacion', `La fecha límite de postulación (${convocatoria.fecha_limite_postulacion}) ya pasó.`)
    );
  }
  return errores;
};

const validarIdConvocatoria = (valor) => validarIdRuta(valor, 'id');

const validarIdCargo = (valor) => validarIdRuta(valor, 'id_cargo');

const validarFiltroEstado = (valor) => {
  if (esVacio(valor)) return null;
  const estado = typeof valor === 'string' ? valor.trim().toLowerCase() : null;
  if (!ESTADOS.includes(estado)) {
    lanzarSiHayErrores([invalido('estado', `El filtro 'estado' debe ser uno de: ${ESTADOS.join(', ')}.`)]);
  }
  return estado;
};

module.exports = {
  validarCreacion,
  validarEdicion,
  erroresParaPublicar,
  validarIdConvocatoria,
  validarIdCargo,
  validarFiltroEstado,
};

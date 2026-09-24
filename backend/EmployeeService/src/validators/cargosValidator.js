const HttpError = require('../utils/HttpError');

const MAX_INT = 2147483647; 
const MAX_NOMBRE = 100; 

const esVacio = (valor) =>
  valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

const faltante = (campo) => ({ campo, tipo: 'faltante', mensaje: `El campo '${campo}' es obligatorio.` });
const invalido = (campo, mensaje) => ({ campo, tipo: 'invalido', mensaje });

const normalizarTexto = (valor, campo, { requerido = false, maxLength } = {}, errores) => {
  if (esVacio(valor)) {
    if (requerido) errores.push(faltante(campo));
    return null;
  }
  if (typeof valor !== 'string') {
    errores.push(invalido(campo, `El campo '${campo}' debe ser texto.`));
    return null;
  }
  const limpio = valor.trim();
  if (maxLength && limpio.length > maxLength) {
    errores.push(invalido(campo, `El campo '${campo}' no puede superar los ${maxLength} caracteres.`));
    return null;
  }
  return limpio;
};

const normalizarEntero = (valor, campo, { requerido = false } = {}, errores) => {
  if (esVacio(valor)) {
    if (requerido) errores.push(faltante(campo));
    return null;
  }
  const texto = typeof valor === 'string' ? valor.trim() : valor;
  const numero = typeof texto === 'string' && /^\d+$/.test(texto) ? Number(texto) : texto;

  if (!Number.isInteger(numero) || numero < 1 || numero > MAX_INT) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser un número entero positivo.`));
    return null;
  }
  return numero;
};

const normalizarFunciones = (valor, errores) => {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) {
    errores.push(invalido('funciones', "El campo 'funciones' debe ser un arreglo de textos."));
    return [];
  }

  const funciones = [];
  valor.forEach((item, indice) => {
    const campo = `funciones[${indice}]`;
    if (typeof item !== 'string') {
      errores.push(invalido(campo, `La función en la posición ${indice} debe ser texto.`));
    } else if (item.trim() === '') {
      errores.push(invalido(campo, `La función en la posición ${indice} no puede estar vacía.`));
    } else {
      funciones.push(item.trim());
    }
  });
  return funciones;
};

const lanzarSiHayErrores = (errores) => {
  if (errores.length === 0) return;

  const camposFaltantes = errores.filter((e) => e.tipo === 'faltante').map((e) => e.campo);
  const partes = [];

  if (camposFaltantes.length === 1) {
    partes.push(`Falta el campo obligatorio: ${camposFaltantes[0]}.`);
  } else if (camposFaltantes.length > 1) {
    partes.push(`Faltan los campos obligatorios: ${camposFaltantes.join(', ')}.`);
  }
  errores.filter((e) => e.tipo === 'invalido').forEach((e) => partes.push(e.mensaje));

  throw new HttpError(400, partes.join(' '), {
    campos_faltantes: camposFaltantes,
    errores: errores.map(({ campo, mensaje }) => ({ campo, mensaje })),
  });
};

// Valida y normaliza el cuerpo de POST /cargos y PUT /cargos/:id (representación completa del cargo).
const validarCargo = (body) => {
  const datos = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errores = [];

  const cargo = {
    nombre: normalizarTexto(datos.nombre, 'nombre', { requerido: true, maxLength: MAX_NOMBRE }, errores),
    id_nivel_salarial: normalizarEntero(datos.id_nivel_salarial, 'id_nivel_salarial', { requerido: true }, errores),
    id_departamento: normalizarEntero(datos.id_departamento, 'id_departamento', {}, errores),
    id_cargo_superior: normalizarEntero(datos.id_cargo_superior, 'id_cargo_superior', {}, errores),
    perfil_requerido: normalizarTexto(datos.perfil_requerido, 'perfil_requerido', {}, errores),
    funciones: normalizarFunciones(datos.funciones, errores),
  };

  lanzarSiHayErrores(errores);
  return cargo;
};

const validarIdCargo = (valor) => {
  const errores = [];
  const id = normalizarEntero(valor, 'id', { requerido: true }, errores);
  lanzarSiHayErrores(errores);
  return id;
};

// ?area_id es opcional: si no viene se devuelven todos los cargos activos.
const validarFiltroArea = (valor) => {
  const errores = [];
  const idArea = normalizarEntero(valor, 'area_id', {}, errores);
  lanzarSiHayErrores(errores);
  return idArea;
};

module.exports = { validarCargo, validarIdCargo, validarFiltroArea };

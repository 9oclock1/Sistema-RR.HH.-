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
const { NIVELES_SALARIALES } = require('../utils/nivelesSalariales');

const MAX_CODIGO = 20;
const MAX_NOMBRE = 100;
const MONTO_REGEX = /^\d{1,10}(\.\d{1,2})?$/;

// Obligatorio aunque la columna tenga DEFAULT (RF-17, criterio 3). Acepta cualquier combinación de
// mayúsculas y devuelve la escritura oficial del catálogo, para que las comparaciones sean exactas.
const normalizarNivelSalarial = (valor, errores) => {
  const campo = 'nivel_salarial';
  if (esVacio(valor)) {
    errores.push(faltante(campo));
    return null;
  }
  const texto = typeof valor === 'string' ? valor.trim().toLowerCase() : null;
  const nivel = NIVELES_SALARIALES.find((n) => n.toLowerCase() === texto);

  if (!nivel) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser uno de: ${NIVELES_SALARIALES.join(', ')}.`));
    return null;
  }
  return nivel;
};

const normalizarMonto = (valor, campo, errores) => {
  if (esVacio(valor)) {
    errores.push(faltante(campo));
    return null;
  }
  const texto = typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : valor;
  if (typeof texto !== 'string' || !MONTO_REGEX.test(texto.trim())) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser un monto positivo con hasta 2 decimales.`));
    return null;
  }
  return texto.trim();
};

const normalizarFunciones = (valor, errores) => {
  if (valor === undefined || valor === null) {
    errores.push(faltante('funciones'));
    return [];
  }
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
      funciones.push(item.trim().replace(/\s+/g, ' '));
    }
  });

  if (valor.length === 0) {
    errores.push(invalido('funciones', 'El cargo debe tener al menos una función clave.'));
  }
  return funciones;
};

const validarCargo = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const cargo = {
    codigo: normalizarTexto(datos.codigo, 'codigo', { requerido: true, maxLength: MAX_CODIGO }, errores),
    nombre: normalizarTexto(datos.nombre, 'nombre', { requerido: true, maxLength: MAX_NOMBRE }, errores),
    id_departamento: normalizarUuid(datos.id_departamento, 'id_departamento', { requerido: true }, errores),
    id_cargo_jefe_directo: normalizarUuid(datos.id_cargo_jefe_directo, 'id_cargo_jefe_directo', {}, errores),
    nivel_salarial: normalizarNivelSalarial(datos.nivel_salarial, errores),
    salario_base_referencial: normalizarMonto(datos.salario_base_referencial, 'salario_base_referencial', errores),
    requisitos_minimos: normalizarTexto(datos.requisitos_minimos, 'requisitos_minimos', { requerido: true }, errores),
    funciones: normalizarFunciones(datos.funciones, errores),
  };

  lanzarSiHayErrores(errores);
  return cargo;
};

const validarIdCargo = (valor) => validarIdRuta(valor, 'id');

const validarFiltroArea = (valor) => {
  const errores = [];
  const idArea = normalizarUuid(valor, 'area_id', {}, errores);
  lanzarSiHayErrores(errores);
  return idArea;
};

module.exports = { validarCargo, validarIdCargo, validarFiltroArea };

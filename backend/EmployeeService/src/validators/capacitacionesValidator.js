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

const TIPOS_CAPACITACION = ['INDUCCION', 'CARNET_SANITARIO', 'TECNICA', 'CERTIFICACION'];
const ESTADOS_VIGENCIA = ['VIGENTE', 'POR_VENCER', 'VENCIDA', 'SIN_VENCIMIENTO'];
const FECHA_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const ENTERO_REGEX = /^\d+$/;
const INT_MAX = 2147483647;

const normalizarOpcion = (valor, campo, opciones, { requerido = false } = {}, errores) => {
  const texto = normalizarTexto(valor, campo, { requerido }, errores);
  if (texto === null) return null;

  const opcion = texto.toUpperCase();
  if (!opciones.includes(opcion)) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser uno de: ${opciones.join(', ')}.`));
    return null;
  }
  return opcion;
};

const normalizarEntero = (valor, campo, { requerido = false, minimo = 1 } = {}, errores) => {
  if (esVacio(valor)) {
    if (requerido) errores.push(faltante(campo));
    return null;
  }
  const texto = typeof valor === 'number' ? String(valor) : valor;
  if (typeof texto !== 'string' || !ENTERO_REGEX.test(texto.trim()) || Number(texto) < minimo || Number(texto) > INT_MAX) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser un número entero mayor o igual a ${minimo}.`));
    return null;
  }
  return Number(texto);
};

const normalizarBooleano = (valor, campo, errores) => {
  if (esVacio(valor)) return null;
  if (typeof valor === 'boolean') return valor;
  const texto = typeof valor === 'string' ? valor.trim().toLowerCase() : null;
  if (texto === 'true') return true;
  if (texto === 'false') return false;
  errores.push(invalido(campo, `El campo '${campo}' debe ser verdadero o falso.`));
  return null;
};

const normalizarFecha = (valor, campo, { requerido = false } = {}, errores) => {
  if (esVacio(valor)) {
    if (requerido) errores.push(faltante(campo));
    return null;
  }
  const texto = typeof valor === 'string' ? valor.trim() : '';
  const partes = FECHA_REGEX.exec(texto);
  const fecha = partes && new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
  if (!fecha || fecha.toISOString().slice(0, 10) !== texto) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser una fecha válida con formato AAAA-MM-DD.`));
    return null;
  }
  return texto;
};

const validarCurso = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const curso = {
    codigo: normalizarTexto(datos.codigo, 'codigo', { requerido: true, maxLength: 30 }, errores),
    nombre: normalizarTexto(datos.nombre, 'nombre', { requerido: true, maxLength: 150 }, errores),
    descripcion: normalizarTexto(datos.descripcion, 'descripcion', {}, errores),
    horas_academicas: normalizarEntero(datos.horas_academicas, 'horas_academicas', { requerido: true }, errores),
    tipo_capacitacion: normalizarOpcion(datos.tipo_capacitacion, 'tipo_capacitacion', TIPOS_CAPACITACION, { requerido: true }, errores),
    requiere_vencimiento: normalizarBooleano(datos.requiere_vencimiento, 'requiere_vencimiento', errores),
    meses_vigencia: normalizarEntero(datos.meses_vigencia, 'meses_vigencia', {}, errores),
  };

  if (curso.tipo_capacitacion === 'CARNET_SANITARIO') {
    if (curso.requiere_vencimiento === false) {
      errores.push(invalido('requiere_vencimiento', 'Un carnet sanitario siempre tiene fecha de vencimiento.'));
    }
    curso.requiere_vencimiento = true;
  }
  curso.requiere_vencimiento = curso.requiere_vencimiento ?? false;

  if (curso.meses_vigencia !== null && !curso.requiere_vencimiento) {
    errores.push(invalido('meses_vigencia', "Solo se indican meses de vigencia cuando el curso requiere vencimiento."));
  }

  lanzarSiHayErrores(errores);
  return curso;
};

const validarFiltrosCursos = (query) => {
  const datos = cuerpoComoObjeto(query);
  const errores = [];

  const filtros = {
    tipo_capacitacion: normalizarOpcion(datos.tipo, 'tipo', TIPOS_CAPACITACION, {}, errores),
    incluir_inactivos: normalizarBooleano(datos.incluir_inactivos, 'incluir_inactivos', errores) ?? false,
  };

  lanzarSiHayErrores(errores);
  return filtros;
};

const validarCapacitacion = (body, { conEmpleado = true } = {}) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const capacitacion = {
    id_curso: normalizarUuid(datos.id_curso, 'id_curso', { requerido: true }, errores),
    institucion_emisora: normalizarTexto(datos.institucion_emisora, 'institucion_emisora', { requerido: true, maxLength: 120 }, errores),
    fecha_inicio: normalizarFecha(datos.fecha_inicio, 'fecha_inicio', {}, errores),
    fecha_fin: normalizarFecha(datos.fecha_fin, 'fecha_fin', {}, errores),
    fecha_emision: normalizarFecha(datos.fecha_emision, 'fecha_emision', { requerido: true }, errores),
    fecha_vencimiento: normalizarFecha(datos.fecha_vencimiento, 'fecha_vencimiento', {}, errores),
    id_solicitud_servicio: normalizarUuid(datos.id_solicitud_servicio, 'id_solicitud_servicio', {}, errores),
  };
  if (conEmpleado) {
    capacitacion.id_empleado = normalizarUuid(datos.id_empleado, 'id_empleado', { requerido: true }, errores);
  }

  const { fecha_inicio, fecha_fin, fecha_emision, fecha_vencimiento } = capacitacion;
  if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) {
    errores.push(invalido('fecha_fin', 'La fecha de fin no puede ser anterior a la fecha de inicio.'));
  }
  if (fecha_emision && fecha_fin && fecha_emision < fecha_fin) {
    errores.push(invalido('fecha_emision', 'La fecha de emisión no puede ser anterior a la fecha de fin del curso.'));
  }
  if (fecha_emision && !fecha_fin && fecha_inicio && fecha_emision < fecha_inicio) {
    errores.push(invalido('fecha_emision', 'La fecha de emisión no puede ser anterior a la fecha de inicio del curso.'));
  }
  if (fecha_emision && fecha_vencimiento && fecha_vencimiento <= fecha_emision) {
    errores.push(invalido('fecha_vencimiento', 'La fecha de vencimiento debe ser posterior a la fecha de emisión.'));
  }

  lanzarSiHayErrores(errores);
  return capacitacion;
};

const validarFiltrosCapacitaciones = (query) => {
  const datos = cuerpoComoObjeto(query);
  const errores = [];

  const filtros = {
    id_empleado: normalizarUuid(datos.id_empleado, 'id_empleado', {}, errores),
    id_curso: normalizarUuid(datos.id_curso, 'id_curso', {}, errores),
    tipo_capacitacion: normalizarOpcion(datos.tipo, 'tipo', TIPOS_CAPACITACION, {}, errores),
    estado_vigencia: normalizarOpcion(datos.estado, 'estado', ESTADOS_VIGENCIA, {}, errores),
  };

  lanzarSiHayErrores(errores);
  return filtros;
};

const validarId = (valor) => validarIdRuta(valor, 'id');

module.exports = {
  normalizarOpcion,
  normalizarEntero,
  normalizarFecha,
  validarCurso,
  validarFiltrosCursos,
  validarCapacitacion,
  validarFiltrosCapacitaciones,
  validarId,
};

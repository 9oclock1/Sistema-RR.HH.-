const { esVacio, invalido, cuerpoComoObjeto, normalizarTexto, normalizarUuid, lanzarSiHayErrores } = require('./comunes');

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS_FILTRO = ['EN_CURSO', 'FORMALIZADO', 'TODOS'];

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

// POST /planes-ascenso
const validarAsignacionPlan = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];
  const plan = {
    id_empleado: normalizarUuid(datos.id_empleado, 'id_empleado', { requerido: true }, errores),
    id_cargo_destino: normalizarUuid(datos.id_cargo_destino, 'id_cargo_destino', { requerido: true }, errores),
    observaciones: normalizarTexto(datos.observaciones, 'observaciones', { maxLength: 500 }, errores),
  };
  lanzarSiHayErrores(errores);
  return plan;
};

// POST /planes-ascenso/:id/formalizacion. confirmar_pendientes: el Administrador ya vio la advertencia de cursos
// pendientes y decide formalizar igual. Sin sucursal, el empleado conserva la actual.
const validarFormalizacion = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];
  if (datos.confirmar_pendientes !== undefined && typeof datos.confirmar_pendientes !== 'boolean') {
    errores.push(invalido('confirmar_pendientes', "El campo 'confirmar_pendientes' debe ser verdadero o falso."));
  }
  const formalizacion = {
    id_sucursal: normalizarUuid(datos.id_sucursal, 'id_sucursal', {}, errores),
    fecha_inicio: normalizarFecha(datos.fecha_inicio, 'fecha_inicio', errores),
    confirmar_pendientes: datos.confirmar_pendientes === true,
  };
  lanzarSiHayErrores(errores);
  return formalizacion;
};

const validarFiltroEstado = (valor) => {
  if (esVacio(valor)) return 'EN_CURSO';
  const estado = String(valor).trim().toUpperCase();
  if (!ESTADOS_FILTRO.includes(estado)) {
    lanzarSiHayErrores([invalido('estado', `Use uno de: ${ESTADOS_FILTRO.join(', ')}.`)]);
  }
  return estado;
};

module.exports = { validarAsignacionPlan, validarFormalizacion, validarFiltroEstado };

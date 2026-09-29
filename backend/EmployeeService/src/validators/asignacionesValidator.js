const { esVacio, invalido, cuerpoComoObjeto, normalizarUuid, lanzarSiHayErrores } = require('./comunes');

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

const validarAsignacion = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const asignacion = {
    id_empleado: normalizarUuid(datos.id_empleado, 'id_empleado', { requerido: true }, errores),
    id_cargo: normalizarUuid(datos.id_cargo, 'id_cargo', { requerido: true }, errores),
    id_sucursal: normalizarUuid(datos.id_sucursal, 'id_sucursal', { requerido: true }, errores),
    fecha_inicio: normalizarFecha(datos.fecha_inicio, 'fecha_inicio', errores),
  };

  lanzarSiHayErrores(errores);
  return asignacion;
};

module.exports = { validarAsignacion };

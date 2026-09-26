const asignacionesModel = require('../models/asignacionesModel');
const empleadosModel = require('../models/empleadosModel');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');

const empleadoNoEncontrado = () => new HttpError(404, 'El empleado solicitado no existe.');

const validarReglas = async (client, asignacion, empleado, vigente, hoy) => {
  const errores = [];

  const { fecha_inicio: fechaInicio } = asignacion;
  if (fechaInicio > hoy) {
    errores.push({ campo: 'fecha_inicio', mensaje: 'La fecha de vigencia no puede ser futura.' });
  } else if (fechaInicio < empleado.fecha_ingreso) {
    errores.push({
      campo: 'fecha_inicio',
      mensaje: `La fecha de vigencia no puede ser anterior al ingreso del empleado (${empleado.fecha_ingreso}).`,
    });
  } else if (vigente && fechaInicio < vigente.fecha_inicio) {
    errores.push({
      campo: 'fecha_inicio',
      mensaje: `La fecha de vigencia no puede ser anterior al inicio de la asignación actual (${vigente.fecha_inicio}).`,
    });
  }

  if (asignacion.id_cargo === empleado.id_cargo_actual && asignacion.id_sucursal === empleado.id_sucursal_actual) {
    errores.push({ campo: 'id_cargo', mensaje: 'El empleado ya tiene asignados ese cargo y esa sucursal.' });
  }

  if (errores.length > 0) {
    throw new HttpError(400, errores.map((e) => e.mensaje).join(' '), { campos_faltantes: [], errores });
  }
};

const crearAsignacion = (datos) =>
  withTransaction(async (client) => {
    const empleado = await empleadosModel.bloquearPorId(client, datos.id_empleado);
    if (!empleado) throw empleadoNoEncontrado();

    const hoy = await asignacionesModel.fechaActual(client);
    const asignacion = { ...datos, fecha_inicio: datos.fecha_inicio ?? hoy };
    const vigente = await asignacionesModel.obtenerVigente(client, asignacion.id_empleado);

    await validarReglas(client, asignacion, empleado, vigente, hoy);

    if (vigente) await asignacionesModel.cerrar(client, vigente.id_asignacion, asignacion.fecha_inicio);
    await asignacionesModel.insertarVigente(client, asignacion);
    await empleadosModel.actualizarAsignacionActual(client, asignacion.id_empleado, asignacion);

    return {
      id_empleado: asignacion.id_empleado,
      historial: await asignacionesModel.listarPorEmpleado(client, asignacion.id_empleado),
    };
  });

module.exports = { crearAsignacion };

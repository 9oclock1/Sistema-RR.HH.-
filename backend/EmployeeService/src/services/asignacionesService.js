const asignacionesModel = require('../models/asignacionesModel');
const empleadosModel = require('../models/empleadosModel');
const sucursalesModel = require('../models/sucursalesModel');
const empleadosService = require('./empleadosService');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');

const validarReglas = async (client, asignacion, empleado, vigente, hoy) => {
  const errores = [];

  const cargo = await asignacionesModel.obtenerEstadoCargo(client, asignacion.id_cargo);
  if (!cargo) {
    errores.push({ campo: 'id_cargo', mensaje: 'El cargo seleccionado no existe.' });
  } else if (!cargo.esta_activo) {
    errores.push({ campo: 'id_cargo', mensaje: `El cargo «${cargo.nombre}» no está activo: no admite nuevas asignaciones.` });
  }

  const sucursal = await sucursalesModel.obtenerEstado(client, asignacion.id_sucursal);
  if (!sucursal) {
    errores.push({ campo: 'id_sucursal', mensaje: 'La sucursal seleccionada no existe.' });
  } else if (!sucursal.esta_activa) {
    errores.push({ campo: 'id_sucursal', mensaje: `La sucursal «${sucursal.nombre}» no está activa.` });
  }

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
    if (!empleado) throw empleadosService.noEncontrado();

    const hoy = await asignacionesModel.fechaActual(client);
    const asignacion = { ...datos, fecha_inicio: datos.fecha_inicio ?? hoy };
    const vigente = await asignacionesModel.obtenerVigente(client, asignacion.id_empleado);

    await validarReglas(client, asignacion, empleado, vigente, hoy);

    if (vigente) await asignacionesModel.cerrar(client, vigente.id_asignacion, asignacion.fecha_inicio);
    await asignacionesModel.insertarVigente(client, asignacion);
    await empleadosModel.actualizarAsignacionActual(client, asignacion.id_empleado, asignacion);

    return empleadosService.construirFicha(client, asignacion.id_empleado);
  });

module.exports = { crearAsignacion };

const pool = require('../../db/pool');
const empleadosModel = require('../models/empleadosModel');
const asignacionesModel = require('../models/asignacionesModel');
const HttpError = require('../utils/HttpError');

const noEncontrado = () => new HttpError(404, 'El empleado solicitado no existe.');

const aFicha = (fila, historial) => ({
  id_empleado: fila.id_empleado,
  numero_documento: fila.numero_documento,
  complemento_documento: fila.complemento_documento,
  nombres: fila.nombres,
  primer_apellido: fila.primer_apellido,
  segundo_apellido: fila.segundo_apellido,
  nombre_completo: fila.nombre_completo,
  fecha_nacimiento: fila.fecha_nacimiento,
  genero: fila.genero,
  telefono_celular: fila.telefono_celular,
  correo_personal: fila.correo_personal,
  direccion_domicilio: fila.direccion_domicilio,
  fecha_ingreso: fila.fecha_ingreso,
  estado: { codigo: fila.estado_codigo, nombre: fila.estado_nombre },
  asignacion_actual: {
    id_asignacion: fila.id_asignacion,
    vigente_desde: fila.vigente_desde,
    cargo: { id_cargo: fila.id_cargo, codigo: fila.cargo_codigo, nombre: fila.cargo_nombre, esta_activo: fila.cargo_activo },
    area: { id_departamento: fila.id_departamento, nombre: fila.area_nombre },
    sucursal: { id_sucursal: fila.id_sucursal, nombre: fila.sucursal_nombre, ciudad: fila.sucursal_ciudad },
  },
  historial,
});

const construirFicha = async (db, idEmpleado) => {
  const fila = await empleadosModel.obtenerFicha(db, idEmpleado);
  if (!fila) throw noEncontrado();
  return aFicha(fila, await asignacionesModel.listarPorEmpleado(db, idEmpleado));
};

const listarEmpleados = () => empleadosModel.listar(pool);

const obtenerFicha = (idEmpleado) => construirFicha(pool, idEmpleado);

module.exports = { listarEmpleados, obtenerFicha, construirFicha, noEncontrado };

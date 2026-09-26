const pool = require('../../db/pool');
const cargosModel = require('../models/cargosModel');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');

const noEncontrado = () => new HttpError(404, 'El cargo solicitado no existe.');

const validarReferencias = async (client, cargo, idCargoActual = null) => {
  const errores = [];

  if (await cargosModel.existeCodigoActivo(client, cargo.codigo, idCargoActual)) {
    errores.push({ campo: 'codigo', mensaje: `Ya existe un cargo activo con el código «${cargo.codigo}».` });
  }

  const departamento = await cargosModel.obtenerEstadoDepartamento(client, cargo.id_departamento);
  if (!departamento) {
    errores.push({ campo: 'id_departamento', mensaje: 'El área seleccionada no existe.' });
  } else if (!departamento.esta_activo) {
    errores.push({ campo: 'id_departamento', mensaje: 'El área seleccionada está dada de baja.' });
  }

  if (cargo.id_cargo_jefe_directo) {
    if (cargo.id_cargo_jefe_directo === idCargoActual) {
      errores.push({ campo: 'id_cargo_jefe_directo', mensaje: 'Un cargo no puede ser su propio jefe directo.' });
    } else {
      const jefe = await cargosModel.obtenerEstadoCargo(client, cargo.id_cargo_jefe_directo);
      if (!jefe) {
        errores.push({ campo: 'id_cargo_jefe_directo', mensaje: 'El cargo de jefe directo no existe.' });
      } else if (!jefe.esta_activo) {
        errores.push({ campo: 'id_cargo_jefe_directo', mensaje: 'El cargo de jefe directo está inactivo.' });
      } else if (idCargoActual && (await cargosModel.esSubordinado(client, idCargoActual, cargo.id_cargo_jefe_directo))) {
        errores.push({
          campo: 'id_cargo_jefe_directo',
          mensaje: 'El jefe directo no puede ser un cargo subordinado a este (se formaría un ciclo).',
        });
      }
    }
  }

  if (errores.length > 0) {
    throw new HttpError(400, errores.map((e) => e.mensaje).join(' '), { campos_faltantes: [], errores });
  }
};

const listarCargos = (idDepartamento) => cargosModel.listar(pool, { idDepartamento });

const obtenerCargo = async (idCargo) => {
  const cargo = await cargosModel.obtenerPorId(pool, idCargo);
  if (!cargo) throw noEncontrado();
  return cargo;
};

const crearCargo = (cargo) =>
  withTransaction(async (client) => {
    await validarReferencias(client, cargo);
    const idCargo = await cargosModel.insertar(client, cargo);
    return cargosModel.obtenerPorId(client, idCargo);
  });

// PUT: reemplaza todos los campos editables, incluida la lista completa de funciones.
const reemplazarCargo = (idCargo, cargo) =>
  withTransaction(async (client) => {
    if (!(await cargosModel.bloquearPorId(client, idCargo))) throw noEncontrado();

    await validarReferencias(client, cargo, idCargo);
    await cargosModel.reemplazar(client, idCargo, cargo);
    return cargosModel.obtenerPorId(client, idCargo);
  });

module.exports = { listarCargos, obtenerCargo, crearCargo, reemplazarCargo };

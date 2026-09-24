const pool = require('../../db/pool');
const cargosModel = require('../models/cargosModel');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');

const noEncontrado = (idCargo) => new HttpError(404, `No existe un cargo con id ${idCargo}.`);


const validarReferencias = async (client, cargo, idCargoActual = null) => {
  const errores = [];

  if (!(await cargosModel.existeNivelSalarial(client, cargo.id_nivel_salarial))) {
    errores.push({
      campo: 'id_nivel_salarial',
      mensaje: `No existe un nivel salarial con id ${cargo.id_nivel_salarial}.`,
    });
  }

  if (cargo.id_departamento) {
    const departamento = await cargosModel.obtenerEstadoDepartamento(client, cargo.id_departamento);
    if (!departamento) {
      errores.push({ campo: 'id_departamento', mensaje: `No existe un área con id ${cargo.id_departamento}.` });
    } else if (!departamento.activo) {
      errores.push({ campo: 'id_departamento', mensaje: `El área con id ${cargo.id_departamento} está dada de baja.` });
    }
  }

  if (cargo.id_cargo_superior) {
    if (cargo.id_cargo_superior === idCargoActual) {
      errores.push({ campo: 'id_cargo_superior', mensaje: 'Un cargo no puede ser su propio cargo superior.' });
    } else {
      const superior = await cargosModel.obtenerEstadoCargo(client, cargo.id_cargo_superior);
      if (!superior) {
        errores.push({ campo: 'id_cargo_superior', mensaje: `No existe un cargo con id ${cargo.id_cargo_superior}.` });
      } else if (!superior.activo) {
        errores.push({ campo: 'id_cargo_superior', mensaje: `El cargo con id ${cargo.id_cargo_superior} está inactivo.` });
      }
    }
  }

  if (errores.length > 0) {
    throw new HttpError(400, errores.map((e) => e.mensaje).join(' '), { campos_faltantes: [], errores });
  }
};

const guardarFunciones = async (client, idCargo, funciones) => {
  for (const [indice, descripcion] of funciones.entries()) {
    await cargosModel.insertarFuncion(client, idCargo, descripcion, indice + 1);
  }
};

const listarCargos = (idDepartamento) => cargosModel.listar(pool, { idDepartamento });

const obtenerCargo = async (idCargo) => {
  const cargo = await cargosModel.obtenerPorId(pool, idCargo);
  if (!cargo) throw noEncontrado(idCargo);
  return cargo;
};

const crearCargo = (cargo) =>
  withTransaction(async (client) => {
    await validarReferencias(client, cargo);
    const idCargo = await cargosModel.insertar(client, cargo);
    await guardarFunciones(client, idCargo, cargo.funciones);
    return cargosModel.obtenerPorId(client, idCargo);
  });

// PUT: reemplaza todos los campos editables y la lista completa de funciones.
const reemplazarCargo = (idCargo, cargo) =>
  withTransaction(async (client) => {
    if (!(await cargosModel.bloquearPorId(client, idCargo))) throw noEncontrado(idCargo);

    await validarReferencias(client, cargo, idCargo);
    await cargosModel.reemplazar(client, idCargo, cargo);
    await cargosModel.eliminarFunciones(client, idCargo);
    await guardarFunciones(client, idCargo, cargo.funciones);
    return cargosModel.obtenerPorId(client, idCargo);
  });

module.exports = { listarCargos, obtenerCargo, crearCargo, reemplazarCargo };

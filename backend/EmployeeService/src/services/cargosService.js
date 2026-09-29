const pool = require('../../db/pool');
const cargosModel = require('../models/cargosModel');
const jerarquiaModel = require('../models/jerarquia.model');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');

const noEncontrado = () => new HttpError(404, 'El cargo solicitado no existe.');

// Monto decimal a centavos sin pasar por float: '8000', '8000.0' y '8000.00' son el mismo salario.
const aCentavos = (monto) => {
  const [enteros, decimales = ''] = String(monto).split('.');
  return BigInt(enteros) * 100n + BigInt(decimales.padEnd(2, '0'));
};

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

    // RF-18: si el cargo nace con un jefe directo asignado, también queda
    // constancia en el historial de jerarquía (no solo los cambios por
    // PUT /cargos/:id o por el endpoint de jerarquía).
    if (cargo.id_cargo_jefe_directo) {
      await jerarquiaModel.registrarHistorial(
        { idCargo, anterior: null, nuevo: cargo.id_cargo_jefe_directo },
        client
      );
    }

    return cargosModel.obtenerPorId(client, idCargo);
  });

// PUT: reemplaza todos los campos editables, incluida la lista completa de funciones.
// RF-17.3: la fecha de modificación solo avanza si cambió el nivel salarial o el salario; el resto de cambios no la toca.
const reemplazarCargo = (idCargo, cargo) =>
  withTransaction(async (client) => {
    const actual = await cargosModel.bloquearPorId(client, idCargo);
    if (!actual) throw noEncontrado();

    // RF-18: se guarda el jefe directo ANTES del UPDATE para poder comparar
    // y dejar constancia del cambio en el historial de jerarquía, igual que
    // hace el endpoint dedicado de jerarquía (PUT /jerarquia/cargos/:id/superior).
    const cargoAntes = await cargosModel.obtenerPorId(client, idCargo);
    const anterior = cargoAntes?.id_cargo_jefe_directo ?? null;
    const nuevo = cargo.id_cargo_jefe_directo ?? null;

    await validarReferencias(client, cargo, idCargo);
    const cambioSalarial =
      cargo.nivel_salarial !== actual.nivel_salarial ||
      aCentavos(cargo.salario_base_referencial) !== aCentavos(actual.salario_base_referencial);
    await cargosModel.reemplazar(client, idCargo, cargo, { cambioSalarial });

    if (anterior !== nuevo) {
      await jerarquiaModel.registrarHistorial({ idCargo, anterior, nuevo }, client);
    }

    return cargosModel.obtenerPorId(client, idCargo);
  });

module.exports = { listarCargos, obtenerCargo, crearCargo, reemplazarCargo };
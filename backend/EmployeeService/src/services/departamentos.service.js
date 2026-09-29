// src/services/departamentos.service.js
const pool = require('../../db/pool');
const repo = require('../models/departamentos.model');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');

const noEncontrado = () => new HttpError(404, 'El área no existe.');

const plural = (cantidad, singular, varios) => `${cantidad} ${cantidad === 1 ? singular : varios}`;

const validarReferencias = async (client, datos, idActual = null) => {
  const errores = [];

  if (await repo.existeCodigoActivo(client, datos.codigo, idActual)) {
    errores.push({ campo: 'codigo', mensaje: `Ya existe un área activa con el código «${datos.codigo}».` });
  }

  const idPadre = datos.id_departamento_padre;
  if (idPadre) {
    if (idPadre === idActual) {
      errores.push({ campo: 'id_departamento_padre', mensaje: 'Un área no puede depender de sí misma.' });
    } else {
      const padre = await repo.obtenerEstadoPadre(client, idPadre);
      if (!padre) {
        errores.push({ campo: 'id_departamento_padre', mensaje: 'El área superior seleccionada no existe.' });
      } else if (!padre.esta_activo) {
        errores.push({ campo: 'id_departamento_padre', mensaje: 'El área superior seleccionada está dada de baja.' });
      } else if (idActual && (await repo.esDescendiente(client, idActual, idPadre))) {
        errores.push({
          campo: 'id_departamento_padre',
          mensaje: 'El área superior no puede ser una sub-área de esta (se formaría un ciclo).',
        });
      }
    }
  }

  if (errores.length > 0) {
    throw new HttpError(400, errores.map((e) => e.mensaje).join(' '), { campos_faltantes: [], errores });
  }
};

async function listarAreasActivas() {
  return repo.listarActivos(pool);
}

/**
 * Criterio 1
 */
function registrarArea(datos) {
  return withTransaction(async (client) => {
    await validarReferencias(client, datos);
    const id = await repo.insertar(client, datos);
    return repo.obtenerPorId(client, id);
  });
}

/**
 * Criterio 2: PUT reemplaza los campos editables y conserva el identificador.
 */
function modificarArea(idDepartamento, datos) {
  return withTransaction(async (client) => {
    const existente = await repo.bloquearPorId(client, idDepartamento);
    if (!existente) throw noEncontrado();
    if (!existente.esta_activo) throw new HttpError(409, 'No se puede modificar un área dada de baja.');

    await validarReferencias(client, datos, idDepartamento);
    await repo.reemplazar(client, idDepartamento, datos);
    return repo.obtenerPorId(client, idDepartamento);
  });
}

/**
 * Criterios 3 y 4: solo se da de baja si no tiene empleados activos, cargos activos ni sub-áreas activas.
 * La fila queda bloqueada durante la verificación para que nadie le asigne un cargo a la vez.
 */
function darDeBajaArea(idDepartamento) {
  return withTransaction(async (client) => {
    const existente = await repo.bloquearPorId(client, idDepartamento);
    if (!existente) throw noEncontrado();
    if (!existente.esta_activo) throw new HttpError(409, 'El área ya está inactiva.');

    const { empleados, cargos, subareas } = await repo.contarDependencias(client, idDepartamento);
    const motivos = [];
    if (empleados > 0) motivos.push(plural(empleados, 'empleado activo asignado', 'empleados activos asignados'));
    if (cargos > 0) motivos.push(plural(cargos, 'cargo activo', 'cargos activos'));
    if (subareas > 0) motivos.push(plural(subareas, 'sub-área activa', 'sub-áreas activas'));

    if (motivos.length > 0) {
      throw new HttpError(409, `No se puede dar de baja el área «${existente.nombre}»: tiene ${motivos.join(', ')}.`, {
        dependencias: { empleados, cargos, subareas },
      });
    }

    await repo.darDeBaja(client, idDepartamento);
    return repo.obtenerPorId(client, idDepartamento);
  });
}

module.exports = {
  listarAreasActivas,
  registrarArea,
  modificarArea,
  darDeBajaArea,
};

// src/services/departamentos.service.js
const repo = require('../models/departamentos.model');

// Código de error que definimos en el trigger fn_validar_baja_departamento
const ERRCODE_BAJA_RECHAZADA = '23514'; // Postgres mapea 'check_violation' a este SQLSTATE

class DepartamentoError extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

/**
 * Criterio 1
 */
async function registrarArea(datos) {
  if (!datos.nombre || !datos.nombre.trim()) {
    throw new DepartamentoError('El área requiere un nombre.', 422);
  }
  const area = await repo.crear(datos);
  return area;
}

async function listarAreasActivas() {
  return repo.listarActivas();
}

/**
 * Criterio 2: conserva el identificador (el UPDATE nunca toca la PK)
 */
async function modificarArea(id_departamento, cambios) {
  const existente = await repo.obtenerPorId(id_departamento);
  if (!existente) {
    throw new DepartamentoError('El área no existe.', 404);
  }
  if (!cambios.nombre && !cambios.descripcion) {
    throw new DepartamentoError('Debes enviar al menos nombre o descripción para modificar.', 422);
  }
  return repo.actualizar(id_departamento, cambios);
}

/**
 * Criterios 3 y 4
 */
async function darDeBajaArea(id_departamento) {
  const existente = await repo.obtenerPorId(id_departamento);
  if (!existente) {
    throw new DepartamentoError('El área no existe.', 404);
  }
  if (!existente.activo) {
    throw new DepartamentoError('El área ya está inactiva.', 409);
  }

  try {
    const actualizado = await repo.darDeBaja(id_departamento);
    return actualizado; // Criterio 3: se marcó inactiva
  } catch (err) {
    // Criterio 4: el trigger rechazó la baja por dependencias activas
    if (err.code === ERRCODE_BAJA_RECHAZADA) {
      throw new DepartamentoError(err.message, 409);
    }
    throw err;
  }
}

module.exports = {
  DepartamentoError,
  registrarArea,
  listarAreasActivas,
  modificarArea,
  darDeBajaArea,
};
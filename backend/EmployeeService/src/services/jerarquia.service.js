// src/services/jerarquia.service.js
const model = require('../models/jerarquia.model');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class JerarquiaError extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

async function cargoOFallar(id, db, opciones) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) throw new JerarquiaError('El cargo no existe.', 404);
  const cargo = await model.obtenerCargo(id.toLowerCase(), db, opciones);
  if (!cargo) throw new JerarquiaError('El cargo no existe.', 404);
  return cargo;
}

async function listarCargos() {
  return model.listarCargosActivos();
}

// Criterio 3
async function listarSubordinados(idCargo) {
  const cargo = await cargoOFallar(idCargo);
  return model.listarSubordinados(cargo.id_cargo);
}

async function listarHistorial(idCargo) {
  const cargo = await cargoOFallar(idCargo);
  return model.listarHistorial(cargo.id_cargo);
}

// Criterios 1, 2 y 4. idSuperior = null quita el superior.
async function asignarSuperior(idCargo, idSuperior) {
  if (idSuperior !== null && (typeof idSuperior !== 'string' || !UUID_RE.test(idSuperior))) {
    throw new JerarquiaError('El cargo superior no existe.', 404);
  }

  return model.enTransaccion(async (db) => {
    const cargo = await cargoOFallar(idCargo, db, { bloquear: true });
    if (!cargo.esta_activo) {
      throw new JerarquiaError('El cargo está inactivo y no admite cambios de jerarquía.', 409);
    }

    let nuevo = null;
    if (idSuperior !== null) {
      nuevo = idSuperior.toLowerCase();
      const superior = await model.obtenerCargo(nuevo, db);
      if (!superior) throw new JerarquiaError('El cargo superior no existe.', 404);
      if (!superior.esta_activo) throw new JerarquiaError('El cargo superior está inactivo.', 409);

      // Criterio 2: rechazar ciclos (incluido "ser su propio superior")
      if (nuevo === cargo.id_cargo) {
        throw new JerarquiaError(
          'Un cargo no puede ser su propio superior: la jerarquía no puede ser circular.', 409);
      }
      if (await model.generaCiclo(cargo.id_cargo, nuevo, db)) {
        throw new JerarquiaError(
          `La jerarquía no puede ser circular: "${superior.nombre}" ya depende, directa o indirectamente, de "${cargo.nombre}".`,
          409
        );
      }
    }

    const anterior = cargo.id_cargo_jefe_directo ?? null;
    if (anterior === nuevo) {
      return { cambio: false, id_cargo: cargo.id_cargo, id_cargo_superior: nuevo };
    }

    // Criterio 4: reemplaza el superior y deja constancia del anterior
    await model.actualizarSuperior(cargo.id_cargo, nuevo, db);
    await model.registrarHistorial({ idCargo: cargo.id_cargo, anterior, nuevo }, db);
    return {
      cambio: true,
      id_cargo: cargo.id_cargo,
      id_cargo_superior: nuevo,
      id_cargo_superior_anterior: anterior,
    };
  });
}

module.exports = { JerarquiaError, listarCargos, listarSubordinados, listarHistorial, asignarSuperior };
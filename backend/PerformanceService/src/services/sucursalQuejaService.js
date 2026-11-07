const modelo = require("../models/sucursalQuejaModel");
const casosModelo = require("../models/casosQuejaModel");
const { enTransaccion } = require("../config/transaccion");
const { consultarSucursal } = require("./sucursalesExternas");
const { ErrorApp } = require("../utils/errores");
const { normalizarUuid } = require("../utils/casosQueja");

const NO_ENCONTRADA = "No se encontró la queja.";
const QUEJA_CERRADA = "La queja ya está cerrada y no admite cambios.";

function idQuejaValido(idQueja) {
  const id = normalizarUuid(idQueja);
  if (!id) throw new ErrorApp(404, NO_ENCONTRADA);
  return id;
}

const sucursalDe = (id, nombre) => (id ? { id_sucursal: id, nombre } : null);

async function obtener(idQueja) {
  const id = idQuejaValido(idQueja);
  const fila = await modelo.obtenerSucursalDeQueja(id);
  if (!fila) throw new ErrorApp(404, NO_ENCONTRADA);
  return { sucursal: sucursalDe(fila.id_sucursal, fila.sucursal_nombre), editable: !fila.es_final };
}

function leerSucursal(cuerpo) {
  const valor = cuerpo.id_sucursal;
  if (valor === null || valor === "") return null;
  const id = normalizarUuid(valor);
  if (!id) {
    const mensaje = "Seleccione una sucursal válida.";
    throw new ErrorApp(400, mensaje, [{ campo: "id_sucursal", mensaje }]);
  }
  return id;
}

async function registrar({ idQueja, cuerpo = {} }) {
  const id = idQuejaValido(idQueja);
  const idSucursal = leerSucursal(cuerpo);

  let nombre = null;
  if (idSucursal) {
    const sucursal = await consultarSucursal(idSucursal);
    if (sucursal.estado === "no_existe") {
      const mensaje = "La sucursal seleccionada no existe o ya no está activa.";
      throw new ErrorApp(400, mensaje, [{ campo: "id_sucursal", mensaje }]);
    }
    if (sucursal.estado !== "encontrada") {
      throw new ErrorApp(503, "No se pudo consultar las sucursales. Intente nuevamente en unos minutos.");
    }
    nombre = sucursal.nombre;
  }

  await enTransaccion(async (db) => {
    const queja = await casosModelo.bloquearQueja(db, id);
    if (!queja) throw new ErrorApp(404, NO_ENCONTRADA);
    if (queja.es_final) throw new ErrorApp(409, QUEJA_CERRADA);
    if (idSucursal) await modelo.sincronizarSucursal(db, { idSucursal, nombre });
    await modelo.asignarSucursal(db, { idQueja: id, idSucursal });
  });

  return { sucursal: sucursalDe(idSucursal, nombre), editable: true };
}

module.exports = { obtener, registrar };

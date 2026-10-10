const pool = require('../../db/pool');
const memorandumsModel = require('../models/memorandumsModel');
const asignacionesModel = require('../models/asignacionesModel');
const { withTransaction } = require('../utils/transaction');

// RF-37 (criterio 4): amonestaciones previas en el periodo que disparan la alerta roja a RRHH.
const MESES_PERIODO_ALERTA = 6;
const UMBRAL_ALERTA_ROJA = 3;

const construirCite = (gestion, numero) => `MEM-${gestion}-${String(numero).padStart(4, '0')}`;

const crearMemorandum = async (datos) => {
  const amonestacionesPrevias = await memorandumsModel.contarRecientes(pool, datos.id_empleado_receptor, MESES_PERIODO_ALERTA);

  const memorandum = await withTransaction(async (client) => {
    const hoy = await asignacionesModel.fechaActual(client);
    const gestion = Number(hoy.slice(0, 4));
    const numero = await memorandumsModel.siguienteCorrelativo(client, gestion);

    return memorandumsModel.insertarBorrador(client, {
      ...datos,
      fecha_emision: hoy,
      gestion,
      numero_correlativo: numero,
      codigo_cite: construirCite(gestion, numero),
    });
  });

  return { memorandum, alerta_roja: amonestacionesPrevias >= UMBRAL_ALERTA_ROJA };
};

module.exports = { crearMemorandum };

const memorandumsModel = require('../models/memorandumsModel');
const asignacionesModel = require('../models/asignacionesModel');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');

// Valor de TIPOS_MEMORANDUM.clasificacion que identifica a los tipos de felicitación (RF-38).
const CLASIFICACION_RECONOCIMIENTO = 'RECONOCIMIENTO';

const construirCite = (gestion, numero) => `REC-${gestion}-${String(numero).padStart(4, '0')}`;

const errorTipoMemo = (mensaje) =>
  new HttpError(400, mensaje, { campos_faltantes: [], errores: [{ campo: 'id_tipo_memo', mensaje }] });

const crearReconocimiento = (datos) =>
  withTransaction(async (client) => {
    // Se valida antes de pedir el correlativo para no bloquear el contador con una petición inválida.
    const tipo = await memorandumsModel.obtenerTipo(client, datos.id_tipo_memo);
    if (!tipo) {
      throw errorTipoMemo(`No existe un tipo de memorándum con id_tipo_memo = ${datos.id_tipo_memo}.`);
    }
    if (tipo.clasificacion.trim().toUpperCase() !== CLASIFICACION_RECONOCIMIENTO) {
      throw errorTipoMemo(`El tipo de memorándum '${tipo.nombre}' no corresponde a un reconocimiento.`);
    }

    const hoy = await asignacionesModel.fechaActual(client);
    const gestion = Number(hoy.slice(0, 4));
    // Comparte el contador con los memorándums disciplinarios: la tabla exige (gestion, numero) único.
    const numero = await memorandumsModel.siguienteCorrelativo(client, gestion);

    return memorandumsModel.insertarReconocimiento(client, {
      ...datos,
      fecha_emision: hoy,
      gestion,
      numero_correlativo: numero,
      codigo_cite: construirCite(gestion, numero),
    });
  });

module.exports = { crearReconocimiento };

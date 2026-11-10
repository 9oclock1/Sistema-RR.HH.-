const { randomUUID } = require("node:crypto");
const pool = require("../config/db");
const eventos = require("../models/eventos.model");
const externos = require("./externos.service");
const { topicoPropio } = require("./eventos.service");
const { responsableEn } = require("./planillas.service");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { hoyLaPaz } = require("../utils/fechas");
const { validarResponsable } = require("../utils/planillas");
const { TIPO_SOLICITUD_CIERRE, periodoAFecha, armarSolicitudCierre } = require("../utils/ventasProductividad");

const topicoVentas = () => process.env.PUBSUB_TOPICO_VENTAS || "ucb-sis323-sub-e";

const formatear = (e) =>
  e
    ? {
        id_mensaje: e.id_evento,
        estado: e.estado,
        intentos: e.intentos,
        ultimo_error: e.ultimo_error,
        proximo_intento_en: e.estado === "PENDIENTE" ? e.proximo_intento_en : null,
        entregado_en: e.entregado_en,
        creado_en: e.creado_en,
      }
    : null;

function validarPeriodo(periodo) {
  if (!periodoAFecha(periodo)) {
    throw new ErrorApp(400, "Periodo inválido", [{ campo: "periodo", mensaje: "Use el formato AAAA-MM." }]);
  }
  if (periodo > hoyLaPaz().slice(0, 7)) {
    throw new ErrorApp(400, "Periodo inválido", [{ campo: "periodo", mensaje: "No se puede pedir el cierre de un mes futuro." }]);
  }
}

async function obtenerUltima({ periodo } = {}) {
  validarPeriodo(periodo);
  return { periodo, solicitud: formatear(await eventos.ultimoPorPeriodo(pool, TIPO_SOLICITUD_CIERRE, periodo)) };
}

async function solicitar({ periodo } = {}, identidad = {}) {
  const idResponsable = validarResponsable(identidad);
  validarPeriodo(periodo);
  const personal = await externos.listarPersonal();
  const nombre = responsableEn(personal, idResponsable);

  await enTransaccion(async (cliente) => {
    await eventos.bloquearClave(cliente, `${TIPO_SOLICITUD_CIERRE}:${periodo}`);
    const ultima = await eventos.ultimoPorPeriodo(cliente, TIPO_SOLICITUD_CIERRE, periodo);
    if (ultima?.estado === "PENDIENTE") {
      throw new ErrorApp(409, "Ya hay una solicitud de este mes en cola de envío: espere a que se envíe.");
    }
    const idEvento = randomUUID();
    const fecha = new Date().toISOString();
    await eventos.registrar(cliente, {
      idEvento,
      topico: topicoPropio(),
      tipoEvento: TIPO_SOLICITUD_CIERRE,
      idPlanilla: null,
      destino: null,
      carga: armarSolicitudCierre({
        idMensaje: idEvento,
        fecha,
        periodo,
        solicitante: { id_empleado: idResponsable, nombre_completo: nombre },
        personal,
        topicoRespuesta: topicoVentas(),
      }),
    });
  });
  return obtenerUltima({ periodo });
}

module.exports = { obtenerUltima, solicitar };

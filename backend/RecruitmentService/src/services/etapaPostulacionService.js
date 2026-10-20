const modelo = require("../models/etapaPostulacionModel");
const integracionService = require("./integracionService");
const HttpError = require("../utils/HttpError");
const { withTransaction } = require("../utils/transaction");
const { ETAPA, verificarCambioEtapa } = require("../utils/etapas");

const noEncontrada = () =>
  new HttpError(404, "La postulación indicada no existe.");

async function cambiarEtapa(idPostulacion, datos, usuario) {
  return withTransaction(async (client) => {
    const postulacion = await modelo.bloquearPostulacion(client, idPostulacion);
    if (!postulacion) throw noEncontrada();

    const destino = await modelo.obtenerEtapa(client, datos);
    const transicion = destino
      ? await modelo.obtenerTransicion(
          client,
          postulacion.id_etapa,
          destino.id_etapa,
        )
      : null;
    const permitidas =
      destino && !transicion
        ? await modelo.listarDestinosPermitidos(client, postulacion.id_etapa)
        : [];
    const cargo =
      datos.id_cargo_operativo !== null
        ? await modelo.obtenerCargoOperativo(client, datos.id_cargo_operativo)
        : null;
    const vacantes =
      destino?.id_etapa === ETAPA.CONTRATADO
        ? await modelo.contarVacantes(client, postulacion.id_convocatoria)
        : null;

    verificarCambioEtapa({
      postulacion,
      destino,
      transicion,
      permitidas,
      idCargoOperativo: datos.id_cargo_operativo,
      cargo,
      vacantes,
    });

    const actualizada = await modelo.actualizarEtapa(client, {
      idPostulacion,
      idEtapa: destino.id_etapa,
      idCargoOperativo: datos.id_cargo_operativo,
    });
    const historial = await modelo.registrarHistorial(client, {
      idPostulacion,
      idEtapaAnterior: postulacion.id_etapa,
      idEtapa: destino.id_etapa,
      usuario,
      motivo: datos.motivo,
    });
    const integraciones =
      destino.id_etapa === ETAPA.CONTRATADO
        ? await integracionService.registrarAltaContratacion(client, {
            postulacion: actualizada,
            cargo,
            usuario,
          })
        : [];

    return {
      postulacion: {
        ...actualizada,
        etapa_anterior: {
          id_etapa: postulacion.id_etapa,
          codigo: postulacion.codigo_etapa,
          nombre: postulacion.nombre_etapa,
        },
        etapa_actual: {
          id_etapa: destino.id_etapa,
          codigo: destino.codigo,
          nombre: destino.nombre,
        },
        cargo_operativo: cargo,
      },
      historial,
      integraciones,
    };
  });
}

async function obtenerHistorial(idPostulacion) {
  if (!(await modelo.existePostulacion(idPostulacion))) throw noEncontrada();
  return modelo.listarHistorial(idPostulacion);
}

const obtenerCatalogo = () => modelo.obtenerCatalogo();

module.exports = { cambiarEtapa, obtenerHistorial, obtenerCatalogo };

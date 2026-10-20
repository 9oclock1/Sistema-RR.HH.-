const modelo = require("../models/integracionModel");
const etapaModelo = require("../models/etapaPostulacionModel");
const clienteRest = require("./clienteRestErp");
const HttpError = require("../utils/HttpError");
const { integracion } = require("../config");
const { armarMensajesAlta } = require("../utils/integracion");

const LOTE = 10;
const SEGUNDOS_RESERVA = 60;

async function registrarAltaContratacion(
  client,
  { postulacion, cargo, usuario },
) {
  const alta = await modelo.obtenerDatosAlta(
    client,
    postulacion.id_postulacion,
  );
  const destinos = await modelo.listarDestinos(client);
  const mensajes = armarMensajesAlta({
    postulacion,
    alta,
    cargo,
    usuario,
    destinos,
  });

  const registrados = [];
  for (const mensaje of mensajes) {
    const evento = await modelo.registrar(client, {
      idMensaje: mensaje.idMensaje,
      idPostulacion: postulacion.id_postulacion,
      idDestino: mensaje.destino.id_destino,
      tipoEvento: mensaje.tipo,
      carga: mensaje.carga,
    });
    if (evento) {
      registrados.push({
        ...evento,
        codigo_destino: mensaje.destino.codigo,
        nombre_modulo: mensaje.destino.nombre_modulo,
      });
    }
  }
  return registrados;
}

async function entregar(evento, url) {
  const resultado = await clienteRest.enviar(evento, url);
  if (resultado.ok) {
    await modelo.marcarEntregado(evento);
    console.log(
      `[Integración] Alta ${evento.tipo_evento} entregada a ${evento.codigo_destino} (evento ${evento.id_evento})`,
    );
    return;
  }
  console.error(
    `[Integración] Falló el envío a ${evento.codigo_destino} (evento ${evento.id_evento}): ${resultado.error}`,
  );
  await modelo.marcarError(evento.id_evento, {
    error: resultado.error,
    esperaMs: integracion.esperaReintentoMs,
  });
}

// Envía por REST los eventos pendientes de los destinos con URL configurada; el resto queda pendiente.
async function despachar() {
  const urls = integracion.urlsDestino;
  const codigos = Object.keys(urls).filter((codigo) => urls[codigo]);
  if (codigos.length === 0) return 0;

  const eventos = await modelo.reservarPendientes(
    codigos,
    LOTE,
    SEGUNDOS_RESERVA,
  );
  await Promise.all(
    eventos.map((evento) => entregar(evento, urls[evento.codigo_destino])),
  );
  return eventos.length;
}

function iniciarDespachador() {
  let ocupado = false;
  setInterval(async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await despachar();
    } catch (error) {
      console.error("[Integración] Error al despachar eventos:", error.message);
    } finally {
      ocupado = false;
    }
  }, integracion.intervaloMs).unref();
}

// Estado del alta en cada módulo, para confirmar al reclutador que el colaborador quedó registrado.
async function listarDePostulacion(idPostulacion) {
  const eventos = await modelo.listarPorPostulacion(idPostulacion);
  if (
    eventos.length === 0 &&
    !(await etapaModelo.existePostulacion(idPostulacion))
  ) {
    throw new HttpError(404, "La postulación indicada no existe.");
  }
  return eventos;
}

module.exports = {
  registrarAltaContratacion,
  despachar,
  iniciarDespachador,
  listarDePostulacion,
};

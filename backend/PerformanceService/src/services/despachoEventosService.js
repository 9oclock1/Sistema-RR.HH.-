const modelo = require("../models/eventosSalientesModel");
const pubsub = require("../config/pubsub");
const jerarquia = require("./jerarquiaExterna");
const mensajesPublicados = require("../utils/mensajesPublicados");
const {
  MAXIMO_INTENTOS,
  topicoRrhh,
  tiempoPublicacionMs,
  cargosCrm,
  atributosDe,
  armarSolicitudMetricasCrm,
  seleccionarColaboradoresCrm,
  esperaReintento,
  errorDePublicacion,
} = require("../utils/mensajeria");

const LOTE = 10;
const SEGUNDOS_RESERVA = 60;

let avisoSinPubSub = false;

// Espera la publicación, pero no más de `tiempoPublicacionMs`; el temporizador se limpia para no dejar nada colgado.
async function conLimiteDeTiempo(promesa) {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error("Pub/Sub no respondió a tiempo")), tiempoPublicacionMs());
  });
  try {
    return await Promise.race([promesa, limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

// Un error permanente o el último intento dejan el evento FALLIDO; si no, se reintenta con espera creciente.
async function registrarFallo(evento, { mensaje, permanente }) {
  const intentos = evento.intentos + 1;
  const fallido = permanente || intentos >= MAXIMO_INTENTOS;
  console.error(
    `[eventos] Falló la solicitud de métricas al CRM (ciclo ${evento.id_ciclo}, intento ${intentos}): ${mensaje}` +
      (fallido ? " — queda FALLIDA hasta un reintento manual." : ""),
  );
  await modelo.marcarError(evento.id_evento, { error: mensaje, esperaMs: esperaReintento(intentos), fallido });
}

// Publica en el tópico único de RRHH. El evento queda ENTREGADO cuando Pub/Sub confirma que guardó el mensaje; desde ahí
// el CRM lo lee de su suscripción filtrando por `destino`. Si la base falla justo después de publicar, el reintento
// vuelve a publicar el mismo `id_mensaje` y el CRM lo descarta como duplicado.
async function publicar(cliente, evento, mensaje) {
  const topico = topicoRrhh();
  const atributos = atributosDe(mensaje);
  let idPubSub;
  try {
    idPubSub = await conLimiteDeTiempo(cliente.topic(topico).publishMessage({ json: mensaje, attributes: atributos }));
  } catch (error) {
    return registrarFallo(evento, errorDePublicacion(error, topico));
  }
  mensajesPublicados.registrar({ topico, idPubSub, atributos, cuerpo: mensaje });
  await modelo.marcarEntregado(evento.id_evento);
  console.log(
    `[eventos] Solicitud de métricas del ciclo ${evento.id_ciclo} publicada en ${topico} (mensaje ${idPubSub}, ` +
      `${mensaje.datos.colaboradores.length} colaborador(es)).`,
  );
}

// Arma el mensaje del evento y lo publica. `obtenerPersonal` consulta una sola vez a EmployeeService por vuelta.
async function procesarEvento(cliente, evento, obtenerPersonal) {
  try {
    const ciclo = await modelo.obtenerCicloConPeriodo(evento.id_ciclo);
    if (!ciclo) return await registrarFallo(evento, { mensaje: "El ciclo del evento ya no existe", permanente: true });

    const idsEvaluados = Array.isArray(evento.carga?.empleados) ? evento.carga.empleados : [];
    const [personal, cargos] = await obtenerPersonal();
    const colaboradores = seleccionarColaboradoresCrm(idsEvaluados, personal, cargos);

    if (colaboradores.length === 0) {
      await modelo.marcarOmitido(
        evento.id_evento,
        `Ningún evaluado del ciclo ocupa un cargo que mide el CRM (${cargosCrm().join(", ")}).`,
      );
      console.log(`[eventos] Ciclo ${evento.id_ciclo}: no hay cajeros ni asesores de atención; no se pide nada al CRM.`);
      return;
    }

    const mensaje = armarSolicitudMetricasCrm({
      idMensaje: evento.id_evento,
      fecha: new Date().toISOString(),
      ciclo,
      colaboradores,
    });
    await publicar(cliente, evento, mensaje);
  } catch (error) {
    await registrarFallo(evento, { mensaje: error.message, permanente: false });
  }
}

// Una vuelta del despachador: publica los eventos pendientes para el CRM. Devuelve cuántos tomó.
// Sin Pub/Sub configurado (credenciales o emulador) no toca nada: los eventos esperan en la base.
async function despachar() {
  const cliente = pubsub.obtenerCliente();
  if (!cliente) {
    if (!avisoSinPubSub) {
      avisoSinPubSub = true;
      console.warn(
        "[eventos] Pub/Sub no está configurado (GOOGLE_APPLICATION_CREDENTIALS o PUBSUB_EMULATOR_HOST): " +
          "las solicitudes de métricas al CRM quedan pendientes.",
      );
    }
    return 0;
  }

  const eventos = await modelo.reservarPendientes(LOTE, SEGUNDOS_RESERVA);
  let personal = null;
  const obtenerPersonal = () => (personal ??= Promise.all([jerarquia.listarColaboradores(), jerarquia.listarCargos()]));
  for (const evento of eventos) await procesarEvento(cliente, evento, obtenerPersonal);
  return eventos.length;
}

module.exports = { despachar };

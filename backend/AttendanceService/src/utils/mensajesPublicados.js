// Últimos mensajes que este servicio publicó en Pub/Sub, en memoria, para que el frontend los muestre en la consola
// del navegador (GET /mensajes-publicados). Se pierden al reiniciar el servicio; la fuente de verdad sigue en la base.
const SERVICIO = "AttendanceService";
const CAPACIDAD = 100;

const mensajes = [];
let secuencia = 0;

function registrar({ topico, idPubSub, atributos, cuerpo }) {
  secuencia += 1;
  mensajes.push({
    secuencia,
    servicio: SERVICIO,
    publicado_en: new Date().toISOString(),
    topico,
    id_pubsub: idPubSub,
    atributos,
    mensaje: cuerpo,
  });
  if (mensajes.length > CAPACIDAD) mensajes.shift();
}

// Los publicados después de `desde`; `ultimo` permite al cliente detectar que el servicio se reinició.
function listarDesde(desde = 0) {
  return { ultimo: secuencia, mensajes: mensajes.filter((m) => m.secuencia > desde) };
}

module.exports = { registrar, listarDesde };

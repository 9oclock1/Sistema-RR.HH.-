const { PubSub } = require("@google-cloud/pubsub");

// Con PUBSUB_EMULATOR_HOST usa el emulador local; si no, la cuenta de servicio de GOOGLE_APPLICATION_CREDENTIALS.
// Sin ninguna de las dos, los eventos quedan pendientes en la base.
const configurado = () => Boolean(process.env.PUBSUB_EMULATOR_HOST || process.env.GOOGLE_APPLICATION_CREDENTIALS);

let cliente = null;

function obtenerCliente() {
  if (!configurado()) return null;
  cliente ??= new PubSub(process.env.PUBSUB_PROJECT_ID ? { projectId: process.env.PUBSUB_PROJECT_ID } : {});
  return cliente;
}

module.exports = { obtenerCliente };

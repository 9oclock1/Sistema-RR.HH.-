const { despachar } = require("../services/despachoEventosService");

const INTERVALO_POR_DEFECTO_MS = 15000;

// Publica en Pub/Sub los eventos salientes pendientes (hoy, la solicitud de métricas al CRM al cerrar un ciclo).
// El cierre solo guarda el evento en la base; este proceso lo publica poco después, así el cierre no depende de Pub/Sub.
// DESPACHO_EVENTOS_ACTIVO=false lo desactiva, por ejemplo en entornos de prueba.
function iniciarDespachoEventos() {
  if (process.env.DESPACHO_EVENTOS_ACTIVO === "false") return null;

  const intervalo = Number(process.env.DESPACHO_EVENTOS_INTERVALO_MS) || INTERVALO_POR_DEFECTO_MS;
  let ocupado = false;

  async function vuelta() {
    if (ocupado) return;
    ocupado = true;
    try {
      await despachar();
    } catch (error) {
      console.error("[eventos] Error al despachar los eventos salientes:", error.message);
    } finally {
      ocupado = false;
    }
  }

  const tarea = setInterval(vuelta, intervalo);
  tarea.unref();
  console.log(`[eventos] Despacho de eventos salientes cada ${intervalo / 1000} s.`);
  vuelta();
  return tarea;
}

module.exports = { iniciarDespachoEventos };

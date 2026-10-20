const { integracion } = require("../config");

async function enviar(evento, url) {
  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Mensaje-Id": evento.id_mensaje,
        "X-Origen": evento.carga.encabezado.origen.grupo,
        "X-Tipo-Evento": evento.tipo_evento,
      },
      body: JSON.stringify(evento.carga),
      signal: AbortSignal.timeout(integracion.tiempoEsperaMs),
    });
    if (respuesta.ok) return { ok: true, estado: respuesta.status };
    return {
      ok: false,
      estado: respuesta.status,
      error: `El destino respondió ${respuesta.status}`,
    };
  } catch (error) {
    if (error.name === "TimeoutError")
      return { ok: false, error: "El destino no respondió a tiempo" };
    return {
      ok: false,
      error: `No se pudo conectar con el destino: ${error.cause?.code || error.message}`,
    };
  }
}

module.exports = { enviar };

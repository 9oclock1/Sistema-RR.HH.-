// La campana del encabezado y la vista completa de notificaciones comparten el estado de lectura en el servidor.
// Cuando una cambia algo, avisa a la otra para que actualice su contador sin esperar a la consulta periódica.
const EVENTO = "rrhh:notificaciones-cambiaron";

export const avisarCambioNotificaciones = () => window.dispatchEvent(new Event(EVENTO));

// Devuelve la función que cancela la suscripción.
export function alCambiarNotificaciones(alternar) {
  window.addEventListener(EVENTO, alternar);
  return () => window.removeEventListener(EVENTO, alternar);
}

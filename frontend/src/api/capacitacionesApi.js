import { request } from './httpClient';

const conRol = (rol) => ({ 'X-Rol': rol });

export const getCursosCapacitacion = ({ rol, signal } = {}) =>
  request('/empl/cursos-capacitacion', { signal, headers: conRol(rol) });

export const getOrdenesServicioEmitidas = (idCurso, { rol, signal } = {}) =>
  request(`/empl/solicitudes-servicio?id_curso=${encodeURIComponent(idCurso)}&estado=ORDEN_EMITIDA`, {
    signal,
    headers: conRol(rol),
  });

// KAN-60: registra la solicitud y la publica a Compras por Pub/Sub. Si la publicación falla, queda PENDIENTE_ENVIO y se reintenta.
export const solicitarCompraCapacitacion = (idCurso, datos, { rol } = {}) =>
  request(`/empl/cursos-capacitacion/${encodeURIComponent(idCurso)}/solicitar-compra`, {
    method: 'POST',
    body: datos,
    headers: conRol(rol),
  });

export const createCapacitacion =(datos, { rol } = {}) =>
  request('/empl/capacitaciones', { method: 'POST', body: datos, headers: conRol(rol) });

import { request } from './httpClient';

const conRol = (rol) => ({ 'X-Rol': rol });

export const getCursosCapacitacion = ({ rol, signal } = {}) =>
  request('/empl/cursos-capacitacion', { signal, headers: conRol(rol) });

export const getOrdenesServicioEmitidas = (idCurso, { rol, signal } = {}) =>
  request(`/empl/solicitudes-servicio?id_curso=${encodeURIComponent(idCurso)}&estado=ORDEN_EMITIDA`, {
    signal,
    headers: conRol(rol),
  });

export const createCapacitacion = (datos, { rol } = {}) =>
  request('/empl/capacitaciones', { method: 'POST', body: datos, headers: conRol(rol) });

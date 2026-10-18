import { request, requestArchivo } from './httpClient';

export const getKardexEmpleado = (idEmpleado, { rol, signal } = {}) =>
  request(`/empl/empleados/${idEmpleado}/kardex`, { signal, headers: { 'X-Rol': rol } });

export const descargarCertificadoCapacitacion = (idCapacitacion, { rol } = {}) =>
  requestArchivo(`/empl/capacitaciones/${idCapacitacion}/certificado`, { headers: { 'X-Rol': rol } });

import { request } from './httpClient';

export const getKardexEmpleado = (idEmpleado, { rol, signal } = {}) =>
  request(`/empl/empleados/${idEmpleado}/kardex`, { signal, headers: { 'X-Rol': rol } });

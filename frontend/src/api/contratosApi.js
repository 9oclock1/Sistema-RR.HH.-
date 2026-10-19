import { request } from './httpClient';

const conRol = (rol) => ({ 'X-Rol': rol });

export const getCatalogosContrato = ({ rol, signal } = {}) =>
  request('/empl/contratos/catalogos', { signal, headers: conRol(rol) });

export const getHistorialContratos = (idEmpleado, { rol, signal } = {}) =>
  request(`/empl/contratos?id_empleado=${encodeURIComponent(idEmpleado)}`, { signal, headers: conRol(rol) });

export const createModificacionContrato = (datos, { rol } = {}) =>
  request('/empl/contratos/modificaciones', { method: 'POST', body: datos, headers: conRol(rol) });

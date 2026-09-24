import { request } from './httpClient';

export const getDepartamentosActivos = ({ signal } = {}) =>
  request('/empl/departamentos?activos=true', { signal });

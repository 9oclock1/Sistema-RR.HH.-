import { request } from './httpClient';

const BASE = '/empl/sucursales';

export const getSucursales = ({ signal } = {}) => request(BASE, { signal });

import { request } from './httpClient';

const BASE = '/empl/empleados';

export const getEmpleados = ({ signal } = {}) => request(BASE, { signal });
export const getFichaEmpleado = (idEmpleado, { signal } = {}) => request(`${BASE}/${idEmpleado}/ficha`, { signal });

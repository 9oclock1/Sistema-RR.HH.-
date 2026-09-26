import { request } from './httpClient';

const BASE = '/empl/asignaciones';
export const createAsignacion = (asignacion) => request(BASE, { method: 'POST', body: asignacion });

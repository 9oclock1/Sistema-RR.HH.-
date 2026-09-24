import { request } from './httpClient';

export const getNivelesSalariales = ({ signal } = {}) => request('/empl/niveles-salariales', { signal });

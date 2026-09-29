import { request } from './httpClient';

const BASE = '/empl/organigrama';

// El API_URL se calcula igual que en httpClient.js: no se puede importar de
// ahí (es privado del módulo), así que se replica la misma regla acá nomás
// para armar el link de descarga.
const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const organigramaApi = {
  obtenerArbol: ({ signal } = {}) => request(BASE, { signal }),

  urlExportar: () => `${API_URL}${BASE}/exportar`,
};

export default organigramaApi;
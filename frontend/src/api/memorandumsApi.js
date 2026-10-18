import { request, urlApi } from './httpClient';

const BASE = '/empl/memorandums';

// `datos` es un FormData: el memorándum viaja como multipart por la evidencia adjunta.
export const createMemorandum = (datos) => request(BASE, { method: 'POST', body: datos });

// clasificacion: 'AMONESTACION' | 'RECONOCIMIENTO'; sin ella devuelve todo el catálogo.
export const getTiposMemorandum = (clasificacion, { signal } = {}) =>
  request(`${BASE}/tipos${clasificacion ? `?clasificacion=${encodeURIComponent(clasificacion)}` : ''}`, { signal });

// Enlace de descarga del PDF oficial (el servidor lo entrega como adjunto).
export const urlPdfMemorandum = (idMemorandum) => urlApi(`${BASE}/${idMemorandum}/pdf`);

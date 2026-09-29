import { request } from './httpClient';

const BASE = '/recr/convocatorias';

export const getConvocatorias = (estado, { signal } = {}) => {
  const query = estado ? `?${new URLSearchParams({ estado })}` : '';
  return request(`${BASE}${query}`, { signal });
};

export const getNivelesEducacion = ({ signal } = {}) => request(`${BASE}/niveles-educacion`, { signal });

// Perfil que se precargaría desde el catálogo de cargos (RF-08.2), sin crear nada.
export const getPerfilCargo = (idCargo, { signal } = {}) => request(`${BASE}/perfil-cargo/${idCargo}`, { signal });

// Toda convocatoria nace como borrador.
export const createConvocatoria = (convocatoria) => request(BASE, { method: 'POST', body: convocatoria });

// Solo se puede editar mientras es borrador.
export const updateConvocatoria = (idConvocatoria, cambios) =>
  request(`${BASE}/${idConvocatoria}`, { method: 'PATCH', body: cambios });

export const publicarConvocatoria = (idConvocatoria) => request(`${BASE}/${idConvocatoria}/publicar`, { method: 'POST' });

export const cerrarConvocatoria = (idConvocatoria) => request(`${BASE}/${idConvocatoria}/cerrar`, { method: 'POST' });

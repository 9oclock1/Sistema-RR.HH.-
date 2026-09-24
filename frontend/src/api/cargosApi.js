import { request } from './httpClient';

const BASE = '/empl/cargos';

export const getCargos = (areaId, { signal } = {}) => {
  const query = areaId ? `?${new URLSearchParams({ area_id: areaId })}` : '';
  return request(`${BASE}${query}`, { signal });
};

export const createCargo = (cargo) => request(BASE, { method: 'POST', body: cargo });

// PUT reemplaza el cargo completo: `cargo` debe traer todos los campos editables.
export const updateCargo = (idCargo, cargo) => request(`${BASE}/${idCargo}`, { method: 'PUT', body: cargo });

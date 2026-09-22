const API_PREFIX = import.meta.env.VITE_API_URL || '/api';
const BASE_URL = `${API_PREFIX}/empl/cargos`;

export const getCargos = async (areaId) => {
  const url = areaId ? `${BASE_URL}?area_id=${areaId}` : BASE_URL;
  const res = await fetch(url);
  
  if (!res.ok) {
    throw new Error('Error al obtener la lista de cargos');
  }
  
  return await res.json();
};

export const createCargo = async (payload) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Error al guardar el cargo');
  }
  
  return await res.json();
};
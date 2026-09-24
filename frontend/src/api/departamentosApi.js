import { request } from './httpClient';

const BASE = '/empl/departamentos';

// GET devuelve un arreglo de áreas activas: [{ id_departamento, codigo, nombre, tipo, id_departamento_padre, id_sucursal }]
const departamentosApi = {
  listarActivas: ({ signal } = {}) => request(BASE, { signal }),

  crear: (datos) => request(BASE, { method: 'POST', body: datos }),

  // Solo modifica nombre y/o descripción; el id_departamento se conserva.
  actualizar: (id, cambios) => request(`${BASE}/${id}`, { method: 'PUT', body: cambios }),

  // Responde 409 con el motivo si el área tiene cargos o empleados activos.
  darDeBaja: (id) => request(`${BASE}/${id}/baja`, { method: 'PATCH' }),
};

export default departamentosApi;

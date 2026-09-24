import { request } from './httpClient';

const BASE = '/empl/departamentos';

// Quien muestre áreas (listado de Organización, selectores de Cargos, nombres de área en la tabla de cargos)
// se suscribe aquí y vuelve a pedir datos cuando un POST/PUT/PATCH termina bien, sin recargar el navegador.
const suscriptores = new Set();

const notificarCambio = (respuesta) => {
  suscriptores.forEach((alCambiar) => alCambiar());
  return respuesta;
};

// GET devuelve un arreglo de áreas activas: [{ id_departamento, codigo, nombre, tipo, id_departamento_padre, id_sucursal, descripcion }]
const departamentosApi = {
  listarActivas: ({ signal } = {}) => request(BASE, { signal }),

  crear: (datos) => request(BASE, { method: 'POST', body: datos }).then(notificarCambio),

  // Solo modifica nombre y/o descripción; el id_departamento se conserva.
  actualizar: (id, cambios) => request(`${BASE}/${id}`, { method: 'PUT', body: cambios }).then(notificarCambio),

  // Responde 409 con el motivo si el área tiene cargos o empleados activos.
  darDeBaja: (id) => request(`${BASE}/${id}/baja`, { method: 'PATCH' }).then(notificarCambio),

  // Devuelve la función para cancelar la suscripción (sirve directo como cleanup de useEffect).
  suscribirCambios: (alCambiar) => {
    suscriptores.add(alCambiar);
    return () => {
      suscriptores.delete(alCambiar);
    };
  },
};

export default departamentosApi;

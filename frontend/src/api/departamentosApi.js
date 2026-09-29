import { request } from './httpClient';

const BASE = '/empl/departamentos';
const suscriptores = new Set();

const notificarCambio = (respuesta) => {
  suscriptores.forEach((alCambiar) => alCambiar());
  return respuesta;
};
const departamentosApi = {
  listarActivas: ({ signal } = {}) => request(BASE, { signal }),

  crear: (datos) => request(BASE, { method: 'POST', body: datos }).then(notificarCambio),

  actualizar: (id, datos) => request(`${BASE}/${id}`, { method: 'PUT', body: datos }).then(notificarCambio),

  darDeBaja: (id) => request(`${BASE}/${id}/baja`, { method: 'PATCH' }).then(notificarCambio),

  suscribirCambios: (alCambiar) => {
    suscriptores.add(alCambiar);
    return () => {
      suscriptores.delete(alCambiar);
    };
  },
};

export default departamentosApi;

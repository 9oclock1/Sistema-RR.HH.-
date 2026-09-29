import { request } from './httpClient';

const BASE = '/empl/jerarquia';

const jerarquiaApi = {
  listarCargos: ({ signal } = {}) => request(`${BASE}/cargos`, { signal }),

  listarSubordinados: (idCargo, { signal } = {}) =>
    request(`${BASE}/cargos/${idCargo}/subordinados`, { signal }),

  listarHistorial: (idCargo, { signal } = {}) =>
    request(`${BASE}/cargos/${idCargo}/historial`, { signal }),

  // idSuperior null quita el superior actual
  asignarSuperior: (idCargo, idSuperior) =>
    request(`${BASE}/cargos/${idCargo}/superior`, {
      method: 'PUT',
      body: { id_cargo_superior: idSuperior },
    }),
};

export default jerarquiaApi;
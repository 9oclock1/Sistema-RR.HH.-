// src/api/jerarquiaApi.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost/api/empl';

export default {
  listarCargos() {
    return axios.get(`${API_URL}/jerarquia/cargos`);
  },
  listarSubordinados(idCargo) {
    return axios.get(`${API_URL}/jerarquia/cargos/${idCargo}/subordinados`);
  },
  listarHistorial(idCargo) {
    return axios.get(`${API_URL}/jerarquia/cargos/${idCargo}/historial`);
  },
  // idSuperior null quita el superior actual
  asignarSuperior(idCargo, idSuperior) {
    return axios.put(`${API_URL}/jerarquia/cargos/${idCargo}/superior`, {
      id_cargo_superior: idSuperior,
    });
  },
};
// src/api/organigramaApi.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost/api/empl';

export default {
  obtenerArbol() {
    return axios.get(`${API_URL}/organigrama`);
  },
  urlExportar() {
    // Se usa directo como href de descarga, no como llamada axios
    return `${API_URL}/organigrama/exportar`;
  },
};
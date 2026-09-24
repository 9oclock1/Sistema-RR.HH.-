// services/departamentosApi.js
import axios from 'axios';

// Con el API Gateway (NGINX), ya no se usan puertos: cada servicio
// tiene su ruta fija bajo http://localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost/api/empl';

const departamentosApi = {
  listarActivas() {
    return axios.get(`${API_URL}/departamentos`);
  },
  crear(datos) {
    return axios.post(`${API_URL}/departamentos`, datos);
  },
  actualizar(id, cambios) {
    return axios.put(`${API_URL}/departamentos/${id}`, cambios);
  },
  darDeBaja(id) {
    return axios.patch(`${API_URL}/departamentos/${id}/baja`);
  },
};

export default departamentosApi;
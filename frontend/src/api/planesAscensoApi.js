import { request } from './httpClient';

// KAN-83: seguimiento del plan de capacitación previo al ascenso (EmployeeService).
const BASE = '/empl/planes-ascenso';

const conRol = (rol) => ({ 'X-Rol': rol });
const conIdentidad = (rol, idEmpleado) => ({ ...conRol(rol), ...(idEmpleado && { 'X-Empleado-Id': idEmpleado }) });

export const getPlanesAscenso = ({ estado = 'EN_CURSO', rol, signal } = {}) =>
  request(`${BASE}?${new URLSearchParams({ estado })}`, { signal, headers: conRol(rol) });

export const getPlanAscenso = (idPlan, { rol, signal } = {}) =>
  request(`${BASE}/${encodeURIComponent(idPlan)}`, { signal, headers: conRol(rol) });

export const asignarPlanAscenso = (datos, { rol, idEmpleado } = {}) =>
  request(BASE, { method: 'POST', body: datos, headers: conIdentidad(rol, idEmpleado) });

// Con cursos pendientes y sin confirmar_pendientes responde 409 CURSOS_PENDIENTES con la advertencia.
export const formalizarAscenso = (idPlan, datos, { rol, idEmpleado } = {}) =>
  request(`${BASE}/${encodeURIComponent(idPlan)}/formalizacion`, {
    method: 'POST',
    body: datos,
    headers: conIdentidad(rol, idEmpleado),
  });

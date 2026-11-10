import { solicitar } from "./cliente";

const RUTA = "/comp/bonificaciones";

// Temporal hasta contar con autenticación: solo el Administrador de RRHH o el Auditor ven estos datos (RF-53).
const cabeceras = ({ idEmpleado, rol } = {}) => ({
  ...(idEmpleado && { "X-Empleado-Id": idEmpleado }),
  "X-Rol": rol,
});

// RF-53: historial de bonos de un colaborador a través de todos los periodos ya procesados.
export const listarHistorialBonos = (idEmpleado, filtros = {}, identidad) => {
  const params = new URLSearchParams(filtros);
  const query = params.toString();
  return solicitar(`${RUTA}/empleados/${idEmpleado}${query ? `?${query}` : ""}`, { cabeceras: cabeceras(identidad) });
};

// CSV por fetch (no por <a href>): así viajan las cabeceras X-Rol/X-Empleado-Id que exige el backend (RBAC).
export const exportarHistorialBonos = (idEmpleado, filtros = {}, identidad) => {
  const params = new URLSearchParams({ ...filtros, formato: "csv" });
  return solicitar(`${RUTA}/empleados/${idEmpleado}?${params.toString()}`, {
    cabeceras: cabeceras(identidad),
    respuestaBinaria: true,
  });
};

// Auditoría de altas, modificaciones y anulaciones (Auditor/Administrador).
export const listarAuditoriaBonos = (filtros = {}, identidad) => {
  const params = new URLSearchParams(filtros);
  const query = params.toString();
  return solicitar(`${RUTA}/auditoria${query ? `?${query}` : ""}`, { cabeceras: cabeceras(identidad) });
};

export const exportarAuditoriaBonos = (filtros = {}, identidad) => {
  const params = new URLSearchParams({ ...filtros, formato: "csv" });
  return solicitar(`${RUTA}/auditoria?${params.toString()}`, { cabeceras: cabeceras(identidad), respuestaBinaria: true });
};

// RF-53, criterio 3: bonos de todos los colaboradores de una sucursal, no solo de uno.
export const listarHistorialPorSucursal = (sucursal, filtros = {}, identidad) => {
  const params = new URLSearchParams(filtros);
  const query = params.toString();
  return solicitar(`${RUTA}/sucursales/${encodeURIComponent(sucursal)}${query ? `?${query}` : ""}`, {
    cabeceras: cabeceras(identidad),
  });
};

export const exportarHistorialPorSucursal = (sucursal, filtros = {}, identidad) => {
  const params = new URLSearchParams({ ...filtros, formato: "csv" });
  return solicitar(`${RUTA}/sucursales/${encodeURIComponent(sucursal)}?${params.toString()}`, {
    cabeceras: cabeceras(identidad),
    respuestaBinaria: true,
  });
};

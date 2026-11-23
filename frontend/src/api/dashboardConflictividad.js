import { solicitar } from "./cliente";

const RUTA = "/perf/dashboards/conflictividad";

// Quién consulta: RRHH ve toda la empresa; el supervisor, solo su sucursal (temporal hasta contar con sesión).
const cabeceras = ({ idEmpleado, rol }) => ({
  ...(idEmpleado && { "X-Empleado-Id": idEmpleado }),
  "X-Rol": rol,
});

const parametros = (filtros) => {
  const p = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) if (valor) p.set(clave, valor);
  return p.toString();
};

// RF-72/RF-73 (KAN-506): KPI-03 (índice de quejas por 100 empleados) y KPI-06 (minutos de atraso promedio),
// con semáforo y comparativo por área y sucursal.
// filtros: { desde, hasta, id_sucursal, id_departamento }.
export const obtenerDashboardConflictividad = (filtros, identidad) =>
  solicitar(`${RUTA}?${parametros(filtros)}`, { cabeceras: cabeceras(identidad) });

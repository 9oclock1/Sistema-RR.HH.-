import { solicitar } from "./cliente";

const RUTA = "/att/dashboards/asistencia";

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

// RF-73 (KAN-93): KPI-04 (ausentismo) y KPI-05 (puntualidad) con semáforo, comparativo por sucursal y,
// filtrando una sola sucursal, el detalle diario de faltas y atrasos.
// filtros: { id_sucursal, id_departamento, desde, hasta }.
export const obtenerDashboardAsistencia = (filtros, identidad) =>
  solicitar(`${RUTA}?${parametros(filtros)}`, { cabeceras: cabeceras(identidad) });

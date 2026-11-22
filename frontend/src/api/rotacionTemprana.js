import { solicitar } from "./cliente";

// KPI-12 (épica 13): rotación temprana del periodo, calculada por EmployeeService con las altas y bajas registradas.
export const obtenerRotacionTemprana = (rol, { desde, hasta, departamento, sucursal }) => {
  const parametros = new URLSearchParams({ desde, hasta });
  if (departamento) parametros.set("departamento", departamento);
  if (sucursal) parametros.set("sucursal", sucursal);
  return solicitar(`/empl/empleados/indicadores/rotacion-temprana?${parametros}`, { cabeceras: { "X-Rol": rol } });
};

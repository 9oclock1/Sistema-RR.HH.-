import { solicitar } from "./cliente";

const RUTA = "/perf/desempeno";

export const obtenerDashboardDesempeno = (rol, { ciclo, departamento, sucursal } = {}) => {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries({ ciclo, departamento, sucursal })) {
    if (valor) parametros.set(clave, valor);
  }
  const consulta = parametros.toString();
  return solicitar(`${RUTA}/dashboard${consulta ? `?${consulta}` : ""}`, { cabeceras: { "X-Rol": rol } });
};

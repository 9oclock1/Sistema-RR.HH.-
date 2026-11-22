import { solicitar } from "./cliente";

const RUTA = "/perf/quejas/dashboard";

function consultaDe({ desde, hasta, categoria, sucursal } = {}) {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries({ desde, hasta, categoria, sucursal })) {
    if (valor) parametros.set(clave, valor);
  }
  const consulta = parametros.toString();
  return consulta ? `?${consulta}` : "";
}

export const obtenerDashboardQuejas = (rol, filtros) =>
  solicitar(`${RUTA}${consultaDe(filtros)}`, { cabeceras: { "X-Rol": rol } });

export const exportarDashboardQuejas = (rol, filtros) =>
  solicitar(`${RUTA}/exportacion${consultaDe(filtros)}`, { cabeceras: { "X-Rol": rol }, respuestaBinaria: true });

import { solicitar } from "./cliente";

const RUTA = "/perf/quejas/historial";

const conRol = ({ rol }) => ({ "X-Rol": rol });

function consultaDe(filtros = {}) {
  const parametros = new URLSearchParams();
  Object.entries(filtros).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") parametros.set(clave, valor);
  });
  const consulta = parametros.toString();
  return consulta ? `?${consulta}` : "";
}

export const listarCatalogosHistorial = (sesion) => solicitar(`${RUTA}/catalogos`, { cabeceras: conRol(sesion) });

export const listarHistorialQuejas = (sesion, { desde, hasta, categoria, sucursal, pagina, limite } = {}) =>
  solicitar(`${RUTA}${consultaDe({ desde, hasta, categoria, sucursal, pagina, limite })}`, {
    cabeceras: conRol(sesion),
  });

export const obtenerHistorialQueja = (sesion, idQueja) => solicitar(`${RUTA}/${idQueja}`, { cabeceras: conRol(sesion) });

export const exportarHistorialQuejas = (sesion, { desde, hasta, categoria, sucursal } = {}) =>
  solicitar(`${RUTA}/exportacion${consultaDe({ desde, hasta, categoria, sucursal })}`, {
    cabeceras: conRol(sesion),
    respuestaBinaria: true,
  });

import { solicitar } from "./cliente";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";
const RUTA = "/att/horas-extra";
const comoEmpleado = (idEmpleado) => ({ "X-Empleado-Id": idEmpleado });

const parametros = ({ idSucursal, idDepartamento, desde, hasta, estado }) => {
  const p = new URLSearchParams();
  if (idSucursal) p.set("id_sucursal", idSucursal);
  if (idDepartamento) p.set("id_departamento", idDepartamento);
  if (desde) p.set("desde", desde);
  if (hasta) p.set("hasta", hasta);
  if (estado) p.set("estado", estado);
  return p;
};

// Desglose por jornada: { desde, hasta, resumen, jornadas }
export const listarHorasExtra = (filtros) => solicitar(`${RUTA}?${parametros(filtros)}`);

// Totales por empleado: { desde, hasta, empleados, totales }
export const resumenHorasExtra = (filtros) => solicitar(`${RUTA}/resumen?${parametros(filtros)}`);

// Descarga del resumen para planillas (CSV).
export const urlResumenCsv = (filtros) => {
  const p = parametros(filtros);
  p.set("formato", "csv");
  return `${BASE_URL}${RUTA}/resumen?${p}`;
};

export const listarPeriodos = () => solicitar(`${RUTA}/periodos`);

export const consolidarPeriodo = (idResponsable, { desde, hasta }) =>
  solicitar(`${RUTA}/periodos`, { metodo: "POST", cuerpo: { desde, hasta }, cabeceras: comoEmpleado(idResponsable) });

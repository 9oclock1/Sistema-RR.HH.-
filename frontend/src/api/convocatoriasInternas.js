import { request } from "./httpClient";

const BASE = "/empl/convocatorias";

const comoRrhh = ({ rol, idEmpleado }) => ({ "X-Rol": rol, ...(idEmpleado && { "X-Empleado-Id": idEmpleado }) });

const comoEmpleado = ({ rol, idEmpleado }) => ({ ...(rol && { "X-Rol": rol }), "X-Empleado-Id": idEmpleado });

const consultaDe = (estado) => (estado ? `?estado=${encodeURIComponent(estado)}` : "");

export const listarConvocatoriasRrhh = (sesion, estado) =>
  request(`${BASE}/gestion${consultaDe(estado)}`, { headers: comoRrhh(sesion) });

export const publicarConvocatoria = (sesion, datos) =>
  request(BASE, { method: "POST", body: datos, headers: comoRrhh(sesion) });

export const reintentarNotificacionConvocatoria = (sesion, idConvocatoria) =>
  request(`${BASE}/${idConvocatoria}/notificacion`, { method: "POST", headers: comoRrhh(sesion) });

export const listarConvocatoriasEmpleado = (sesion, estado) =>
  request(`${BASE}${consultaDe(estado)}`, { headers: comoEmpleado(sesion) });

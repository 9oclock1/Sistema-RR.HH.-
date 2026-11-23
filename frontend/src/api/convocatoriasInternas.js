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

// KAN-81: postulación del empleado (se valida al registrarla) y revisión de RRHH con el ranking de méritos.
export const postularConvocatoria = (sesion, idConvocatoria) =>
  request(`${BASE}/${idConvocatoria}/postulaciones`, { method: "POST", headers: comoEmpleado(sesion) });

export const listarPostulaciones = (sesion, idConvocatoria) =>
  request(`${BASE}/${idConvocatoria}/postulaciones`, { headers: comoRrhh(sesion) });

export const revalidarPostulacion = (sesion, idConvocatoria, idPostulacion) =>
  request(`${BASE}/${idConvocatoria}/postulaciones/${idPostulacion}/validacion`, { method: "POST", headers: comoRrhh(sesion) });

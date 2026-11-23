import { request } from "./httpClient";

const BASE = "/empl/convocatorias";

const comoRrhh = ({ rol, idEmpleado }) => ({ "X-Rol": rol, ...(idEmpleado && { "X-Empleado-Id": idEmpleado }) });

const comoEmpleado = ({ rol, idEmpleado }) => ({ ...(rol && { "X-Rol": rol }), "X-Empleado-Id": idEmpleado });

const consultaDe = (estado) => (estado ? `?estado=${encodeURIComponent(estado)}` : "");

export const listarConvocatoriasRrhh = (estado) => request(`${BASE}/gestion${consultaDe(estado)}`);

export const publicarConvocatoria = (datos) => request(BASE, { method: "POST", body: datos });

export const reintentarNotificacionConvocatoria = (idConvocatoria) =>
  request(`${BASE}/${idConvocatoria}/notificacion`, { method: "POST" });

export const listarConvocatoriasEmpleado = (estado) => request(`${BASE}${consultaDe(estado)}`);

// KAN-81: postulación del empleado (se valida al registrarla) y revisión de RRHH con el ranking de méritos.
export const postularConvocatoria = (sesion, idConvocatoria) =>
  request(`${BASE}/${idConvocatoria}/postulaciones`, { method: "POST", headers: comoEmpleado(sesion) });

export const listarPostulaciones = (sesion, idConvocatoria) =>
  request(`${BASE}/${idConvocatoria}/postulaciones`, { headers: comoRrhh(sesion) });

export const revalidarPostulacion = (sesion, idConvocatoria, idPostulacion) =>
  request(`${BASE}/${idConvocatoria}/postulaciones/${idPostulacion}/validacion`, { method: "POST", headers: comoRrhh(sesion) });

// KAN-84: formalización del ascenso del postulante apto seleccionado (con la sesión del Administrador).
export const formalizarAscenso = (idConvocatoria, idPostulacion, datos) =>
  request(`${BASE}/${idConvocatoria}/postulaciones/${idPostulacion}/formalizacion`, { method: "POST", body: datos });

export const reintentarAvisoAscenso = (idConvocatoria, idPostulacion) =>
  request(`${BASE}/${idConvocatoria}/postulaciones/${idPostulacion}/formalizacion/notificacion`, { method: "POST" });

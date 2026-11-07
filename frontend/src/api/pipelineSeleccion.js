import { request } from "./httpClient";

const BASE = "/recr";

// RF-14: quién hace el cambio queda en el historial. Temporal: X-Rol y X-Usuario-* hasta contar con inicio de sesión.
// Las cabeceras solo admiten ASCII, así que el nombre va codificado.
const comoReclutador = ({ rol, idUsuario, nombreUsuario }) => ({
  "X-Rol": rol,
  ...(idUsuario && { "X-Usuario-Id": idUsuario }),
  ...(nombreUsuario && { "X-Usuario-Nombre": encodeURIComponent(nombreUsuario) }),
});

// Etapas activas, cambios permitidos entre ellas y cargos operativos.
export const obtenerCatalogoPipeline = async ({ signal } = {}) =>
  (await request(`${BASE}/etapas-postulacion`, { signal })).data;

export const obtenerPipeline = async (idConvocatoria, { signal } = {}) =>
  (await request(`${BASE}/convocatorias/${idConvocatoria}/pipeline`, { signal })).data;

// cuerpo: { id_etapa, motivo?, id_cargo_operativo? }. Devuelve { message, data }.
export const cambiarEtapaPostulacion = (idPostulacion, cuerpo, sesion) =>
  request(`${BASE}/postulaciones/${idPostulacion}/etapa`, {
    method: "PATCH",
    body: cuerpo,
    headers: comoReclutador(sesion),
  });

export const obtenerHistorialEtapas = async (idPostulacion, { signal } = {}) =>
  (await request(`${BASE}/postulaciones/${idPostulacion}/historial-etapas`, { signal })).data;

export const obtenerIntegraciones = async (idPostulacion, { signal } = {}) =>
  (await request(`${BASE}/postulaciones/${idPostulacion}/integraciones`, { signal })).data;

export const reintentarIntegracion = (idEvento, sesion) =>
  request(`${BASE}/integraciones/${idEvento}/reintentar`, { method: "POST", headers: comoReclutador(sesion) });

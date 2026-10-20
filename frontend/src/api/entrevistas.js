import { request } from "./httpClient";

const BASE = "/recr";

// RF-15: igual que en el pipeline, quien agenda queda registrado por las cabeceras X-Rol y X-Usuario-*.
const comoReclutador = ({ rol, idUsuario, nombreUsuario }) => ({
  "X-Rol": rol,
  ...(idUsuario && { "X-Usuario-Id": idUsuario }),
  ...(nombreUsuario && { "X-Usuario-Nombre": encodeURIComponent(nombreUsuario) }),
});

export const obtenerEntrevistasPostulacion = async (idPostulacion, { signal } = {}) =>
  (await request(`${BASE}/postulaciones/${idPostulacion}/entrevistas`, { signal })).data;

// filtros: { desde, hasta, idEntrevistador?, incluirCanceladas? }. desde y hasta en 'AAAA-MM-DDTHH:mm' (hora de La Paz).
export const obtenerAgendaEntrevistas = async ({ desde, hasta, idEntrevistador, incluirCanceladas } = {}, { signal } = {}) => {
  const parametros = new URLSearchParams();
  if (desde) parametros.set("desde", desde);
  if (hasta) parametros.set("hasta", hasta);
  if (idEntrevistador) parametros.set("id_entrevistador_empleado", idEntrevistador);
  if (incluirCanceladas) parametros.set("incluir_canceladas", "true");
  return (await request(`${BASE}/entrevistas?${parametros}`, { signal })).data;
};

// cuerpo: { fecha_hora_programada, duracion_minutos, modalidad, lugar_enlace, id_entrevistador_empleado, confirmar_solapamiento? }.
export const agendarEntrevista = (idPostulacion, cuerpo, sesion) =>
  request(`${BASE}/postulaciones/${idPostulacion}/entrevistas`, {
    method: "POST",
    body: cuerpo,
    headers: comoReclutador(sesion),
  });

// cuerpo: los mismos campos que al agendar (solo los que cambian) y un motivo opcional.
export const reprogramarEntrevista = (idEntrevista, cuerpo, sesion) =>
  request(`${BASE}/entrevistas/${idEntrevista}/reprogramar`, {
    method: "PATCH",
    body: cuerpo,
    headers: comoReclutador(sesion),
  });

export const cancelarEntrevista = (idEntrevista, motivo, sesion) =>
  request(`${BASE}/entrevistas/${idEntrevista}/cancelar`, {
    method: "PATCH",
    body: { motivo },
    headers: comoReclutador(sesion),
  });

export const reintentarAvisoEntrevista = (idNotificacion, sesion) =>
  request(`${BASE}/notificaciones-entrevista/${idNotificacion}/reintentar`, {
    method: "POST",
    headers: comoReclutador(sesion),
  });

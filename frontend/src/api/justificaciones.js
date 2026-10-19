import { solicitar } from "./cliente";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";
const comoEmpleado = (idEmpleado) => ({ "X-Empleado-Id": idEmpleado });

export const listarMotivos = () => solicitar("/att/justificaciones/motivos");

// { desde, hasta, horas_plazo, generado_en, novedades: [{ ..., plazo, solicitud }] }
export const consultarMisNovedades = (idEmpleado) => solicitar("/att/mis-novedades", { cabeceras: comoEmpleado(idEmpleado) });

// datos: { idNovedad, idMotivo, descripcion, archivos: File[] }
export function enviarJustificacion(idEmpleado, { idNovedad, idMotivo, descripcion, archivos }) {
  const formulario = new FormData();
  formulario.append("id_novedad", idNovedad);
  formulario.append("id_motivo", idMotivo);
  if (descripcion) formulario.append("descripcion", descripcion);
  for (const archivo of archivos) formulario.append("archivos", archivo);
  return solicitar("/att/justificaciones", { metodo: "POST", cuerpo: formulario, cabeceras: comoEmpleado(idEmpleado) });
}

// { resumen: { pendientes, aprobadas, rechazadas }, solicitudes }
export const listarJustificaciones = ({ idSucursal, idDepartamento, estado }) => {
  const parametros = new URLSearchParams({ id_sucursal: idSucursal, estado });
  if (idDepartamento) parametros.set("id_departamento", idDepartamento);
  return solicitar(`/att/justificaciones?${parametros}`);
};

export const obtenerJustificacion = (idSolicitud) => solicitar(`/att/justificaciones/${idSolicitud}`);

// decision: APROBADA | RECHAZADA
export const revisarJustificacion = (idSolicitud, idRevisor, { decision, comentario }) =>
  solicitar(`/att/justificaciones/${idSolicitud}`, {
    metodo: "PATCH",
    cuerpo: { decision, comentario },
    cabeceras: comoEmpleado(idRevisor),
  });

// La API devuelve la ruta del comprobante relativa al servicio.
export const urlComprobante = (adjunto, { descargar = false } = {}) =>
  `${BASE_URL}/att${adjunto.url}${descargar ? "?descargar=1" : ""}`;

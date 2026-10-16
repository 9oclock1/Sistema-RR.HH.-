import { solicitar } from "./cliente";

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

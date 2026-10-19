import { solicitar } from "./cliente";

// Estado de la jornada del personal de una sucursal: { fecha, es_hoy, generado_en, resumen, colaboradores }.
export const consultarPanel = ({ idSucursal, idDepartamento, fecha }) => {
  const parametros = new URLSearchParams({ id_sucursal: idSucursal, fecha });
  if (idDepartamento) parametros.set("id_departamento", idDepartamento);
  return solicitar(`/att/panel-asistencia?${parametros}`);
};

import { solicitar } from "./cliente";

// RF-28: historial de asistencia del propio colaborador (temporal: se identifica con X-Empleado-Id hasta contar con sesión).
// filtros: { mes: "AAAA-MM" } o { desde, hasta }.
// { empleado, filtros, generado_en, resumen, dias: [{ fecha, estado, turno, entrada, salida, novedades, licencias, ... }] }
export function consultarMiAsistencia(idEmpleado, filtros = {}) {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) if (valor) parametros.set(clave, valor);
  return solicitar(`/att/mi-asistencia?${parametros}`, { cabeceras: { "X-Empleado-Id": idEmpleado } });
}

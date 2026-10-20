import { solicitar } from "./cliente";

const RUTA = "/att/reportes/asistencia";

// Quién consulta: RRHH ve toda la empresa; el supervisor, solo su dependencia directa (temporal hasta contar con sesión).
const cabeceras = ({ idEmpleado, rol }) => ({
  ...(idEmpleado && { "X-Empleado-Id": idEmpleado }),
  "X-Rol": rol,
});

const parametros = (filtros, formato) => {
  const p = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) if (valor) p.set(clave, valor);
  if (formato) p.set("formato", formato);
  return p.toString();
};

// Sucursales y áreas que puede filtrar quien consulta.
export const obtenerAlcanceReportes = (identidad) => solicitar(`${RUTA}/alcance`, { cabeceras: cabeceras(identidad) });

// filtros: { id_sucursal, id_departamento, desde, hasta }.
export const generarReporteAsistencia = (filtros, identidad) =>
  solicitar(`${RUTA}?${parametros(filtros)}`, { cabeceras: cabeceras(identidad) });

// formato: "pdf" | "csv". Devuelve el archivo como Blob.
export const descargarReporteAsistencia = (filtros, formato, identidad) =>
  solicitar(`${RUTA}?${parametros(filtros, formato)}`, { cabeceras: cabeceras(identidad), respuestaBinaria: true });

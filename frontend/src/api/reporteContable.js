import { solicitar } from "./cliente";

const RUTA = "/comp/reporte-contable";

// Temporal hasta contar con autenticación: quién consulta el reporte y con qué rol (el backend exige
// Administrador o Contador, porque expone sueldos y pasivos de toda la empresa).
const cabeceras = ({ idEmpleado, rol }) => ({
  ...(idEmpleado && { "X-Empleado-Id": idEmpleado }),
  "X-Rol": rol,
});

// recurso: "planilla" (identificador: periodo AAAA-MM) o "aguinaldo" (identificador: gestión AAAA).
export const generarReporteContable = (recurso, identificador, identidad) =>
  solicitar(`${RUTA}/${recurso}/${identificador}`, { cabeceras: cabeceras(identidad) });

// formato: "csv" | "pdf". Devuelve el archivo como Blob.
export const descargarReporteContable = (recurso, identificador, formato, identidad) =>
  solicitar(`${RUTA}/${recurso}/${identificador}?formato=${formato}`, {
    respuestaBinaria: true,
    cabeceras: cabeceras(identidad),
  });

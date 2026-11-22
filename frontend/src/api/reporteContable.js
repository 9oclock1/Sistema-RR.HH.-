import { solicitar } from "./cliente";

const RUTA = "/comp/reporte-contable";

// recurso: "planilla" (identificador: periodo AAAA-MM) o "aguinaldo" (identificador: gestión AAAA).
export const generarReporteContable = (recurso, identificador) => solicitar(`${RUTA}/${recurso}/${identificador}`);

// formato: "csv" | "pdf". Devuelve el archivo como Blob.
export const descargarReporteContable = (recurso, identificador, formato) =>
  solicitar(`${RUTA}/${recurso}/${identificador}?formato=${formato}`, { respuestaBinaria: true });

import { fijarSesion } from "../../context/sesion";

export const RUTA_PLANILLAS_FISCALES = "/planillas/tributaria-aportes";

export const ROLES_PLANILLAS_FISCALES = ["admin", "contador"];

export const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const esSinGenerar = (error) => error?.estado === 404 && error?.codigo === "SIN_GENERAR";

export const cerrarSiVencio = (error) => {
  if (error?.estado !== 401) return false;
  fijarSesion(null);
  return true;
};

export const nombreArchivoTributaria = (periodo, formato) => `planilla-tributaria-${periodo}.${formato}`;

export const nombreArchivoAportes = (periodo, entidad, formato) => `aportes-${entidad}-${periodo}.${formato}`;

export const nombreArchivoZip = (periodo) => `planilla-aportes-${periodo}.zip`;

const porcentaje = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 4 });

export const formatearPorcentaje = (valor) => `${porcentaje.format(valor)} %`;

export const formatearTasa = (valor) => `${new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(valor)} %`;

export const formatearUfv = (valor) => new Intl.NumberFormat("es-BO", { minimumFractionDigits: 5, maximumFractionDigits: 5 }).format(valor);

export const ETIQUETAS_TIPO = { LABORAL: "Laboral", PATRONAL: "Patronal" };

export const TONOS_TIPO = { LABORAL: "info", PATRONAL: "morado" };

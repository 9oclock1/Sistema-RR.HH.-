export const RUTA_PLANILLAS_FISCALES = "/planillas/tributaria-aportes";

export const MENSAJE_ELEGIR_USUARIO = "Para generar las planillas, elija su usuario de prueba en la barra superior.";

export const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const esSinGenerar = (error) => error?.estado === 404 && error?.codigo === "SIN_GENERAR";

export const nombreArchivoTributaria = (periodo, formato) => `planilla-tributaria-${periodo}.${formato}`;

export const nombreArchivoAportes = (periodo, entidad, formato) => `aportes-${entidad}-${periodo}.${formato}`;

export const nombreArchivoZip = (periodo) => `planilla-aportes-${periodo}.zip`;

const porcentaje = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 4 });

export const formatearPorcentaje = (valor) => `${porcentaje.format(valor)} %`;

export const formatearTasa = (valor) => `${new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(valor)} %`;

export const ETIQUETAS_TIPO = { LABORAL: "Laboral", PATRONAL: "Patronal" };

export const TONOS_TIPO = { LABORAL: "info", PATRONAL: "morado" };

export const sinGuion = (texto) => texto ?? "—";

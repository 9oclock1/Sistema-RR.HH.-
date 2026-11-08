export const TIPOS = {
  INGRESO: { etiqueta: "Ingreso", plural: "Ingresos", tono: "exito" },
  DESCUENTO: { etiqueta: "Descuento", plural: "Descuentos", tono: "aviso" },
  APORTE: { etiqueta: "Aporte patronal", plural: "Aportes patronales", tono: "info" },
};

export const FORMAS = {
  MONTO_FIJO: "Monto fijo",
  PORCENTAJE: "Porcentaje",
};

export const BASES = {
  HABER_BASICO: "Haber básico",
  TOTAL_GANADO: "Total ganado",
};

// Conceptos cuyo porcentaje viene de otra pantalla (no de una vigencia manual aquí). Ver
// ConceptosPage/TablaConceptos: bloquean el botón de Historial y muestran una nota en vez de "Sin vigencia".
export const CODIGOS_CON_PORCENTAJE_EXTERNO = new Set(["BONO-ANTIGUEDAD"]);

export const opciones = (catalogo) =>
  Object.entries(catalogo).map(([valor, etiqueta]) => ({
    valor,
    etiqueta: typeof etiqueta === "string" ? etiqueta : etiqueta.etiqueta,
  }));

const numero = (valor, decimales) =>
  valor.toLocaleString("es-BO", { minimumFractionDigits: decimales[0], maximumFractionDigits: decimales[1] });

export const formatearValor = (valor, forma) =>
  forma === "PORCENTAJE" ? `${numero(valor, [0, 4])} %` : `Bs ${numero(valor, [2, 2])}`;

export const formatearFecha = (fecha) => (fecha ? fecha.split("-").reverse().join("/") : "—");

export const hoyLaPaz = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());

export function estadoVigencia({ vigente_desde, vigente_hasta }, hoy = hoyLaPaz()) {
  if (vigente_desde > hoy) return { etiqueta: "Programada", tono: "info" };
  if (vigente_hasta && vigente_hasta < hoy) return { etiqueta: "Finalizada", tono: "neutral" };
  return { etiqueta: "Vigente", tono: "exito" };
}

export const RUTA_DASHBOARD_QUEJAS = "/dashboards/quejas";

export const FILTROS_VACIOS = { desde: "", hasta: "", categoria: "", sucursal: "" };

export const SIN_SUCURSAL = "sin";

export const MENSAJE_SIN_PERMISO = "Solo el Administrador de RRHH puede consultar el dashboard de quejas.";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const esVacio = (valor) => valor === null || valor === undefined;

const dias = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatearDias = (valor) => (esVacio(valor) ? "—" : `${dias.format(valor)} días`);

export const etiquetaMes = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

export const etiquetaMesCorta = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(2, 4)}`;

export function validarRango({ desde, hasta }) {
  if (desde && hasta && desde > hasta) return { hasta: "La fecha final no puede ser anterior a la inicial." };
  return {};
}

export const hayFiltrosActivos = (filtros) => Object.values(filtros).some(Boolean);

export const nombreArchivoPdf = (periodo) => `dashboard-quejas-${periodo.desde}_${periodo.hasta}.pdf`;

export const pluralQuejas = (cantidad) => `${cantidad} ${cantidad === 1 ? "queja" : "quejas"}`;

export const escalaMedidor = (valor, meta, maximoFijo) => {
  if (maximoFijo) return maximoFijo;
  return Math.max(meta * 2, valor ?? 0);
};

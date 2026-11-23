import { CircleAlert, CircleCheck, CircleDashed, Minus, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";

export const RUTA_DASHBOARD_DESEMPENO = "/dashboards/desempeno";

export const FILTROS_VACIOS = { ciclo: "", departamento: "", sucursal: "" };

const decimales = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unDecimal = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const esVacio = (valor) => valor === null || valor === undefined;

export const formatearDecimal = (valor) => (esVacio(valor) ? "—" : decimales.format(valor));

export const formatearPorcentaje = (valor) => (esVacio(valor) ? "—" : `${decimales.format(valor)} %`);

export const formatearRango = (rango) => `${unDecimal.format(rango.desde)}–${unDecimal.format(rango.hasta)}`;

export const SEMAFOROS = {
  VERDE: { tono: "exito", icono: CircleCheck, texto: "Cumple la meta", corto: "Cumple", variante: "verde" },
  AMARILLO: { tono: "aviso", icono: TriangleAlert, texto: "Cerca de la meta", corto: "Cerca de la meta", variante: "amarillo" },
  ROJO: { tono: "peligro", icono: CircleAlert, texto: "No cumple la meta", corto: "No cumple", variante: "rojo" },
};

export const estadoSemaforo = (codigo) =>
  SEMAFOROS[codigo] ?? { tono: "neutral", icono: CircleDashed, texto: "Sin datos", corto: "Sin datos", variante: "sin-datos" };

export const TENDENCIAS = {
  SUBE: { icono: TrendingUp, texto: "Sube", tono: "exito" },
  BAJA: { icono: TrendingDown, texto: "Baja", tono: "peligro" },
  IGUAL: { icono: Minus, texto: "Sin cambio", tono: "neutral" },
};

export function describirVariacion(variacion) {
  if (esVacio(variacion)) return "—";
  if (variacion === 0) return formatearDecimal(0);
  return `${variacion > 0 ? "+" : "−"}${formatearDecimal(Math.abs(variacion))}`;
}

export const porcentajeEnEscala = (valor, minimo, maximo) =>
  esVacio(valor) ? 0 : Math.min(100, Math.max(0, ((valor - minimo) / (maximo - minimo)) * 100));

export const alturaRelativa = (cantidad, maximo) => (maximo > 0 ? (cantidad / maximo) * 100 : 0);

export const pluralEvaluaciones = (cantidad) => `${cantidad} ${cantidad === 1 ? "evaluación" : "evaluaciones"}`;

export const hayFiltrosActivos = (filtros) => Boolean(filtros.ciclo || filtros.departamento || filtros.sucursal);

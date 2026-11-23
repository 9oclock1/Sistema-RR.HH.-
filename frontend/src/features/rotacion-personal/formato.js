import { CircleCheck, CircleMinus, CircleX, TriangleAlert } from "lucide-react";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Semáforo: el color nunca va solo, siempre con ícono y texto.
export const ESTADOS = {
  verde: { tono: "exito", texto: "Cumple la meta", icono: CircleCheck },
  amarillo: { tono: "aviso", texto: "Cerca de la meta", icono: TriangleAlert },
  rojo: { tono: "peligro", texto: "No cumple la meta", icono: CircleX },
  sin_datos: { tono: "neutral", texto: "Sin datos", icono: CircleMinus },
};

export const estadoDe = (estado) => ESTADOS[estado] ?? ESTADOS.sin_datos;

// Color fijo por causal (clase CSS) para que cada motivo conserve su color entre filtros.
const CLASES_CAUSAL = {
  RENUNCIA: "rp-causal--1",
  CONCLUSION_CONTRATO: "rp-causal--2",
  DESPIDO_LEGAL: "rp-causal--3",
  DESAHUCIO: "rp-causal--4",
};
const CLASES_EXTRA = ["rp-causal--5", "rp-causal--6"];

export function claseCausal(codigo, indice = 0) {
  return CLASES_CAUSAL[codigo] ?? CLASES_EXTRA[indice % CLASES_EXTRA.length];
}

export const hoyLaPaz = (ahora = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(ahora);

const partes = (periodo) => {
  const [anio, mes] = periodo.split("-").map(Number);
  return { anio, mes };
};

export function nombrePeriodo(periodo) {
  const { anio, mes } = partes(periodo);
  return `${MESES[mes - 1]} ${anio}`;
}

export function nombrePeriodoCorto(periodo) {
  const { anio, mes } = partes(periodo);
  return `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}`;
}

export function restarMeses(periodo, n) {
  const { anio, mes } = partes(periodo);
  const total = anio * 12 + (mes - 1) - n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

// Mes actual primero ("Este mes") y los anteriores, hasta `cantidad` meses.
export function opcionesPeriodo(hoy, cantidad = 24) {
  const actual = hoy.slice(0, 7);
  return Array.from({ length: cantidad }, (_, i) => {
    const periodo = restarMeses(actual, i);
    const nombre = nombrePeriodo(periodo);
    return { valor: periodo, etiqueta: i === 0 ? `Este mes (${nombre})` : nombre[0].toUpperCase() + nombre.slice(1) };
  });
}

const numero = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 1 });

export const formatearPorcentaje = (valor) =>
  valor === null || valor === undefined ? "—" : `${numero.format(valor)}%`;

export const formatearNumero = (valor) => (valor === null || valor === undefined ? "—" : numero.format(valor));

export const textoMeta = ({ meta, sentido }) => `Meta: ${sentido === "menor" ? "≤" : "≥"} ${numero.format(meta)}%`;

// Rango que cubre cada indicador, dicho en palabras.
export function textoTramo(kpi, { periodo, esMesActual }) {
  if (kpi.codigo === "KPI-10") return esMesActual ? "Este mes, al día de hoy" : `Mes de ${nombrePeriodo(periodo)}`;
  return esMesActual ? "Últimos 12 meses, al día de hoy" : `12 meses hasta ${nombrePeriodo(periodo)}`;
}

export function detalleKpi(kpi) {
  const d = kpi.detalle ?? {};
  switch (kpi.codigo) {
    case "KPI-10":
      return `${d.bajas} ${d.bajas === 1 ? "baja" : "bajas"} sobre una plantilla promedio de ${formatearNumero(d.plantilla_promedio)}`;
    case "KPI-11":
      return `${d.siguen_activos} de ${d.empleados_inicio} colaboradores siguen en planilla`;
    case "KPI-12":
      return `${d.bajas_tempranas} ${d.bajas_tempranas === 1 ? "baja" : "bajas"} antes de los 90 días sobre ${d.ingresos} ${d.ingresos === 1 ? "ingreso" : "ingresos"}`;
    default:
      return "";
  }
}

// Eje Y con pasos "redondos" (1, 2, 2,5 o 5 por potencia de 10) y a lo sumo 5 divisiones,
// alto suficiente para la meta y el valor más alto.
export function escalaEje(valores, meta) {
  const maximo = Math.max(meta * 1.5, ...valores.filter((v) => v !== null && v !== undefined));
  if (!(maximo > 0)) return { tope: 1, divisiones: 4 };
  const potencia = 10 ** Math.floor(Math.log10(maximo / 5));
  for (const base of [1, 2, 2.5, 5, 10]) {
    const paso = base * potencia;
    const divisiones = Math.max(Math.ceil(maximo / paso - 1e-9), 2);
    if (divisiones <= 5) return { tope: paso * divisiones, divisiones };
  }
  return { tope: 10 * potencia * 5, divisiones: 5 };
}

// Segmentos del anillo: largo y desplazamiento sobre una circunferencia, en orden y sin las causales en cero.
export function segmentosAnillo(items, circunferencia) {
  const total = items.reduce((suma, item) => suma + item.cantidad, 0);
  if (total === 0) return [];
  let acumulado = 0;
  return items
    .map((item, indice) => ({ ...item, clase: claseCausal(item.codigo, indice) }))
    .filter((item) => item.cantidad > 0)
    .map((item) => {
      const largo = (item.cantidad / total) * circunferencia;
      const segmento = { ...item, largo, desplazamiento: -acumulado };
      acumulado += largo;
      return segmento;
    });
}

export function describirTendencia(tendencia) {
  const conDatos = tendencia.filter((p) => p.valor !== null);
  if (conDatos.length === 0) return "Sin datos de rotación en los últimos 12 meses.";
  const mayor = conDatos.reduce((a, b) => (b.valor > a.valor ? b : a));
  const ultimo = tendencia[tendencia.length - 1];
  return `Rotación mensual de ${nombrePeriodo(tendencia[0].periodo)} a ${nombrePeriodo(ultimo.periodo)}. ` +
    `Valor más alto: ${formatearPorcentaje(mayor.valor)} en ${nombrePeriodo(mayor.periodo)}. ` +
    `Último mes: ${formatearPorcentaje(ultimo.valor)}.`;
}

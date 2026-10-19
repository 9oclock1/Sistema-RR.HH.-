import { formatearFecha } from "../licencias/reglas";

export { formatearFecha };

export const CONCEPTOS = {
  ACREDITACION: { etiqueta: "Acreditado", tono: "info" },
  GOZADO: { etiqueta: "Gozado", tono: "exito" },
  EN_PROCESO: { etiqueta: "En proceso", tono: "aviso" },
};

export const formatearDias = (dias) => `${dias} ${Math.abs(dias) === 1 ? "día" : "días"}`;

const rangoDeFechas = (inicio, fin) =>
  inicio === fin ? formatearFecha(inicio) : `${formatearFecha(inicio)} – ${formatearFecha(fin)}`;

// Historial cronológico (el más reciente primero): períodos ganados (+) y días consumidos o reservados (−).
export function armarHistorial({ periodos, movimientos }) {
  const acreditaciones = periodos.map((p) => ({
    id: `periodo-${p.numero}`,
    fecha: p.fecha_acreditacion,
    concepto: "ACREDITACION",
    dias: p.dias,
    detalle: `Período ${p.numero}: ${p.numero} ${p.numero === 1 ? "año" : "años"} de servicio`,
  }));
  const consumos = movimientos.map((m) => ({
    id: m.id_movimiento,
    fecha: m.fecha_inicio,
    concepto: m.estado_codigo,
    dias: -m.dias,
    detalle: rangoDeFechas(m.fecha_inicio, m.fecha_fin),
  }));
  return [...acreditaciones, ...consumos].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

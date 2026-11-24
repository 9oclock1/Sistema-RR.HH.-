import { CircleCheck, CircleMinus, CircleX, TriangleAlert } from "lucide-react";

// RF-73 (KAN-93): semáforo de KPI-04/KPI-05. El color nunca va solo, siempre con ícono y texto.
export const ESTADOS = {
  verde: { tono: "exito", texto: "Cumple la meta", icono: CircleCheck },
  amarillo: { tono: "aviso", texto: "Cerca de la meta", icono: TriangleAlert },
  rojo: { tono: "peligro", texto: "No cumple la meta", icono: CircleX },
};
const SIN_DATOS = { tono: "neutral", texto: "Sin datos", icono: CircleMinus };

export const estadoDe = (semaforo) => ESTADOS[semaforo] ?? SIN_DATOS;

const numero = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 1 });
export const porcentaje = (valor) => (valor === null || valor === undefined ? "—" : `${numero.format(valor)} %`);

// 'AAAA-MM-DD' → 'DD/MM'.
export const diaCorto = (fecha) => fecha.slice(8, 10) + "/" + fecha.slice(5, 7);
// 'AAAA-MM-DD' → 'DD/MM/AAAA'.
export const fechaCorta = (fecha) => fecha.split("-").reverse().join("/");

const ZONA_BOLIVIA = "America/La_Paz";
const hoyBolivia = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_BOLIVIA }).format(new Date());
const restarUnDia = (texto) => {
  const fecha = new Date(`${texto}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() - 1);
  return fecha.toISOString().slice(0, 10);
};

// Por defecto, del primer día del mes hasta ayer (la última jornada cerrada), igual que Reportes de asistencia.
export function filtrosIniciales() {
  const ayer = restarUnDia(hoyBolivia());
  return { id_sucursal: "", id_departamento: "", desde: `${ayer.slice(0, 8)}01`, hasta: ayer };
}

// Intensidad del mapa de calor (0 a 4) según cuántas novedades hubo ese día, relativo al día más cargado.
export function nivelDeCalor(cantidad, maximo) {
  if (cantidad === 0 || maximo === 0) return 0;
  return Math.max(1, Math.ceil((cantidad / maximo) * 4));
}

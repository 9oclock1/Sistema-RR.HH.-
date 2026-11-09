import { mesActual } from "../condiciones/formato";

export const ESTADOS_PLANILLA = {
  BORRADOR: { etiqueta: "Borrador", tono: "aviso" },
  APROBADA: { etiqueta: "Aprobada", tono: "exito" },
  CERRADA: { etiqueta: "Cerrada", tono: "info" },
};

// Por defecto, el mes anterior: el que se paga.
export function mesAnterior() {
  const [anio, mes] = mesActual().split("-").map(Number);
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
}

const numero = (valor) => valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatearBs = (valor) => `Bs ${numero(valor)}`;

// 125 → "2 h 05"; 0 → "—".
export function formatearHoras(minutos) {
  if (!minutos) return "—";
  const horas = Math.floor(minutos / 60);
  const resto = String(minutos % 60).padStart(2, "0");
  return horas ? `${horas} h ${resto}` : `${minutos} min`;
}

export const plural = (cantidad, singular, varios) => `${cantidad} ${cantidad === 1 ? singular : varios}`;

export const minutosExtra = (m) => m.extra_habil + m.extra_domingo + m.extra_feriado;

export const TIPOS_MINUTOS = [
  { clave: "extra_habil", etiqueta: "Horas extra en día hábil" },
  { clave: "extra_domingo", etiqueta: "Horas extra en domingo" },
  { clave: "extra_feriado", etiqueta: "Horas extra en feriado" },
  { clave: "extra_nocturnos", etiqueta: "Horas extra nocturnas" },
  { clave: "domingo", etiqueta: "Trabajo en domingo" },
  { clave: "feriado", etiqueta: "Trabajo en feriado" },
  { clave: "descanso", etiqueta: "Trabajo en día de descanso" },
  { clave: "nocturnos", etiqueta: "Horas nocturnas (20:00 a 06:00)" },
];

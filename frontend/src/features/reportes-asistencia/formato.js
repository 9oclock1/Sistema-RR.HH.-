// Formatos del reporte de asistencia (RF-29), alineados con los del PDF y el CSV.
const ZONA_BOLIVIA = "America/La_Paz";

const decimal = (valor, digitos) => valor.toLocaleString("es-BO", { minimumFractionDigits: digitos, maximumFractionDigits: digitos });

export const porciento = (valor) => (valor === null || valor === undefined ? "—" : `${decimal(valor, 1)} %`);

export const horas = (minutos) => decimal(minutos / 60, 2);

// 'AAAA-MM-DD' → 'DD/MM/AAAA'.
export const fechaCorta = (texto) => texto.split("-").reverse().join("/");

const hoyBolivia = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_BOLIVIA }).format(new Date());

const restarUnDia = (texto) => {
  const fecha = new Date(`${texto}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() - 1);
  return fecha.toISOString().slice(0, 10);
};

// Por defecto, del primer día del mes hasta ayer (la última jornada cerrada).
export function filtrosIniciales() {
  const ayer = restarUnDia(hoyBolivia());
  return { id_sucursal: "", id_departamento: "", desde: `${ayer.slice(0, 8)}01`, hasta: ayer };
}

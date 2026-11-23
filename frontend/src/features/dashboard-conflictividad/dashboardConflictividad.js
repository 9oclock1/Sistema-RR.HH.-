export const RUTA_DASHBOARD_CONFLICTIVIDAD = "/dashboards/conflictividad";

export const MENSAJE_SIN_PERMISO =
  "Solo el Administrador de RRHH o el Supervisor de sucursal pueden consultar este dashboard.";

const ZONA_BOLIVIA = "America/La_Paz";
const hoyBolivia = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_BOLIVIA }).format(new Date());

// Por defecto, del primer día del mes en curso a hoy (criterio 2: igual que Asistencia resuelve del lado del backend).
export function filtrosIniciales() {
  const hoy = hoyBolivia();
  return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy, id_sucursal: "", id_departamento: "" };
}

export function validarRango({ desde, hasta }) {
  if (desde && hasta && desde > hasta) return { hasta: "La fecha final no puede ser anterior a la inicial." };
  return {};
}

const minutos = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatearMinutos = (valor) => (valor === null || valor === undefined ? "—" : `${minutos.format(valor)} min`);

const unoDecimal = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatearIndice = (valor) => (valor === null || valor === undefined ? "—" : unoDecimal.format(valor));

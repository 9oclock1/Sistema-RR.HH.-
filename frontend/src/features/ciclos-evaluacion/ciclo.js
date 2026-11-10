import { CalendarClock, CirclePlay, Lock } from "lucide-react";

export const RUTA_CICLOS = "/desempeno/ciclos";
export const ID_NUEVO_CICLO = "nuevo";
export const RUTA_NUEVO_CICLO = `${RUTA_CICLOS}/${ID_NUEVO_CICLO}`;
export const rutaCiclo = (idCiclo) => `${RUTA_CICLOS}/${idCiclo}`;

export const TAMANO_PAGINA = 10;
export const MAX_COLABORADORES_VISIBLES = 50;

export const ESTADOS_CICLO = {
  PROGRAMADO: { tono: "info", icono: CalendarClock, texto: "Programado" },
  ACTIVO: { tono: "exito", icono: CirclePlay, texto: "Activo" },
  CERRADO: { tono: "neutral", icono: Lock, texto: "Cerrado" },
};

export const estadoCiclo = (codigo) => ESTADOS_CICLO[codigo] ?? ESTADOS_CICLO.CERRADO;

// Las fechas de calendario (AAAA-MM-DD) se formatean en UTC para que la zona horaria no las corra un día.
const formatoDia = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
const formatoMomento = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatearDia = (fecha) => (fecha ? formatoDia.format(new Date(`${fecha}T00:00:00Z`)) : "—");
export const formatearMomento = (valor) => (valor ? formatoMomento.format(new Date(valor)) : "—");

export const nombreDe = (persona) => persona?.nombre_completo || "Nombre no disponible";

export const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const alcanceVacio = () => ({ areas: [], sucursales: [], colaboradores: [] });

// Colaboradores activos que entran en el alcance: área ∩ sucursal (o la que se haya elegido sola)
// más los colaboradores elegidos uno por uno. Es la misma regla con la que el servicio genera las asignaciones.
export function colaboradoresDelAlcance(empleados, { areas, sucursales, colaboradores }) {
  const porArea = new Set(areas);
  const porSucursal = new Set(sucursales);
  const sueltos = new Set(colaboradores);
  const hayGrupo = porArea.size > 0 || porSucursal.size > 0;

  return empleados.filter((empleado) => {
    if (empleado.activo === false) return false;
    const enGrupo =
      hayGrupo &&
      (porArea.size === 0 || porArea.has(empleado.id_departamento)) &&
      (porSucursal.size === 0 || porSucursal.has(empleado.id_sucursal));
    return enGrupo || sueltos.has(empleado.id_empleado);
  });
}

// Alterna un id dentro de una lista sin mutarla.
export const alternarId = (lista, id) => (lista.includes(id) ? lista.filter((actual) => actual !== id) : [...lista, id]);

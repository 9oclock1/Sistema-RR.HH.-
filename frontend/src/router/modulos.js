import { Briefcase, Building2, CalendarClock, Fingerprint, Megaphone, UserCog } from "lucide-react";
import AsignacionesView from "../features/Asignaciones/AsignacionesView";
import CargosList from "../features/Cargos/CargosList";
import MarcajePage from "../features/marcaje/MarcajePage";
import OrganizacionView from "../features/organizacion/OrganizacionView";
import TurnosPage from "../features/turnos/TurnosPage";
import VacantesView from "../features/Vacantes/VacantesView";
import { puedeAcceder } from "../utils/permisos";

// Módulos del sistema: alimentan el inicio, la barra lateral y las rutas.
// Cada historia agrega aquí su pantalla, en la sección que le corresponde.
// roles: roles con acceso; los roles superiores lo heredan (ver utils/permisos.js).
// Ninguna ruta debe ser prefijo de otra: la barra lateral las marcaría activas a la vez.
export const SECCIONES = [
  {
    titulo: "Organización",
    modulos: [
      {
        ruta: "/organizacion/areas",
        etiqueta: "Áreas",
        descripcion: "Departamentos y áreas de la empresa.",
        icono: Building2,
        roles: ["admin"],
        pagina: OrganizacionView,
      },
      {
        ruta: "/organizacion/cargos",
        etiqueta: "Cargos",
        descripcion: "Puestos de trabajo, funciones y perfil requerido.",
        icono: Briefcase,
        roles: ["admin"],
        pagina: CargosList,
      },
      {
        ruta: "/organizacion/asignaciones",
        etiqueta: "Asignaciones",
        descripcion: "Cargo, área y sucursal vigentes de cada empleado, con su historial.",
        icono: UserCog,
        roles: ["admin"],
        pagina: AsignacionesView,
      },
    ],
  },
  {
    titulo: "Reclutamiento",
    modulos: [
      {
        ruta: "/reclutamiento/vacantes",
        etiqueta: "Vacantes",
        descripcion: "Convocatorias: creación, publicación y cierre.",
        icono: Megaphone,
        roles: ["admin", "reclutador"],
        pagina: VacantesView,
      },
    ],
  },
  {
    titulo: "Asistencia",
    modulos: [
      {
        ruta: "/asistencia/marcaje",
        etiqueta: "Marcaje",
        descripcion: "Registro de la entrada y la salida de la jornada.",
        icono: Fingerprint,
        roles: ["empleado"],
        pagina: MarcajePage,
      },
      {
        ruta: "/asistencia/turnos",
        etiqueta: "Turnos",
        descripcion: "Horarios de trabajo, refrigerios y márgenes de tolerancia.",
        icono: CalendarClock,
        roles: ["admin"],
        pagina: TurnosPage,
      },
    ],
  },
];

export const seccionesPara = (rol) =>
  SECCIONES.map((seccion) => ({
    ...seccion,
    modulos: seccion.modulos.filter((modulo) => puedeAcceder(rol, modulo.roles)),
  })).filter((seccion) => seccion.modulos.length > 0);

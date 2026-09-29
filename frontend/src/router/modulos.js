import { Briefcase, Building2, CalendarClock, Fingerprint } from "lucide-react";
import MarcajePage from "../features/marcaje/MarcajePage";
import TurnosPage from "../features/turnos/TurnosPage";
import OrganizacionView from "../features/organizacion/OrganizacionView";
import CargosList from "../features/Cargos/CargosList";
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
        etiqueta: "Áreas y departamentos",
        descripcion: "Estructura organizacional de áreas y departamentos.",
        icono: Building2,
        roles: ["admin"],
        pagina: OrganizacionView,
      },
      {
        ruta: "/organizacion/cargos",
        etiqueta: "Cargos",
        descripcion: "Catálogo de cargos y su perfil requerido.",
        icono: Briefcase,
        roles: ["admin"],
        pagina: CargosList,
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

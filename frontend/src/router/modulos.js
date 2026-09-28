import { CalendarClock, Fingerprint, Mail, Megaphone } from "lucide-react";
import MarcajePage from "../features/marcaje/MarcajePage";
import TurnosPage from "../features/turnos/TurnosPage";
import BandejaMensajesPage from "../features/comunicaciones/BandejaMensajesPage";
import GestionComunicacionesPage from "../features/comunicaciones/GestionComunicacionesPage";
import { puedeAcceder } from "../utils/permisos";

// Módulos del sistema: alimentan el inicio, la barra lateral y las rutas.
// Cada historia agrega aquí su pantalla, en la sección que le corresponde.
// roles: roles con acceso; los roles superiores lo heredan (ver utils/permisos.js).
// Ninguna ruta debe ser prefijo de otra: la barra lateral las marcaría activas a la vez.
export const SECCIONES = [
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
  {
    titulo: "Comunicaciones",
    modulos: [
      {
        ruta: "/comunicaciones/bandeja",
        etiqueta: "Bandeja de mensajes",
        descripcion: "Mensajes, notificaciones y comunicados corporativos.",
        icono: Mail,
        roles: ["empleado"],
        pagina: BandejaMensajesPage,
      },
      {
        ruta: "/comunicaciones/gestion",
        etiqueta: "Gestión de comunicados",
        descripcion: "Emisión de comunicados, mensajes directos y auditoría de lecturas.",
        icono: Megaphone,
        roles: ["supervisor"],
        pagina: GestionComunicacionesPage,
      },
    ],
  },
];

export const seccionesPara = (rol) =>
  SECCIONES.map((seccion) => ({
    ...seccion,
    modulos: seccion.modulos.filter((modulo) => puedeAcceder(rol, modulo.roles)),
  })).filter((seccion) => seccion.modulos.length > 0);

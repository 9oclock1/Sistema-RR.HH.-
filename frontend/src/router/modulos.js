import { Award, Briefcase, Building2, CalendarClock, FileUser, FileWarning, Fingerprint, GraduationCap, IdCard, ListTree, Mail, Megaphone, Network, Send, UserCheck, UserPlus } from "lucide-react";
import AsignacionesView from "../features/Asignaciones/AsignacionesView";
import ApplicantRegistration from "../features/recruitment/ApplicantRegistration";
import BandejaMensajesPage from "../features/comunicaciones/BandejaMensajesPage";
import CapacitacionesView from "../features/Capacitaciones/CapacitacionesView";
import { RUTA_CAPACITACIONES } from "../features/Capacitaciones/utils/opciones";
import CargosList from "../features/Cargos/CargosList";
import GestionComunicacionesPage from "../features/comunicaciones/GestionComunicacionesPage";
import JerarquiaView from "../features/Jerarquia/JerarquiaView";
import KardexView from "../features/Kardex/KardexView";
import { RUTA_KARDEX } from "../features/Kardex/ruta";
import MarcajePage from "../features/marcaje/MarcajePage";
import MemorandumsView from "../features/Memorandums/MemorandumsView";
import OrganigramaView from "../features/organigrama/OrganigramaView";
import OrganizacionView from "../features/organizacion/OrganizacionView";
import PostulacionesPage from "../features/postulaciones/PostulacionesPage";
import ReconocimientosView from "../features/Reconocimientos/ReconocimientosView";
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
        ruta: "/organizacion/jerarquia",
        etiqueta: "Cadena de mando",
        descripcion: "Superior directo de cada cargo y su historial de cambios.",
        icono: ListTree,
        roles: ["admin"],
        pagina: JerarquiaView,
      },
      {
        ruta: "/organizacion/organigrama",
        etiqueta: "Organigrama",
        descripcion: "Estructura de cargos con sus ocupantes, exportable.",
        icono: Network,
        roles: ["supervisor"],
        pagina: OrganigramaView,
      },
      {
        ruta: "/organizacion/asignaciones",
        etiqueta: "Asignaciones",
        descripcion: "Cargo, área y sucursal vigentes de cada empleado, con su historial.",
        icono: UserCheck,
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
      {
        ruta: "/reclutamiento/postulantes",
        etiqueta: "Postulantes",
        descripcion: "Registro de candidatos y postulaciones por convocatoria.",
        icono: UserPlus,
        roles: ["reclutador"],
        pagina: ApplicantRegistration,
      },
      {
        ruta: "/reclutamiento/postulaciones",
        etiqueta: "Postulaciones",
        descripcion: "Recepción de hojas de vida, validación de formatos y registro de postulantes.",
        icono: FileUser,
        roles: ["reclutador"],
        pagina: PostulacionesPage,
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
  {
    titulo: "Expediente",
    modulos: [
      {
        ruta: RUTA_KARDEX,
        parametroOpcional: "idEmpleado",
        etiqueta: "Kardex laboral",
        descripcion: "Ficha consolidada de cada colaborador: contratos, trayectoria, memorándums y capacitaciones.",
        icono: IdCard,
        roles: ["gerente"],
        pagina: KardexView,
      },
      {
        ruta: RUTA_CAPACITACIONES,
        etiqueta: "Capacitaciones",
        descripcion: "Registro de cursos, carnets y certificaciones del personal con su vigencia y certificado.",
        icono: GraduationCap,
        roles: ["gerente"],
        pagina: CapacitacionesView,
      },
    ],
  },
  {
    titulo: "Disciplina",
    modulos: [
      {
        ruta: "/disciplina/memorandums",
        etiqueta: "Llamadas de atención",
        descripcion: "Emisión de memorándums de llamada de atención con evidencia y documento oficial.",
        icono: FileWarning,
        roles: ["supervisor"],
        pagina: MemorandumsView,
      },
    ],
  },
  {
    titulo: "Reconocimientos",
    modulos: [
      {
        ruta: "/reconocimientos/felicitaciones",
        etiqueta: "Felicitaciones",
        descripcion: "Emisión de memorándums de felicitación por méritos laborales, con vista previa del documento.",
        icono: Award,
        roles: ["supervisor"],
        pagina: ReconocimientosView,
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
        icono: Send,
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

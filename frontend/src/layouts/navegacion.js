import { CalendarClock, Fingerprint } from "lucide-react";

// Módulos de la barra lateral. Cada historia agrega aquí su pantalla.
export const SECCIONES_NAVEGACION = [
  {
    titulo: "Asistencia",
    elementos: [
      { ruta: "/asistencia/marcaje", etiqueta: "Marcaje", icono: Fingerprint },
      { ruta: "/asistencia/turnos", etiqueta: "Turnos", icono: CalendarClock },
    ],
  },
];

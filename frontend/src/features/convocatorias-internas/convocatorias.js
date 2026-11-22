import { CalendarClock, CircleAlert, CircleCheck, Hourglass, Lock } from "lucide-react";

export const RUTA_CONVOCATORIAS_RRHH = "/ascensos/gestion-convocatorias";
export const RUTA_CONVOCATORIAS_EMPLEADO = "/ascensos/convocatorias";

export const MENSAJE_SOLO_ACTIVOS = "Las convocatorias internas están disponibles solo para empleados activos.";

export const ESTADOS_CONVOCATORIA = {
  ABIERTA: { tono: "exito", icono: CircleCheck, texto: "Abierta" },
  PROGRAMADA: { tono: "info", icono: CalendarClock, texto: "Programada" },
  CERRADA: { tono: "neutral", icono: Lock, texto: "Cerrada" },
};

export const ESTADOS_NOTIFICACION = {
  ENTREGADA: { tono: "exito", icono: CircleCheck, texto: "Notificada" },
  FALLIDA: { tono: "peligro", icono: CircleAlert, texto: "Notificación fallida" },
  PENDIENTE: { tono: "aviso", icono: Hourglass, texto: "Pendiente de notificar" },
};

export const FILTROS_ESTADO_RRHH = [
  { valor: "ABIERTA", etiqueta: "Abiertas" },
  { valor: "PROGRAMADA", etiqueta: "Programadas" },
  { valor: "CERRADA", etiqueta: "Cerradas" },
];

export const FILTROS_ESTADO_EMPLEADO = [
  { valor: "VIGENTES", etiqueta: "Vigentes" },
  { valor: "CERRADA", etiqueta: "Cerradas" },
  { valor: "TODAS", etiqueta: "Todas" },
];

export const CAMPOS_FORMULARIO = [
  "id_cargo",
  "id_sucursal",
  "titulo",
  "descripcion_requisitos",
  "meses_antiguedad_minima",
  "nota_minima_desempeno",
  "fecha_inicio_postulacion",
  "fecha_cierre_postulacion",
];

const MAX_TITULO = 120;
const MAX_REQUISITOS = 2000;
const MAX_MESES = 600;
const NOTA_REGEX = /^\d{1,3}([.,]\d{1,2})?$/;

const SIN_ESTADO = { tono: "neutral", icono: Lock };

export const estadoConvocatoria = (codigo) => ESTADOS_CONVOCATORIA[codigo] ?? { ...SIN_ESTADO, texto: codigo ?? "—" };

export const estadoNotificacion = (codigo) => ESTADOS_NOTIFICACION[codigo] ?? { ...SIN_ESTADO, texto: codigo ?? "—" };

export const hoyLaPaz = (fecha = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(fecha);

export const formatearFecha = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");

export function describirPlazo(convocatoria) {
  if (convocatoria.estado === "CERRADA") return `Cerró el ${formatearFecha(convocatoria.fecha_cierre_postulacion)}`;
  if (convocatoria.estado === "PROGRAMADA") return `Se abre el ${formatearFecha(convocatoria.fecha_inicio_postulacion)}`;
  if (convocatoria.dias_para_cierre === 0) return "Cierra hoy";
  if (convocatoria.dias_para_cierre === 1) return "Cierra mañana";
  return `Cierra en ${convocatoria.dias_para_cierre} días`;
}

export const cierraPronto = (convocatoria) => convocatoria.estado === "ABIERTA" && convocatoria.dias_para_cierre <= 3;

export function formatearAntiguedad(meses) {
  if (meses === 0) return "Sin antigüedad mínima";
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes = [];
  if (anios > 0) partes.push(`${anios} ${anios === 1 ? "año" : "años"}`);
  if (resto > 0) partes.push(`${resto} ${resto === 1 ? "mes" : "meses"}`);
  return partes.join(" y ");
}

const nota = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 });

export const formatearNota = (valor) => `${nota.format(valor)} de 100`;

export const pluralEmpleados = (cantidad) => `${cantidad} ${cantidad === 1 ? "empleado activo" : "empleados activos"}`;

export const formularioVacio = (hoy = hoyLaPaz()) => ({
  id_cargo: "",
  id_sucursal: "",
  titulo: "",
  descripcion_requisitos: "",
  meses_antiguedad_minima: "6",
  nota_minima_desempeno: "",
  fecha_inicio_postulacion: hoy,
  fecha_cierre_postulacion: "",
});

export function validarFormulario(valores, hoy = hoyLaPaz()) {
  const errores = {};
  const titulo = valores.titulo.trim();
  const requisitos = valores.descripcion_requisitos.trim();
  const meses = valores.meses_antiguedad_minima.trim();
  const notaTexto = valores.nota_minima_desempeno.trim();

  if (!valores.id_cargo) errores.id_cargo = "Seleccione el cargo que se convoca.";
  if (!valores.id_sucursal) errores.id_sucursal = "Seleccione la sucursal.";
  if (!titulo) errores.titulo = "Escriba el título de la convocatoria.";
  else if (titulo.length > MAX_TITULO) errores.titulo = `No puede superar los ${MAX_TITULO} caracteres.`;
  if (!requisitos) errores.descripcion_requisitos = "Describa los requisitos.";
  else if (requisitos.length > MAX_REQUISITOS) errores.descripcion_requisitos = `No puede superar los ${MAX_REQUISITOS} caracteres.`;

  if (meses === "") errores.meses_antiguedad_minima = "Indique los meses de antigüedad mínima (0 si no hay).";
  else if (!/^\d+$/.test(meses) || Number(meses) > MAX_MESES) {
    errores.meses_antiguedad_minima = `Use un número entero de meses entre 0 y ${MAX_MESES}.`;
  }

  if (notaTexto === "") errores.nota_minima_desempeno = "Indique la nota mínima de desempeño.";
  else if (!NOTA_REGEX.test(notaTexto) || Number(notaTexto.replace(",", ".")) > 100) {
    errores.nota_minima_desempeno = "Use una nota de 0 a 100 con hasta 2 decimales.";
  }

  if (!valores.fecha_inicio_postulacion) errores.fecha_inicio_postulacion = "Indique la fecha de inicio.";
  else if (valores.fecha_inicio_postulacion < hoy) errores.fecha_inicio_postulacion = "No puede ser anterior a hoy.";

  if (!valores.fecha_cierre_postulacion) errores.fecha_cierre_postulacion = "Indique la fecha de cierre.";
  else if (valores.fecha_inicio_postulacion && valores.fecha_cierre_postulacion < valores.fecha_inicio_postulacion) {
    errores.fecha_cierre_postulacion = "No puede ser anterior a la fecha de inicio.";
  }

  return errores;
}

export const formularioAPayload = (valores) => ({
  id_cargo: valores.id_cargo,
  id_sucursal: valores.id_sucursal,
  titulo: valores.titulo.trim(),
  descripcion_requisitos: valores.descripcion_requisitos.trim(),
  meses_antiguedad_minima: Number(valores.meses_antiguedad_minima),
  nota_minima_desempeno: Number(valores.nota_minima_desempeno.replace(",", ".")),
  fecha_inicio_postulacion: valores.fecha_inicio_postulacion,
  fecha_cierre_postulacion: valores.fecha_cierre_postulacion,
});

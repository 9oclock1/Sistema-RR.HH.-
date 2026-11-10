import { CircleAlert, CircleCheck, CircleDashed, CircleMinus, Clock3, Hourglass, Inbox } from "lucide-react";
import { formatearPuntaje } from "../evaluaciones/formato";

export const RUTA_DESEMPENO_GLOBAL = "/desempeno/resultados";

export { formatearPuntaje };

export const puntajeOGuion = (valor) => (valor === null || valor === undefined ? "—" : formatearPuntaje(valor));

export const formatearMinutos = (minutos) => (minutos === null || minutos === undefined ? "—" : `${formatearPuntaje(minutos)} min`);

// La barra va de 0 a 100 (el puntaje está en esa escala); un valor fuera de rango no la desborda.
export const anchoBarra = (puntaje) => `${Math.min(100, Math.max(0, Number(puntaje) || 0))}%`;

// Un área o sucursal es brecha cuando su promedio queda por debajo del umbral del ciclo; sin evaluaciones enviadas no se
// puede juzgar. La marca va con texto e icono, no solo con color.
export function estadoGrupo(grupo) {
  if (grupo.sin_datos) return { tono: "neutral", icono: CircleDashed, texto: "Sin datos", brecha: false };
  if (grupo.es_brecha) return { tono: "peligro", icono: CircleAlert, texto: "Brecha", brecha: true };
  return { tono: "exito", icono: CircleCheck, texto: "Sobre el umbral", brecha: false };
}

export function describirDiferencia(diferencia) {
  if (diferencia === null || diferencia === undefined) return "—";
  if (diferencia === 0) return "Igual al promedio";
  return `${diferencia > 0 ? "+" : "−"}${formatearPuntaje(Math.abs(diferencia))}`;
}

// Texto para lectores de pantalla (y tooltip) de una barra del gráfico.
export function describirBarra({ nombre, puntaje, es_brecha: esBrecha, sin_datos: sinDatos, puntos_bajo_umbral: puntos }, umbral) {
  if (sinDatos || puntaje === null || puntaje === undefined) return `${nombre}: sin evaluaciones enviadas`;
  const base = `${nombre}: ${formatearPuntaje(puntaje)} de 100, umbral ${formatearPuntaje(umbral)}`;
  return esBrecha ? `${base}. Brecha de ${formatearPuntaje(puntos)} puntos bajo el umbral` : base;
}

export const describirMetricasCrm = (crm) => {
  if (!crm) return "Sin métricas del CRM";
  return `${crm.cantidad_quejas} quejas · ${crm.cantidad_felicitaciones} felicitaciones · ${formatearMinutos(crm.minutos_resolucion_promedio)}`;
};

// Estado de la solicitud de métricas que el cierre del ciclo deja para el CRM.
export const ESTADOS_SOLICITUD_CRM = {
  PENDIENTE: { tono: "info", icono: Hourglass, texto: "Pendiente de publicar" },
  ENTREGADO: { tono: "exito", icono: CircleCheck, texto: "Publicada en Pub/Sub" },
  FALLIDO: { tono: "peligro", icono: CircleAlert, texto: "Falló la publicación" },
  OMITIDO: { tono: "neutral", icono: CircleMinus, texto: "No aplica" },
};

export const estadoSolicitudCrm = (codigo) =>
  ESTADOS_SOLICITUD_CRM[codigo] ?? { tono: "neutral", icono: CircleDashed, texto: codigo ?? "Sin solicitud" };

export const ESTADOS_MENSAJE_CRM = {
  RECIBIDO: { tono: "info", icono: Clock3, texto: "Procesando" },
  PROCESADO: { tono: "exito", icono: CircleCheck, texto: "Procesado" },
  EN_DLQ: { tono: "peligro", icono: Inbox, texto: "En cola de errores" },
};

export const estadoMensajeCrm = (codigo) =>
  ESTADOS_MENSAJE_CRM[codigo] ?? { tono: "neutral", icono: CircleDashed, texto: codigo ?? "—" };

export const OPCIONES_ESTADO_MENSAJE = [
  { valor: "EN_DLQ", etiqueta: "Cola de errores" },
  { valor: "RECIBIDO", etiqueta: "Procesando" },
  { valor: "PROCESADO", etiqueta: "Procesados" },
];

// Umbral escrito por la persona: acepta coma o punto decimal, de 0 a 100 y hasta 2 decimales (como el servicio).
export function validarUmbral(texto) {
  const limpio = String(texto ?? "").trim().replace(",", ".");
  if (limpio === "") return { error: "Escriba el umbral." };
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return { error: "Use un número de 0 a 100 con hasta 2 decimales." };
  const valor = Number(limpio);
  if (valor > 100) return { error: "El umbral no puede superar 100." };
  return { valor };
}

// Mensaje de ejemplo con el formato de la respuesta del CRM, para probar duplicados o datos inválidos a mano.
// Cada vez lleva un id nuevo; para probar un duplicado se envía dos veces el mismo texto.
export function armarMensajeSimulado({ idCiclo, periodo, colaboradores, idMensaje = crypto.randomUUID() }) {
  const evaluados = colaboradores.filter((c) => c.crm).slice(0, 2);
  const elegidos = evaluados.length > 0 ? evaluados : colaboradores.slice(0, 1);
  return JSON.stringify(
    {
      encabezado: {
        id_mensaje: idMensaje,
        origen: { grupo: "B", modulo: "CRM" },
        destino: { grupo: "F", modulo: "RRHH" },
        tipo: "METRICAS_DESEMPENO_CRM",
        fecha: new Date().toISOString(),
        version_esquema: 1,
      },
      datos: {
        id_ciclo: idCiclo,
        periodo: { nombre: periodo },
        metricas: elegidos.map((c) => ({
          id_empleado: c.id_empleado,
          cantidad_quejas: 2,
          cantidad_felicitaciones: 5,
          minutos_resolucion_promedio: 18.5,
        })),
      },
    },
    null,
    2,
  );
}

// Agrupa por id los valores únicos de una lista de colaboradores (para armar los filtros de área y sucursal).
export function opcionesDe(colaboradores, claveId, claveNombre) {
  const vistos = new Map();
  for (const colaborador of colaboradores) vistos.set(colaborador[claveId], colaborador[claveNombre]);
  return [...vistos].map(([valor, etiqueta]) => ({ valor, etiqueta })).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

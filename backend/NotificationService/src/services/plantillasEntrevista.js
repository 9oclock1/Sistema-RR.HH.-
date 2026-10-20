// RF-15 (RecruitmentService): correos al candidato sobre su entrevista laboral.
const zonaHoraria = process.env.APP_TIMEZONE || "America/La_Paz";

const MODALIDAD = { PRESENCIAL: "PRESENCIAL", VIRTUAL: "VIRTUAL" };
const TIPO_AVISO = { PROGRAMACION: "PROGRAMACION", REPROGRAMACION: "REPROGRAMACION", CANCELACION: "CANCELACION" };

const NOMBRE_ZONA = zonaHoraria.split("/").pop().replace(/_/g, " ");

const formatoFecha = new Intl.DateTimeFormat("es-BO", {
  timeZone: zonaHoraria,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const formatoHora = new Intl.DateTimeFormat("es-BO", {
  timeZone: zonaHoraria,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fechaLarga = (iso) => formatoFecha.format(new Date(iso));
const hora = (iso) => `${formatoHora.format(new Date(iso))} (hora de ${NOMBRE_ZONA})`;
const cuando = (iso) => `${fechaLarga(iso)}, ${hora(iso)}`;

const escaparHtml = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Filas «etiqueta: valor» de la cita; en las virtuales el lugar es el enlace de la reunión.
function detallesCita(carga) {
  const virtual = carga.modalidad === MODALIDAD.VIRTUAL;
  return [
    ["Puesto", `${carga.puesto} (${carga.codigo_convocatoria})`],
    ["Fecha", fechaLarga(carga.fecha_hora)],
    ["Hora", hora(carga.fecha_hora)],
    ["Duración estimada", `${carga.duracion_minutos} minutos`],
    ["Modalidad", virtual ? "Virtual" : "Presencial"],
    [virtual ? "Enlace de acceso" : "Dirección", carga.lugar_enlace, virtual],
    ["Entrevistador(a)", carga.evaluador],
  ];
}

const CONTENIDO = {
  [TIPO_AVISO.PROGRAMACION]: (carga) => ({
    asunto: `Entrevista programada: ${carga.puesto}`,
    parrafos: [
      `Nos complace informarle que fue seleccionado(a) para una entrevista laboral en el proceso de ${carga.puesto}.`,
      carga.modalidad === MODALIDAD.VIRTUAL
        ? "Ingrese con el enlace de acceso unos minutos antes de la hora indicada."
        : "Le pedimos presentarse en la dirección indicada unos minutos antes de la hora, con su documento de identidad.",
    ],
    conDetalle: true,
  }),
  [TIPO_AVISO.REPROGRAMACION]: (carga) => ({
    asunto: `Entrevista reprogramada: ${carga.puesto}`,
    parrafos: [
      carga.fecha_hora_anterior && carga.fecha_hora_anterior !== carga.fecha_hora
        ? `Su entrevista para ${carga.puesto}, prevista para el ${cuando(carga.fecha_hora_anterior)}, fue reprogramada.`
        : `Los datos de su entrevista para ${carga.puesto} fueron actualizados.`,
      ...(carga.motivo ? [`Motivo: ${carga.motivo}`] : []),
      "Estos son los datos vigentes; los anteriores quedan sin efecto.",
    ],
    conDetalle: true,
  }),
  [TIPO_AVISO.CANCELACION]: (carga) => ({
    asunto: `Entrevista cancelada: ${carga.puesto}`,
    parrafos: [
      `Le informamos que su entrevista para ${carga.puesto}, prevista para el ${cuando(carga.fecha_hora)}, fue cancelada.`,
      ...(carga.motivo ? [`Motivo: ${carga.motivo}`] : []),
      "Si corresponde, el equipo de reclutamiento se comunicará con usted para coordinar los siguientes pasos.",
    ],
    conDetalle: false,
  }),
};

const PIE = "Este es un aviso automático del Sistema de RR.HH.; por favor no responda a este correo.";

/** Arma el correo de un aviso de entrevista: { asunto, texto, html }. */
function armarCorreo(tipo, carga) {
  const plantilla = CONTENIDO[tipo];
  if (!plantilla) throw new Error(`No existe una plantilla de correo para el aviso «${tipo}».`);
  const { asunto, parrafos, conDetalle } = plantilla(carga);
  const saludo = `Estimado(a) ${carga.candidato.nombres} ${carga.candidato.apellidos}:`;
  const filas = conDetalle ? detallesCita(carga) : [];

  const texto = [
    saludo,
    "",
    ...parrafos.flatMap((p) => [p, ""]),
    ...filas.map(([etiqueta, valor]) => `${etiqueta}: ${valor}`),
    ...(filas.length ? [""] : []),
    "Atentamente,",
    "Equipo de Reclutamiento",
    "",
    PIE,
  ].join("\n");

  const filasHtml = filas
    .map(([etiqueta, valor, esEnlace]) => {
      const contenido = esEnlace
        ? `<a href="${escaparHtml(valor)}" style="color:#1d4ed8">${escaparHtml(valor)}</a>`
        : escaparHtml(valor);
      return `<tr><td style="padding:6px 12px 6px 0;color:#555;white-space:nowrap;vertical-align:top">${escaparHtml(etiqueta)}</td><td style="padding:6px 0;font-weight:600">${contenido}</td></tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px">
<h1 style="font-size:18px;margin:0 0 16px">${escaparHtml(asunto)}</h1>
<p style="margin:0 0 12px">${escaparHtml(saludo)}</p>
${parrafos.map((p) => `<p style="margin:0 0 12px;line-height:1.5">${escaparHtml(p)}</p>`).join("\n")}
${filasHtml ? `<table role="presentation" style="border-collapse:collapse;margin:8px 0 16px">${filasHtml}</table>` : ""}
<p style="margin:16px 0 0">Atentamente,<br>Equipo de Reclutamiento</p>
<p style="margin:24px 0 0;font-size:12px;color:#6b7280">${escaparHtml(PIE)}</p>
</div></body></html>`;

  return { asunto, texto, html };
}

module.exports = { MODALIDAD, TIPO_AVISO, armarCorreo };

const correoServicio = require("./correo.service");
const { MODALIDAD, TIPO_AVISO, armarCorreo } = require("./plantillasEntrevista");
const { ErrorApp } = require("../utils/errores");
const { esUuidValido } = require("../utils/validaciones");

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esTexto = (valor) => typeof valor === "string" && valor.trim() !== "";

// Valida el aviso que envía RecruitmentService: a quién, de qué tipo y los datos de la cita.
function validarAviso(cuerpo) {
  const aviso = cuerpo && typeof cuerpo === "object" ? cuerpo : {};
  const datos = aviso.datos && typeof aviso.datos === "object" ? aviso.datos : {};
  const detalles = [];
  const falta = (campo, mensaje) => detalles.push({ campo, mensaje });

  if (!esUuidValido(aviso.id_mensaje)) falta("id_mensaje", "El identificador del aviso debe ser un UUID válido.");
  if (!esTexto(aviso.para) || !CORREO_RE.test(aviso.para.trim())) falta("para", "El correo del destinatario no es válido.");
  if (!Object.values(TIPO_AVISO).includes(aviso.tipo)) {
    falta("tipo", `El tipo de aviso debe ser uno de: ${Object.values(TIPO_AVISO).join(", ")}.`);
  }
  if (!esTexto(datos.candidato?.nombres)) falta("datos.candidato", "Faltan los nombres del candidato.");
  for (const campo of ["puesto", "codigo_convocatoria", "lugar_enlace", "evaluador"]) {
    if (!esTexto(datos[campo])) falta(`datos.${campo}`, `Falta el dato «${campo}» de la entrevista.`);
  }
  if (!esTexto(datos.fecha_hora) || Number.isNaN(Date.parse(datos.fecha_hora))) {
    falta("datos.fecha_hora", "La fecha y hora de la entrevista no es válida.");
  }
  if (!Number.isInteger(datos.duracion_minutos) || datos.duracion_minutos <= 0) {
    falta("datos.duracion_minutos", "La duración de la entrevista debe ser un número entero de minutos.");
  }
  if (!Object.values(MODALIDAD).includes(datos.modalidad)) falta("datos.modalidad", "La modalidad debe ser PRESENCIAL o VIRTUAL.");

  if (detalles.length > 0) throw new ErrorApp(400, "El aviso de entrevista está incompleto.", detalles);
  return { ...aviso, para: aviso.para.trim(), datos };
}

/**
 * RF-15: envía al candidato el correo de su entrevista (programada, reprogramada o cancelada).
 * Un rechazo de la dirección responde 422 (no tiene sentido reintentar); cualquier otro fallo, 503 (reintentable).
 */
async function enviarAvisoEntrevista(cuerpo) {
  const aviso = validarAviso(cuerpo);
  const { asunto, texto, html } = armarCorreo(aviso.tipo, aviso.datos);
  const resultado = await correoServicio.entregarCorreo({ para: aviso.para, asunto, texto, html, idMensaje: aviso.id_mensaje });

  if (!resultado.enviado) {
    throw new ErrorApp(resultado.permanente ? 422 : 503, resultado.motivo, [{ campo: "para", mensaje: resultado.motivo }]);
  }
  console.log(`[Correo] Aviso de entrevista ${aviso.tipo} enviado a ${aviso.para} (${resultado.idMensaje})`);
  return { enviado: true, para: aviso.para, asunto, id_mensaje_correo: resultado.idMensaje };
}

module.exports = { validarAviso, enviarAvisoEntrevista };

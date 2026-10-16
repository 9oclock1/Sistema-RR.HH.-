const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { coincideFirma } = require("./firmaArchivo");

const ESTADO_JUSTIFICACION = { PENDIENTE: 1, APROBADA: 2, RECHAZADA: 3 };
const MOTIVO_OTRO = "OTRO";
const MAX_DESCRIPCION = 500;
const HORA_MS = 60 * 60 * 1000;

const TIPOS_ADJUNTO = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

// Plazo para presentar el justificativo, en horas desde la incidencia (por defecto 48).
function horasPlazo() {
  const valor = Number(process.env.HORAS_PLAZO_JUSTIFICACION);
  return Number.isInteger(valor) && valor > 0 ? valor : 48;
}

// La incidencia es la marca del atraso o de la salida anticipada; en una inasistencia, el fin del turno.
const instanteIncidencia = (novedad) => new Date(novedad.fecha_hora_marcaje ?? novedad.fin_programado);

const venceEn = (novedad, horas) => new Date(instanteIncidencia(novedad).getTime() + horas * HORA_MS);

const RAZONES = {
  NO_JUSTIFICABLE: "Esta novedad no requiere justificativo.",
  JUSTIFICADA: "La novedad ya está justificada.",
  PENDIENTE: "Ya presentó un justificativo para esta novedad y está pendiente de revisión.",
  VENCIDA: "El plazo para justificar esta novedad venció",
};

// Si el colaborador puede presentar un justificativo ahora y, si no, por qué.
function evaluarPlazo(novedad, { vigente = null, ahoraMs, horas }) {
  const vence = venceEn(novedad, horas);
  let razon = null;
  if (!novedad.es_justificable) razon = "NO_JUSTIFICABLE";
  else if (novedad.estado_codigo === "JUSTIFICADA" || vigente?.estado_codigo === "APROBADA") razon = "JUSTIFICADA";
  else if (vigente?.estado_codigo === "PENDIENTE") razon = "PENDIENTE";
  else if (ahoraMs > vence.getTime()) razon = "VENCIDA";
  return { justificable: razon === null, razon, vence_en: vence };
}

const formatoBolivia = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function errorDePlazo({ razon, vence_en }) {
  const mensaje = razon === "VENCIDA" ? `${RAZONES.VENCIDA} el ${formatoBolivia.format(vence_en)}.` : RAZONES[razon];
  return new ErrorApp(409, mensaje, [{ campo: "id_novedad", mensaje }]);
}

const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

// Campos del formulario (multipart: todo llega como texto) y comprobantes ya leídos en memoria.
function validarSolicitud(cuerpo = {}, archivos = [], motivos = []) {
  const errores = [];
  const idNovedad = texto(cuerpo.id_novedad).toLowerCase();
  if (!idNovedad) errores.push({ campo: "id_novedad", mensaje: "Indique la novedad que justifica." });
  else if (!UUID_RE.test(idNovedad)) errores.push({ campo: "id_novedad", mensaje: "Novedad inválida." });

  const idMotivo = Number(texto(cuerpo.id_motivo));
  const motivo = motivos.find((m) => m.id_motivo_justificacion === idMotivo);
  if (!texto(cuerpo.id_motivo)) errores.push({ campo: "id_motivo", mensaje: "Seleccione el motivo." });
  else if (!motivo) errores.push({ campo: "id_motivo", mensaje: "Motivo inválido." });

  const descripcion = texto(cuerpo.descripcion);
  if (descripcion.length > MAX_DESCRIPCION) {
    errores.push({ campo: "descripcion", mensaje: `Use como máximo ${MAX_DESCRIPCION} caracteres.` });
  } else if (motivo?.codigo === MOTIVO_OTRO && !descripcion) {
    errores.push({ campo: "descripcion", mensaje: "Describa el motivo." });
  }

  if (archivos.length === 0) {
    errores.push({ campo: "archivos", mensaje: "Adjunte al menos un comprobante (PDF, JPG o PNG)." });
  }
  for (const archivo of archivos) {
    if (!coincideFirma(archivo.buffer, archivo.mimetype)) {
      errores.push({
        campo: "archivos",
        mensaje: `«${archivo.originalname}» no es un PDF, JPG o PNG válido.`,
      });
    }
  }

  if (errores.length > 0) throw new ErrorApp(400, "Datos inválidos", errores);
  return { idNovedad, idMotivo, descripcion: descripcion || null };
}

// Nombre para mostrar: sin rutas ni caracteres de control, hasta 255 caracteres.
function nombreVisible(nombre) {
  const limpio = String(nombre ?? "")
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .trim();
  return (limpio || "comprobante").slice(0, 255);
}

module.exports = {
  ESTADO_JUSTIFICACION,
  TIPOS_ADJUNTO,
  horasPlazo,
  venceEn,
  evaluarPlazo,
  errorDePlazo,
  validarSolicitud,
  nombreVisible,
};

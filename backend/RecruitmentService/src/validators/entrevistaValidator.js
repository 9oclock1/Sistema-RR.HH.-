const {
  esVacio,
  faltante,
  invalido,
  cuerpoComoObjeto,
  normalizarTexto,
  normalizarUuid,
  lanzarSiHayErrores,
} = require("./comunes");
const { aInstante, hoy } = require("../utils/fechas");
const { MODALIDAD, DURACION, MAX_MOTIVO } = require("../utils/entrevistas");

const MODALIDADES = Object.values(MODALIDAD);
const MAX_LUGAR = 255;
const MAX_DIAS_AGENDA = 92;

const normalizarFechaHora = (valor, campo, { requerido = false } = {}, errores) => {
  if (esVacio(valor)) {
    if (requerido) errores.push(faltante(campo));
    return null;
  }
  const instante = typeof valor === "string" ? aInstante(valor.trim()) : null;
  if (!instante) {
    errores.push(
      invalido(campo, `El campo '${campo}' debe ser una fecha y hora válida (AAAA-MM-DDTHH:mm).`),
    );
  }
  return instante;
};

const normalizarDuracion = (valor, errores) => {
  if (esVacio(valor)) return null;
  const numero = typeof valor === "string" ? Number(valor.trim()) : valor;
  if (!Number.isInteger(numero) || numero < DURACION.MINIMA || numero > DURACION.MAXIMA) {
    errores.push(
      invalido(
        "duracion_minutos",
        `La duración de la entrevista debe ser de ${DURACION.MINIMA} a ${DURACION.MAXIMA} minutos.`,
      ),
    );
    return null;
  }
  return numero;
};

const normalizarModalidad = (valor, { requerido = false } = {}, errores) => {
  const texto = normalizarTexto(valor, "modalidad", { requerido, maxLength: 20 }, errores);
  if (texto === null) return null;
  const modalidad = texto.toUpperCase();
  if (!MODALIDADES.includes(modalidad)) {
    errores.push(invalido("modalidad", "La modalidad debe ser PRESENCIAL o VIRTUAL."));
    return null;
  }
  return modalidad;
};

const normalizarBooleano = (valor, campo, errores) => {
  if (esVacio(valor)) return false;
  if (typeof valor !== "boolean") {
    errores.push(invalido(campo, `El campo '${campo}' debe ser verdadero o falso.`));
    return false;
  }
  return valor;
};

// En una entrevista virtual el lugar es el enlace de la reunión; en una presencial, la dirección.
const validarLugar = (modalidad, lugar, errores) => {
  if (modalidad !== MODALIDAD.VIRTUAL || lugar === null) return;
  let url = null;
  try {
    url = new URL(lugar);
  } catch {
    url = null;
  }
  if (!url || !["http:", "https:"].includes(url.protocol)) {
    errores.push(
      invalido("lugar_enlace", "Para una entrevista virtual indique el enlace de la reunión (http:// o https://)."),
    );
  }
};

function validarProgramacion(body) {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const fechaHora = normalizarFechaHora(datos.fecha_hora_programada, "fecha_hora_programada", { requerido: true }, errores);
  const duracion = normalizarDuracion(datos.duracion_minutos, errores);
  const modalidad = normalizarModalidad(datos.modalidad, { requerido: true }, errores);
  const lugar = normalizarTexto(datos.lugar_enlace, "lugar_enlace", { requerido: true, maxLength: MAX_LUGAR }, errores);
  const idEntrevistador = normalizarUuid(datos.id_entrevistador_empleado, "id_entrevistador_empleado", { requerido: true }, errores);
  const confirmar = normalizarBooleano(datos.confirmar_solapamiento, "confirmar_solapamiento", errores);
  validarLugar(modalidad, lugar, errores);

  lanzarSiHayErrores(errores, "No se puede agendar la entrevista.");

  return {
    fecha_hora_programada: fechaHora,
    duracion_minutos: duracion ?? DURACION.PREDETERMINADA,
    modalidad,
    lugar_enlace: lugar,
    id_entrevistador_empleado: idEntrevistador,
    confirmar_solapamiento: confirmar,
  };
}

// Solo se envía lo que cambia; la modalidad y el lugar van juntos porque uno define el formato del otro.
function validarReprogramacion(body) {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const fechaHora = normalizarFechaHora(datos.fecha_hora_programada, "fecha_hora_programada", {}, errores);
  const duracion = normalizarDuracion(datos.duracion_minutos, errores);
  const modalidad = normalizarModalidad(datos.modalidad, {}, errores);
  const lugar = normalizarTexto(datos.lugar_enlace, "lugar_enlace", { maxLength: MAX_LUGAR }, errores);
  const idEntrevistador = normalizarUuid(datos.id_entrevistador_empleado, "id_entrevistador_empleado", {}, errores);
  const motivo = normalizarTexto(datos.motivo, "motivo", { maxLength: MAX_MOTIVO }, errores);
  const confirmar = normalizarBooleano(datos.confirmar_solapamiento, "confirmar_solapamiento", errores);

  if (esVacio(datos.modalidad) !== esVacio(datos.lugar_enlace)) {
    errores.push(faltante(esVacio(datos.modalidad) ? "modalidad" : "lugar_enlace"));
  }
  validarLugar(modalidad, lugar, errores);
  if (
    [datos.fecha_hora_programada, datos.duracion_minutos, datos.modalidad, datos.lugar_enlace, datos.id_entrevistador_empleado]
      .every(esVacio)
  ) {
    errores.push(
      invalido("fecha_hora_programada", "Indique qué cambia: fecha y hora, duración, modalidad y lugar, o evaluador."),
    );
  }

  lanzarSiHayErrores(errores, "No se puede reprogramar la entrevista.");

  return {
    fecha_hora_programada: fechaHora,
    duracion_minutos: duracion,
    modalidad,
    lugar_enlace: lugar,
    id_entrevistador_empleado: idEntrevistador,
    motivo,
    confirmar_solapamiento: confirmar,
  };
}

function validarCancelacion(body) {
  const datos = cuerpoComoObjeto(body);
  const errores = [];
  const motivo = normalizarTexto(datos.motivo, "motivo", { requerido: true, maxLength: MAX_MOTIVO }, errores);
  lanzarSiHayErrores(errores, "No se puede cancelar la entrevista.");
  return { motivo };
}

// Filtros de la agenda: rango de fechas (por defecto, de hoy a 30 días) y evaluador opcional.
function validarFiltroAgenda(query) {
  const datos = cuerpoComoObjeto(query);
  const errores = [];
  const desde = normalizarFechaHora(datos.desde, "desde", {}, errores);
  const hasta = normalizarFechaHora(datos.hasta, "hasta", {}, errores);
  const idEntrevistador = normalizarUuid(datos.id_entrevistador_empleado, "id_entrevistador_empleado", {}, errores);
  const incluirCanceladas = datos.incluir_canceladas === "true";

  lanzarSiHayErrores(errores);

  const inicio = desde ?? aInstante(`${hoy()}T00:00`);
  const fin = hasta ?? new Date(inicio.getTime() + 30 * 86400000);
  if (fin <= inicio) {
    errores.push(invalido("hasta", "La fecha 'hasta' debe ser posterior a 'desde'."));
  } else if (fin - inicio > MAX_DIAS_AGENDA * 86400000) {
    errores.push(invalido("hasta", `El rango de la agenda no puede superar los ${MAX_DIAS_AGENDA} días.`));
  }
  lanzarSiHayErrores(errores);

  return { desde: inicio, hasta: fin, id_entrevistador_empleado: idEntrevistador, incluir_canceladas: incluirCanceladas };
}

module.exports = {
  validarProgramacion,
  validarReprogramacion,
  validarCancelacion,
  validarFiltroAgenda,
};

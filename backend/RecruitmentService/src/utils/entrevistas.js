const HttpError = require("./HttpError");
const { ETAPA } = require("./etapas");

// Códigos de CATALOGOS_ESTADO_ENTREVISTA.
const ESTADO_ENTREVISTA = {
  PROGRAMADA: 1,
  REPROGRAMADA: 2,
  CANCELADA: 3,
  REALIZADA: 4,
};
// Las que ocupan la agenda del evaluador y todavía se pueden reprogramar o cancelar.
const ESTADOS_ACTIVOS = [
  ESTADO_ENTREVISTA.PROGRAMADA,
  ESTADO_ENTREVISTA.REPROGRAMADA,
];

const MODALIDAD = { PRESENCIAL: "PRESENCIAL", VIRTUAL: "VIRTUAL" };

const TIPO_NOTIFICACION = {
  PROGRAMACION: "PROGRAMACION",
  REPROGRAMACION: "REPROGRAMACION",
  CANCELACION: "CANCELACION",
};

// Solo se entrevista a quien está en «Entrevista técnica» o «Apto».
const ETAPAS_AGENDABLES = [ETAPA.ENTREVISTA_TECNICA, ETAPA.APTO];

const DURACION = { MINIMA: 15, MAXIMA: 480, PREDETERMINADA: 60 };
const MAX_MOTIVO = 1000;

const conflicto = (mensaje, detalles = {}) =>
  new HttpError(409, mensaje, {
    campos_faltantes: [],
    errores: [],
    ...detalles,
  });

const solicitudInvalida = (campo, mensaje) =>
  new HttpError(400, mensaje, {
    campos_faltantes: [],
    errores: [{ campo, mensaje }],
  });

/**
 * Reglas para agendar o reprogramar. Lanza el primer error que aplique.
 * - postulacion: { id_etapa, nombre_etapa, esta_archivada }
 * - inicio: fecha y hora de la cita ya interpretada (Date); ahora: Date de referencia
 * - evaluador: { activo } leído de EmployeeService (null si no existe)
 * - solapamientos: citas activas del evaluador que se cruzan con la nueva
 * - confirmarSolapamiento: el reclutador vio la advertencia y decidió guardar igual
 */
function verificarProgramacion({
  postulacion,
  inicio,
  ahora = new Date(),
  evaluador,
  solapamientos = [],
  confirmarSolapamiento = false,
}) {
  if (postulacion.esta_archivada || !ETAPAS_AGENDABLES.includes(postulacion.id_etapa)) {
    throw conflicto(
      `Solo se puede agendar una entrevista a postulantes en «Entrevista técnica» o «Apto»; este se encuentra en «${postulacion.nombre_etapa}».`,
    );
  }
  if (inicio.getTime() <= ahora.getTime()) {
    throw solicitudInvalida(
      "fecha_hora_programada",
      "La fecha y hora de la entrevista debe ser posterior al momento actual.",
    );
  }
  if (!evaluador) {
    throw solicitudInvalida(
      "id_entrevistador_empleado",
      "El evaluador indicado no existe.",
    );
  }
  if (!evaluador.activo) {
    throw conflicto(
      "El evaluador indicado no está activo en la empresa; elija a otro evaluador.",
    );
  }
  if (solapamientos.length > 0 && !confirmarSolapamiento) {
    throw conflicto(
      `El evaluador ya tiene ${solapamientos.length === 1 ? "una entrevista" : `${solapamientos.length} entrevistas`} en ese horario. Revise la agenda o confirme para guardar de todas formas.`,
      { solapamiento: true, entrevistas_solapadas: solapamientos },
    );
  }
}

// Reprogramar o cancelar exige que la cita siga activa.
function verificarCitaActiva(entrevista, accion) {
  if (!ESTADOS_ACTIVOS.includes(entrevista.id_estado_entrevista)) {
    throw conflicto(
      `No se puede ${accion} una entrevista en estado «${entrevista.nombre_estado}».`,
    );
  }
}

module.exports = {
  ESTADO_ENTREVISTA,
  ESTADOS_ACTIVOS,
  MODALIDAD,
  TIPO_NOTIFICACION,
  ETAPAS_AGENDABLES,
  DURACION,
  MAX_MOTIVO,
  verificarProgramacion,
  verificarCitaActiva,
};

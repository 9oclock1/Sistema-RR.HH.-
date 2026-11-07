const modelo = require("../models/entrevistaModel");
const notificaciones = require("./notificacionEntrevistaService");
const employeeService = require("./employeeServiceClient");
const HttpError = require("../utils/HttpError");
const { withTransaction } = require("../utils/transaction");
const {
  ESTADO_ENTREVISTA,
  TIPO_NOTIFICACION,
  verificarProgramacion,
  verificarCitaActiva,
} = require("../utils/entrevistas");

const postulacionNoEncontrada = () => new HttpError(404, "La postulación indicada no existe.");
const entrevistaNoEncontrada = () => new HttpError(404, "La entrevista indicada no existe.");

const nombreCompleto = (empleado) => [empleado.nombres, empleado.apellidos].filter(Boolean).join(" ").trim();

async function agendar(idPostulacion, datos, usuario) {
  // EmployeeService se consulta antes de abrir la transacción para no retener bloqueos mientras responde.
  const evaluador = await employeeService.obtenerEmpleado(datos.id_entrevistador_empleado);

  return withTransaction(async (client) => {
    const postulacion = await modelo.bloquearPostulacion(client, idPostulacion);
    if (!postulacion) throw postulacionNoEncontrada();

    await modelo.bloquearAgendaEvaluador(client, datos.id_entrevistador_empleado);
    const solapamientos = evaluador
      ? await modelo.buscarSolapamientos(client, {
          idEntrevistador: datos.id_entrevistador_empleado,
          inicio: datos.fecha_hora_programada,
          duracionMinutos: datos.duracion_minutos,
        })
      : [];

    verificarProgramacion({
      postulacion,
      inicio: datos.fecha_hora_programada,
      evaluador,
      solapamientos,
      confirmarSolapamiento: datos.confirmar_solapamiento,
    });

    const cita = { ...datos, nombre_entrevistador: nombreCompleto(evaluador) };
    const idEntrevista = await modelo.insertarEntrevista(client, { idPostulacion, cita, usuario });
    const historial = await modelo.registrarHistorial(client, {
      idEntrevista,
      idEstado: ESTADO_ENTREVISTA.PROGRAMADA,
      fechaHoraNueva: cita.fecha_hora_programada,
      usuario,
    });
    const entrevista = await modelo.obtenerEntrevista(idEntrevista, client);
    const notificacion = await notificaciones.encolar(client, {
      entrevista,
      tipo: TIPO_NOTIFICACION.PROGRAMACION,
      historial,
    });

    return {
      entrevista,
      historial,
      notificacion,
      entrevistas_solapadas: solapamientos,
    };
  });
}

async function reprogramar(idEntrevista, datos, usuario) {
  const evaluadorNuevo = datos.id_entrevistador_empleado
    ? await employeeService.obtenerEmpleado(datos.id_entrevistador_empleado)
    : undefined;

  return withTransaction(async (client) => {
    const actual = await modelo.bloquearEntrevista(client, idEntrevista);
    if (!actual) throw entrevistaNoEncontrada();
    verificarCitaActiva(actual, "reprogramar");

    const cambiaEvaluador =
      evaluadorNuevo !== undefined && datos.id_entrevistador_empleado !== actual.id_entrevistador_empleado;
    const cita = {
      fecha_hora_programada: datos.fecha_hora_programada ?? actual.fecha_hora_programada,
      duracion_minutos: datos.duracion_minutos ?? actual.duracion_minutos,
      modalidad: datos.modalidad ?? actual.modalidad,
      lugar_enlace: datos.lugar_enlace ?? actual.lugar_enlace,
      id_entrevistador_empleado: cambiaEvaluador ? datos.id_entrevistador_empleado : actual.id_entrevistador_empleado,
      nombre_entrevistador:
        cambiaEvaluador && evaluadorNuevo ? nombreCompleto(evaluadorNuevo) : actual.nombre_entrevistador,
    };

    const sinCambios =
      cita.fecha_hora_programada.getTime() === actual.fecha_hora_programada.getTime() &&
      cita.duracion_minutos === actual.duracion_minutos &&
      cita.modalidad === actual.modalidad &&
      cita.lugar_enlace === actual.lugar_enlace &&
      !cambiaEvaluador;
    if (sinCambios) {
      throw new HttpError(400, "La entrevista ya está programada con esos datos; no hay nada que reprogramar.", {
        campos_faltantes: [],
        errores: [],
      });
    }

    await modelo.bloquearAgendaEvaluador(client, cita.id_entrevistador_empleado);
    // Un evaluador que ya no existe deja la lista vacía: el error de evaluador lo da verificarProgramacion.
    const evaluador = cambiaEvaluador ? evaluadorNuevo : { activo: true };
    const solapamientos = evaluador
      ? await modelo.buscarSolapamientos(client, {
          idEntrevistador: cita.id_entrevistador_empleado,
          inicio: cita.fecha_hora_programada,
          duracionMinutos: cita.duracion_minutos,
          excluirId: idEntrevista,
        })
      : [];

    verificarProgramacion({
      postulacion: actual,
      inicio: cita.fecha_hora_programada,
      evaluador,
      solapamientos,
      confirmarSolapamiento: datos.confirmar_solapamiento,
    });

    await modelo.actualizarEntrevista(client, idEntrevista, { cita, idEstado: ESTADO_ENTREVISTA.REPROGRAMADA });
    const historial = await modelo.registrarHistorial(client, {
      idEntrevista,
      idEstadoAnterior: actual.id_estado_entrevista,
      idEstado: ESTADO_ENTREVISTA.REPROGRAMADA,
      fechaHoraAnterior: actual.fecha_hora_programada,
      fechaHoraNueva: cita.fecha_hora_programada,
      motivo: datos.motivo,
      usuario,
    });
    const entrevista = await modelo.obtenerEntrevista(idEntrevista, client);
    const notificacion = await notificaciones.encolar(client, {
      entrevista,
      tipo: TIPO_NOTIFICACION.REPROGRAMACION,
      historial,
    });

    return {
      entrevista,
      historial,
      notificacion,
      entrevistas_solapadas: solapamientos,
    };
  });
}

async function cancelar(idEntrevista, { motivo }, usuario) {
  return withTransaction(async (client) => {
    const actual = await modelo.bloquearEntrevista(client, idEntrevista);
    if (!actual) throw entrevistaNoEncontrada();
    verificarCitaActiva(actual, "cancelar");

    await modelo.actualizarEntrevista(client, idEntrevista, {
      cita: actual,
      idEstado: ESTADO_ENTREVISTA.CANCELADA,
    });
    const historial = await modelo.registrarHistorial(client, {
      idEntrevista,
      idEstadoAnterior: actual.id_estado_entrevista,
      idEstado: ESTADO_ENTREVISTA.CANCELADA,
      fechaHoraAnterior: actual.fecha_hora_programada,
      fechaHoraNueva: actual.fecha_hora_programada,
      motivo,
      usuario,
    });
    const entrevista = await modelo.obtenerEntrevista(idEntrevista, client);
    const notificacion = await notificaciones.encolar(client, {
      entrevista,
      tipo: TIPO_NOTIFICACION.CANCELACION,
      historial,
    });

    return { entrevista, historial, notificacion };
  });
}

async function obtenerDetalle(idEntrevista) {
  const entrevista = await modelo.obtenerEntrevista(idEntrevista);
  if (!entrevista) throw entrevistaNoEncontrada();
  const [historial, avisos] = await Promise.all([
    modelo.listarHistorial(idEntrevista),
    notificaciones.listarPorEntrevista(idEntrevista),
  ]);
  return { ...entrevista, historial, notificaciones: avisos };
}

async function listarDePostulacion(idPostulacion) {
  if (!(await modelo.existePostulacion(idPostulacion))) throw postulacionNoEncontrada();
  return modelo.listarDePostulacion(idPostulacion);
}

const listarAgenda = (filtros) => modelo.listarAgenda(filtros);

module.exports = { agendar, reprogramar, cancelar, obtenerDetalle, listarDePostulacion, listarAgenda };

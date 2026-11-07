const modelo = require("../models/solicitudesVacacion.model");
const empleados = require("./empleados.service");
const supervisores = require("./supervisores.service");
const notificaciones = require("./notificaciones.service");
const indisponibilidad = require("./indisponibilidad.service");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { DECISIONES, validarResolucion } = require("../utils/licencias");
const {
  ESTADOS_EN_CURSO,
  DIAS_ANTICIPACION_MINIMA,
  contarDiasHabiles,
  calcularSaldo,
  validarFechas,
  verificarAntiguedad,
  buscarProblemas,
} = require("../utils/solicitudesVacacion");

async function verificarEmpleado(idEmpleado) {
  const empleado = UUID_RE.test(idEmpleado) ? await empleados.obtener(idEmpleado) : null;
  if (!empleado) throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");
  if (empleado.activo !== true) {
    throw new ErrorApp(403, "El empleado no está activo, por lo que no puede solicitar vacaciones.");
  }
  if (!empleado.fecha_ingreso) throw new ErrorApp(503, "No se pudo obtener la fecha de ingreso del empleado.");
  return empleado;
}

async function leerSaldo(empleado, db) {
  const [hoy, movimientos] = await Promise.all([modelo.hoy(db), modelo.listarMovimientos(empleado.id_empleado, db)]);
  return calcularSaldo({ fechaIngreso: empleado.fecha_ingreso, hoy, movimientos });
}

async function evaluar(empleado, { fechaInicio, fechaFin }, db) {
  const saldo = await leerSaldo(empleado, db);
  verificarAntiguedad(saldo);
  const [feriados, turnos, solapadas] = await Promise.all([
    modelo.listarFeriados(fechaInicio, fechaFin, db),
    modelo.listarTurnosPublicados(empleado.id_empleado, fechaInicio, fechaFin, db),
    modelo.listarSolapadas(empleado.id_empleado, fechaInicio, fechaFin, ESTADOS_EN_CURSO, db),
  ]);
  const calculo = contarDiasHabiles(fechaInicio, fechaFin, feriados, turnos);
  return { saldo, calculo, problemas: buscarProblemas({ fechaInicio, calculo, saldo, solapadas }) };
}

const describirEmpleado = ({ id_empleado, nombres, apellidos }, supervisor) => ({
  id_empleado,
  nombres,
  apellidos,
  supervisor: supervisor ?? null,
});

async function consultarSaldo(idEmpleado) {
  const empleado = await verificarEmpleado(idEmpleado);
  const [saldo, supervisor] = await Promise.all([leerSaldo(empleado), supervisores.obtenerSupervisor(idEmpleado)]);
  return {
    ...saldo,
    dias_anticipacion_minima: DIAS_ANTICIPACION_MINIMA,
    empleado: describirEmpleado(empleado, supervisor),
  };
}

async function listarSolicitudes(idEmpleado) {
  await verificarEmpleado(idEmpleado);
  return modelo.listarPorEmpleado(idEmpleado);
}

// Vista previa para el formulario: días hábiles y los problemas que impedirían enviar.
async function calcular(idEmpleado, datos) {
  const fechas = validarFechas(datos);
  const empleado = await verificarEmpleado(idEmpleado);
  const { saldo, calculo, problemas } = await evaluar(empleado, fechas);
  return { ...calculo, dias_disponibles: saldo.dias_disponibles, problemas };
}

async function registrarSolicitud(idEmpleado, datos) {
  const fechas = validarFechas(datos);
  const empleado = await verificarEmpleado(idEmpleado);
  const supervisor = await supervisores.obtenerSupervisor(idEmpleado);

  const solicitud = await modelo.enTransaccionDeEmpleado(idEmpleado, async (db) => {
    const { calculo, problemas } = await evaluar(empleado, fechas, db);
    if (problemas.length > 0) throw new ErrorApp(409, problemas[0].mensaje, problemas);
    return modelo.registrar(
      { idEmpleado, ...fechas, diasHabiles: calculo.dias_habiles, idSupervisor: supervisor?.id_empleado ?? null },
      db
    );
  });

  const notificado = supervisor
    ? await notificaciones.avisarSolicitudVacaciones({ empleado, supervisor, solicitud })
    : false;
  if (notificado) await modelo.marcarNotificada(solicitud.id_solicitud);

  return {
    ...solicitud,
    supervisor_notificado: notificado,
    supervisor,
    aviso_notificacion: notificado
      ? null
      : supervisor
        ? "La solicitud quedó registrada, pero no se pudo notificar a su supervisor. Infórmele directamente."
        : "La solicitud quedó registrada, pero su cargo no tiene un supervisor directo asignado para notificar.",
  };
}

async function verificarResolutor(idResolutor) {
  const resolutor = UUID_RE.test(idResolutor) ? await empleados.obtener(idResolutor) : null;
  if (!resolutor) throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");
  if (resolutor.activo !== true) throw new ErrorApp(403, "El empleado no está activo, por lo que no puede resolver solicitudes.");
}

// Avisa al colaborador y deja constancia; si falla, la resolución sigue firme y el reintento periódico lo completa.
async function avisarResolucion(solicitud) {
  const idResolutor = solicitud.id_empleado_resolutor;
  const nombreResolutor = await empleados.obtenerNombre(idResolutor);
  const { aceptada, reintentable } = await notificaciones.notificarResolucion({
    solicitud,
    idResolutor,
    nombreResolutor,
    categoria: "VACACIONES",
  });
  if (aceptada || !reintentable) await modelo.marcarResolucionNotificada(solicitud.id_solicitud);
  return aceptada;
}

// KAN-53: el supervisor o RRHH aprueba o rechaza una solicitud de vacaciones pendiente.
// Aprobar debita definitivamente los días del saldo y sincroniza la indisponibilidad con Producción o Entregas;
// rechazar exige justificación y libera los días retenidos. Todo ocurre en una sola transacción.
async function resolverSolicitud(idResolutor, idSolicitud, datos) {
  await verificarResolutor(idResolutor);
  const { errores, decision, motivo } = validarResolucion(datos);
  if (errores.length > 0) throw new ErrorApp(400, "Datos de resolución inválidos", errores);

  const solicitud = UUID_RE.test(idSolicitud) ? await modelo.obtener(idSolicitud) : null;
  if (!solicitud) throw new ErrorApp(404, "Solicitud no encontrada");
  if (solicitud.id_empleado === idResolutor) throw new ErrorApp(403, "No puede resolver su propia solicitud.");
  const yaResuelta = () => new ErrorApp(409, `La solicitud ya fue resuelta (${solicitud.estado_nombre.toLowerCase()}).`);
  if (solicitud.estado_codigo !== "PENDIENTE") throw yaResuelta();

  const sincronizacion =
    decision === "APROBADA"
      ? await indisponibilidad.prepararEvento({
          solicitud,
          categoria: "VACACIONES",
          nombreResolutor: await empleados.obtenerNombre(idResolutor),
        })
      : null;

  const resuelta = await modelo.enTransaccionDeEmpleado(solicitud.id_empleado, async (db) => {
    const guardada = await modelo.resolver({ idSolicitud, idEstado: DECISIONES[decision], idResolutor, motivo }, db);
    if (guardada && sincronizacion) await sincronizacion.alResolver(db);
    return guardada;
  });
  if (!resuelta) throw yaResuelta();

  const actualizada = await modelo.obtener(idSolicitud);
  const notificada = await avisarResolucion(actualizada);
  return {
    ...actualizada,
    notificacion_enviada: notificada,
    eventos_sincronizacion: sincronizacion?.resultado.eventosRegistrados ?? 0,
  };
}

// Reintenta los avisos de resoluciones que NotificationService no alcanzó a confirmar.
async function reintentarAvisosPendientes(limite = 50) {
  const pendientes = await modelo.listarResolucionesSinNotificar(limite);
  let enviados = 0;
  for (const solicitud of pendientes) {
    if (await avisarResolucion(solicitud)) enviados += 1;
  }
  return { pendientes: pendientes.length, enviados };
}

module.exports = {
  consultarSaldo,
  listarSolicitudes,
  calcular,
  registrarSolicitud,
  resolverSolicitud,
  reintentarAvisosPendientes,
};

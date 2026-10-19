const pool = require('../../db/pool');
const memorandumsModel = require('../models/memorandumsModel');
const empleadosModel = require('../models/empleadosModel');
const notificacionesService = require('./notificacionesService');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');

// RF-39 (criterio 4): horas que tiene el colaborador para acusar recibo antes de que se alerte a RRHH.
const plazoAcuseHoras = () => Number(process.env.MEMORANDUM_PLAZO_ACUSE_HORAS) || 72;

// Destinatarios fijos de RRHH que reciben las alertas de vencimiento, además de quien emitió el memorándum.
const idsRrhhAlertas = () =>
  (process.env.MEMORANDUM_ALERTA_RRHH_IDS || '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

// Memorándums revisados por cada pasada del job; el resto queda para la siguiente.
const LOTE_REVISION = 50;

// Rutas del portal a las que llevan los avisos.
const ENLACE_MIS_MEMORANDUMS = '/comunicaciones/memorandums';
const ENLACE_SEGUIMIENTO = '/disciplina/acuses';

const NOMBRES_ESTADO_ACUSE = {
  PENDIENTE: 'Pendiente de acuse',
  RECIBIDO: 'Notificado y Recibido',
  VENCIDO: 'Sin acuse (plazo vencido)',
};

const fechaHoraBolivia = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz',
  dateStyle: 'long',
  timeStyle: 'short',
});

const claseMemo = (memo) => (memo.es_reconocimiento ? 'felicitación' : 'llamada de atención');

const conEstado = (memo) => ({ ...memo, estado_acuse_nombre: NOMBRES_ESTADO_ACUSE[memo.estado_acuse] });

// Criterio 1: alerta de alta prioridad en el portal y por correo, apenas se emite el memorándum.
// Nunca lanza: el memorándum ya quedó emitido y, si el aviso no llega, el job lo reintenta.
const notificarEmision = async (idMemorandum) => {
  try {
    return await withTransaction(async (client) => {
      const memo = await memorandumsModel.bloquearSinNotificar(client, idMemorandum);
      if (!memo) return false;

      const plazo = plazoAcuseHoras();
      const enviado = await notificacionesService.enviarAvisoPrioritario({
        idRemitente: memo.id_empleado_emisor,
        remitenteNombre: 'Recursos Humanos (memorándums)',
        idDestinatario: memo.id_empleado_receptor,
        asunto: `Memorándum ${memo.codigo_cite}: ${claseMemo(memo)}`,
        contenido:
          `Se emitió a su nombre el memorándum ${memo.codigo_cite} (${memo.tipo_nombre}): «${memo.asunto}». ` +
          `Ingrese a «Mis memorándums» en el portal para leerlo y acusar recibo. Tiene ${plazo} horas para hacerlo; ` +
          'vencido ese plazo, RR.HH. hará el seguimiento en persona.',
        enlace: ENLACE_MIS_MEMORANDUMS,
      });
      if (!enviado) return false;

      await memorandumsModel.marcarNotificado(client, idMemorandum, plazo);
      return true;
    });
  } catch (error) {
    console.error(`No se pudo registrar la notificación del memorándum ${idMemorandum}:`, error.message);
    return false;
  }
};

const verificarEmpleado = async (idEmpleado) => {
  const empleado = await empleadosModel.obtenerResumen(pool, idEmpleado);
  if (!empleado) throw new HttpError(403, 'El identificador no corresponde a un empleado registrado.');
  return empleado;
};

const listarRecibidos = async (idEmpleado) => {
  await verificarEmpleado(idEmpleado);
  const memorandums = (await memorandumsModel.listarRecibidos(pool, idEmpleado)).map(conEstado);
  return {
    memorandums,
    pendientes: memorandums.filter((memo) => !memo.acuse_recibo_firmado).length,
    plazo_horas: plazoAcuseHoras(),
  };
};

const noDisponible = () => new HttpError(404, 'El memorándum no existe o no está emitido a su nombre.');

// Criterio 2: el colaborador abre el memorándum; queda registrada la primera apertura.
const abrirRecibido = async (idEmpleado, idMemorandum) => {
  await verificarEmpleado(idEmpleado);
  return withTransaction(async (client) => {
    const memo = await memorandumsModel.bloquearRecibido(client, idMemorandum, idEmpleado);
    if (!memo || memo.estado_sancion !== 'EMITIDO') throw noDisponible();

    const fechaHoraApertura = await memorandumsModel.registrarApertura(client, idMemorandum);
    const { estado_sancion, ...visible } = memo;
    return conEstado({ ...visible, fecha_hora_apertura: fechaHoraApertura });
  });
};

// Criterio 3: guarda la marca de tiempo, la IP y el usuario, y deja el memorándum 'Notificado y Recibido'.
const acusarRecibo = async ({ idEmpleado, idUsuario, idMemorandum, ip, comentario }) => {
  await verificarEmpleado(idEmpleado);
  return withTransaction(async (client) => {
    const memo = await memorandumsModel.bloquearRecibido(client, idMemorandum, idEmpleado);
    if (!memo || memo.estado_sancion !== 'EMITIDO') throw noDisponible();
    if (memo.acuse_recibo_firmado) {
      throw new HttpError(
        409,
        `Ya acusó recibo de este memorándum (${fechaHoraBolivia.format(new Date(memo.fecha_hora_acuse))}).`
      );
    }

    const acuse = await memorandumsModel.registrarAcuse(client, idMemorandum, { ip, idUsuario, comentario });
    return { ...conEstado(acuse), codigo_cite: memo.codigo_cite };
  });
};

const listarSeguimiento = async (estadoAcuse) =>
  (await memorandumsModel.listarSeguimiento(pool, estadoAcuse)).map(conEstado);

// Criterio 4: avisa a quien emitió el memorándum (y a RRHH configurado) que el colaborador no acusó recibo.
const alertarRrhh = async (memo) => {
  const destinatarios = [...new Set([memo.id_empleado_emisor, ...idsRrhhAlertas()])];
  const resultados = await Promise.all(
    destinatarios.map((idDestinatario) =>
      notificacionesService.enviarAvisoPrioritario({
        idRemitente: notificacionesService.USUARIO_SISTEMA,
        remitenteNombre: 'Sistema de RR.HH. (alerta automática)',
        idDestinatario,
        asunto: `Sin acuse de recibo: memorándum ${memo.codigo_cite}`,
        contenido:
          `${memo.receptor_nombre} no acusó recibo del memorándum ${memo.codigo_cite} (${memo.tipo_nombre}): ` +
          `«${memo.asunto}». El plazo para acusar recibo venció el ${fechaHoraBolivia.format(new Date(memo.fecha_limite_acuse))}; ` +
          'realice el seguimiento presencial para formalizar la notificación.',
        enlace: ENLACE_SEGUIMIENTO,
      })
    )
  );
  // Basta con que alguien de RRHH la reciba: si el emisor ya no está activo, no se bloquea el seguimiento.
  return resultados.some(Boolean);
};

class AlertaNoEnviada extends Error {
  constructor(idMemorandum) {
    super(`No se pudo alertar a RRHH sobre el memorándum ${idMemorandum}.`);
    this.idMemorandum = idMemorandum;
  }
}

// Un memorándum por transacción: si la alerta no sale, el ROLLBACK lo deja PENDIENTE para la siguiente pasada.
const alertarSiguienteVencido = (excluir) =>
  withTransaction(async (client) => {
    const [idMemorandum] = await memorandumsModel.bloquearVencidos(client, 1, excluir);
    if (!idMemorandum) return null;

    const memo = await memorandumsModel.obtenerParaAviso(client, idMemorandum);
    if (!(await alertarRrhh(memo))) throw new AlertaNoEnviada(idMemorandum);
    return memorandumsModel.marcarVencido(client, idMemorandum);
  });

// Pasada del job: reintenta los avisos que no llegaron y alerta los acuses vencidos.
const procesarPendientes = async () => {
  let notificados = 0;
  for (const idMemorandum of await memorandumsModel.listarSinNotificar(pool, LOTE_REVISION)) {
    if (await notificarEmision(idMemorandum)) notificados += 1;
  }

  let alertados = 0;
  const fallidos = [];
  while (alertados + fallidos.length < LOTE_REVISION) {
    try {
      if (!(await alertarSiguienteVencido(fallidos))) break;
      alertados += 1;
    } catch (error) {
      // La alerta no salió: el memorándum sigue PENDIENTE y se reintenta en la siguiente pasada.
      if (!(error instanceof AlertaNoEnviada)) throw error;
      fallidos.push(error.idMemorandum);
    }
  }

  return { notificados, alertados, fallidos: fallidos.length };
};

module.exports = {
  notificarEmision,
  listarRecibidos,
  abrirRecibido,
  acusarRecibo,
  listarSeguimiento,
  procesarPendientes,
};

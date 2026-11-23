const pool = require('../../db/pool');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');
const modelo = require('../models/ascensosModel');
const postulacionesModel = require('../models/postulacionesModel');
const convocatoriasModel = require('../models/convocatoriasModel');
const contratosModel = require('../models/contratosModel');
const asignacionesModel = require('../models/asignacionesModel');
const { aplicarAsignacion } = require('./asignacionesService');
const { avisarAscenso } = require('./convocatoriasNotificacionService');

// KAN-84: formalización y registro del ascenso del postulante apto seleccionado en una convocatoria interna.
//  - Criterio 1: el empleado pasa al cargo convocado (con su nivel salarial y su jefe directo) en la sucursal de la
//    convocatoria, con el haber indicado y la fecha de vigencia indicada.
//  - Criterio 2: el cambio queda como adenda ASCENSO en CONTRATOS, el historial contractual del Kardex.
//  - Criterio 3: con vigencia futura, la adenda ya rige desde esa fecha (la planilla toma el haber por tramos de
//    vigencia del contrato) y el cambio de cargo lo aplica el job diario al llegar la fecha.
//  - Criterio 4: la convocatoria se cierra y se avisa al empleado promovido.

const ESTADO = { PROGRAMADO: 'PROGRAMADO', APLICADO: 'APLICADO' };
const DOCUMENTO_VACIO = {
  documento_adjunto_url: null,
  documento_nombre_original: null,
  documento_tipo_mime: null,
  documento_tamano_bytes: null,
  documento_hash_sha256: null,
};

const conflicto = (mensaje, codigo, extra = {}) => new HttpError(409, mensaje, { codigo, ...extra });
const errorDeCampo = (status, campo, mensaje, codigo) =>
  new HttpError(status, mensaje, { codigo, campos_faltantes: [], errores: [{ campo, mensaje }] });

// Único por construcción: una postulación tiene a lo sumo un ascenso (36 caracteres, el máximo es 40).
const numeroAdenda = (idPostulacion) => `ASC-${idPostulacion.replaceAll('-', '').toUpperCase()}`;

const justificacion = ({ convocatoria, empleado, cargo, observaciones }) =>
  [
    `Ascenso por la convocatoria interna «${convocatoria.titulo}»: de «${empleado.cargo_actual}» a «${cargo.nombre}» (nivel salarial ${cargo.nivel_salarial}).`,
    observaciones,
  ]
    .filter(Boolean)
    .join(' ');

const resolverRegistrador = async (db, idEmpleado) =>
  idEmpleado && (await convocatoriasModel.existeEmpleado(db, idEmpleado)) ? idEmpleado : null;

// Todas las reglas que impiden formalizar, antes de tocar nada.
const verificarFormalizable = async (client, { convocatoria, postulacion }) => {
  if (postulacion.estado_ascenso) throw conflicto('El ascenso de este postulante ya fue formalizado.', 'YA_FORMALIZADO');
  if (await modelo.obtenerFormalizadaDeConvocatoria(client, convocatoria.id_convocatoria)) {
    throw conflicto('Esta convocatoria ya tiene un ascenso formalizado: cubre una sola vacante.', 'CONVOCATORIA_RESUELTA');
  }
  if (postulacion.estado_postulacion !== 'APTO') {
    throw conflicto('Solo se formaliza el ascenso de un postulante apto.', 'POSTULANTE_NO_APTO');
  }

  const empleado = await modelo.obtenerEmpleado(client, postulacion.id_empleado);
  if (!empleado?.activo) throw conflicto('El postulante ya no es un empleado activo.', 'EMPLEADO_INACTIVO');
  if (empleado.id_cargo_actual === convocatoria.id_cargo) {
    throw conflicto(`${empleado.nombre_completo} ya ocupa el cargo convocado.`, 'MISMO_CARGO');
  }
  const programado = await modelo.obtenerProgramadoDeEmpleado(client, empleado.id_empleado);
  if (programado) {
    throw conflicto(
      `${empleado.nombre_completo} ya tiene un ascenso a «${programado.cargo}» programado para el ${programado.fecha_vigencia}.`,
      'ASCENSO_PROGRAMADO'
    );
  }

  const cargo = await modelo.obtenerCargo(client, convocatoria.id_cargo);
  if (!cargo?.esta_activo) throw conflicto(`El cargo «${cargo?.nombre ?? 'convocado'}» ya no está activo.`, 'CARGO_INACTIVO');
  const sucursal = await convocatoriasModel.buscarSucursalActiva(client, convocatoria.id_sucursal);
  if (!sucursal) throw conflicto('La sucursal de la convocatoria ya no está activa.', 'SUCURSAL_INACTIVA');
  const ocupantes = (
    await convocatoriasModel.listarOcupantesActivos(client, { idCargo: convocatoria.id_cargo, idSucursal: convocatoria.id_sucursal })
  ).filter((o) => o.id_empleado !== empleado.id_empleado);
  if (ocupantes.length > 0) {
    throw conflicto(
      `El cargo «${cargo.nombre}» ya no está vacante en ${sucursal.nombre}: lo ocupa ${ocupantes.map((o) => o.nombre_completo).join(', ')}.`,
      'CARGO_OCUPADO'
    );
  }
  return { empleado, cargo, sucursal };
};

// La adenda debe empezar después de la versión vigente del contrato y dentro de su plazo (mismas reglas que una
// adenda registrada a mano); el haber no puede bajar.
const prepararAdenda = async (client, { empleado, cargo, datos, hoy, idPostulacion }) => {
  const fechaVigencia = datos.fecha_vigencia ?? hoy;
  if (fechaVigencia < hoy) {
    throw errorDeCampo(400, 'fecha_vigencia', 'La fecha de vigencia del ascenso no puede ser anterior a hoy.', 'FECHA_PASADA');
  }

  const contrato = await contratosModel.obtenerVersionActual(client, empleado.id_empleado);
  if (!contrato) {
    throw conflicto(`${empleado.nombre_completo} no tiene un contrato registrado: registre primero su contrato.`, 'SIN_CONTRATO');
  }
  if (fechaVigencia <= contrato.fecha_vigencia) {
    throw errorDeCampo(
      409,
      'fecha_vigencia',
      `La fecha de vigencia debe ser posterior al ${contrato.fecha_vigencia}, inicio de la versión vigente del contrato ${contrato.numero_contrato}.`,
      'FECHA_ANTERIOR_A_CONTRATO'
    );
  }
  if (contrato.fecha_fin !== null && fechaVigencia > contrato.fecha_fin) {
    throw errorDeCampo(
      409,
      'fecha_vigencia',
      `El contrato ${contrato.numero_contrato} termina el ${contrato.fecha_fin}: renuévelo antes de formalizar un ascenso posterior.`,
      'FECHA_FUERA_DE_CONTRATO'
    );
  }

  const haberActual = Number(contrato.haber_mensual_pactado);
  const haber = datos.haber_mensual_pactado ?? Math.max(cargo.salario_base_referencial, haberActual);
  if (haber < haberActual) {
    throw errorDeCampo(
      409,
      'haber_mensual_pactado',
      `El haber del ascenso (Bs ${haber}) no puede ser menor al haber vigente (Bs ${haberActual}).`,
      'HABER_MENOR'
    );
  }

  const numero = datos.numero_contrato ?? numeroAdenda(idPostulacion);
  if (await contratosModel.existeNumero(client, numero)) {
    throw errorDeCampo(409, 'numero_contrato', `Ya existe un contrato o adenda con el número ${numero}.`, 'NUMERO_DUPLICADO');
  }
  return { contrato, fechaVigencia, haber, numero };
};

// Arma el aviso al promovido a partir de lo guardado (sirve al formalizar y al reintentar).
const avisar = async (idPostulacion, idRemitente) => {
  const postulacion = await postulacionesModel.obtener(pool, idPostulacion);
  const [convocatoria, empleado] = await Promise.all([
    convocatoriasModel.obtenerPorId(pool, postulacion.id_convocatoria),
    modelo.obtenerEmpleado(pool, postulacion.id_empleado),
  ]);
  const cargo = await modelo.obtenerCargo(pool, convocatoria.id_cargo);
  const resultado = await avisarAscenso(
    { id_empleado: postulacion.id_empleado, nombres: empleado.nombres, convocatoria, cargo, sucursal: convocatoria.sucursal, ascenso: postulacion.ascenso },
    { idRemitente }
  );
  if (!resultado.entregada) console.error(`[ascensos] No se avisó el ascenso ${idPostulacion}: ${resultado.error}`);
  await modelo.registrarNotificacion(pool, idPostulacion, resultado);
};

const respuesta = async (idPostulacion) => {
  const postulacion = await postulacionesModel.obtener(pool, idPostulacion);
  const convocatoria = await convocatoriasModel.obtenerPorId(pool, postulacion.id_convocatoria);
  const cargo = await modelo.obtenerCargo(pool, convocatoria.id_cargo);
  return {
    ...postulacion,
    convocatoria: { id_convocatoria: convocatoria.id_convocatoria, titulo: convocatoria.titulo, estado: convocatoria.estado },
    cargo_destino: {
      id_cargo: cargo.id_cargo,
      nombre: cargo.nombre,
      nivel_salarial: cargo.nivel_salarial,
      cargo_jefe_directo: cargo.cargo_jefe_directo,
    },
    sucursal_destino: { id_sucursal: convocatoria.id_sucursal, nombre: convocatoria.sucursal },
  };
};

const formalizar = async (idConvocatoria, idPostulacion, datos, { idEmpleado } = {}) => {
  const registrador = await resolverRegistrador(pool, idEmpleado);

  await withTransaction(async (client) => {
    const convocatoria = await modelo.bloquearConvocatoria(client, idConvocatoria);
    if (!convocatoria) throw new HttpError(404, 'No se encontró la convocatoria interna solicitada.');
    const postulacion = await modelo.bloquearPostulacion(client, idPostulacion);
    if (!postulacion || postulacion.id_convocatoria !== idConvocatoria) {
      throw new HttpError(404, 'No se encontró la postulación en esta convocatoria.');
    }

    const { empleado, cargo } = await verificarFormalizable(client, { convocatoria, postulacion });
    const hoy = await asignacionesModel.fechaActual(client);
    const { contrato, fechaVigencia, haber, numero } = await prepararAdenda(client, { empleado, cargo, datos, hoy, idPostulacion });

    const idContrato = await contratosModel.insertar(client, {
      id_empleado: empleado.id_empleado,
      id_tipo_contrato: contrato.id_tipo_contrato,
      id_tipo_jornada: contrato.id_tipo_jornada,
      numero_contrato: numero,
      fecha_vigencia: fechaVigencia,
      fecha_fin: contrato.fecha_fin,
      haber_mensual_pactado: haber,
      es_adenda: true,
      justificacion: justificacion({ convocatoria, empleado, cargo, observaciones: datos.observaciones }),
      tipo_modificacion: 'ASCENSO',
      id_contrato_anterior: contrato.id_contrato,
      documento: DOCUMENTO_VACIO,
      registrado_por: registrador,
      registrado_rol: 'admin',
    });

    const aplicarHoy = fechaVigencia <= hoy;
    if (aplicarHoy) {
      await aplicarAsignacion(client, {
        id_empleado: empleado.id_empleado,
        id_cargo: convocatoria.id_cargo,
        id_sucursal: convocatoria.id_sucursal,
        fecha_inicio: fechaVigencia,
      });
    }
    await modelo.registrarFormalizacion(client, idPostulacion, {
      estado: aplicarHoy ? ESTADO.APLICADO : ESTADO.PROGRAMADO,
      fecha_vigencia: fechaVigencia,
      haber_mensual_pactado: haber,
      id_contrato: idContrato,
      observaciones: datos.observaciones,
      formalizado_por: registrador,
    });
    await modelo.cerrarConvocatoria(client, idConvocatoria);
  }).catch((error) => {
    // Dos formalizaciones simultáneas de la misma convocatoria: el índice único deja pasar solo una.
    if (error.code === '23505') {
      throw conflicto('Esta convocatoria ya tiene un ascenso formalizado: cubre una sola vacante.', 'CONVOCATORIA_RESUELTA');
    }
    throw error;
  });

  // El aviso va después de confirmar: si NotificationService falla, el ascenso igual queda formalizado y se reintenta.
  await avisar(idPostulacion, registrador);
  return respuesta(idPostulacion);
};

const reintentarNotificacion = async (idConvocatoria, idPostulacion, { idEmpleado } = {}) => {
  const postulacion = await postulacionesModel.obtener(pool, idPostulacion);
  if (!postulacion || postulacion.id_convocatoria !== idConvocatoria) {
    throw new HttpError(404, 'No se encontró la postulación en esta convocatoria.');
  }
  if (!postulacion.ascenso) throw conflicto('El ascenso de este postulante todavía no se formalizó.', 'NO_FORMALIZADO');
  if (postulacion.ascenso.notificado_en) throw conflicto('El empleado ya fue notificado de su ascenso.', 'YA_NOTIFICADO');
  await avisar(idPostulacion, await resolverRegistrador(pool, idEmpleado));
  return respuesta(idPostulacion);
};

// Criterio 3: el job diario aplica el cambio de cargo de los ascensos cuya vigencia ya llegó. Cada uno en su propia
// transacción: si uno falla (p. ej. el cargo se desactivó), queda PROGRAMADO con el error y los demás siguen.
const aplicarUno = (idPostulacion) =>
  withTransaction(async (client) => {
    const postulacion = await modelo.bloquearPostulacion(client, idPostulacion);
    if (postulacion?.estado_ascenso !== ESTADO.PROGRAMADO) return false;
    const convocatoria = await modelo.bloquearConvocatoria(client, postulacion.id_convocatoria);
    const empleado = await modelo.obtenerEmpleado(client, postulacion.id_empleado);
    const yaAsignado = empleado.id_cargo_actual === convocatoria.id_cargo && empleado.id_sucursal_actual === convocatoria.id_sucursal;
    if (!yaAsignado) {
      await aplicarAsignacion(client, {
        id_empleado: postulacion.id_empleado,
        id_cargo: convocatoria.id_cargo,
        id_sucursal: convocatoria.id_sucursal,
        fecha_inicio: postulacion.fecha_vigencia_ascenso,
      });
    }
    await modelo.marcarAplicado(client, idPostulacion);
    return true;
  });

const aplicarProgramados = async () => {
  const resultado = { aplicados: [], fallidos: [] };
  for (const idPostulacion of await modelo.listarProgramadosVencidos(pool)) {
    try {
      if (await aplicarUno(idPostulacion)) resultado.aplicados.push(idPostulacion);
    } catch (error) {
      console.error(`[ascensos] No se pudo aplicar el ascenso ${idPostulacion}: ${error.message}`);
      await modelo.registrarErrorAplicacion(pool, idPostulacion, error.message);
      resultado.fallidos.push({ id_postulacion: idPostulacion, error: error.message });
    }
  }
  return resultado;
};

module.exports = { formalizar, reintentarNotificacion, aplicarProgramados, ESTADO };

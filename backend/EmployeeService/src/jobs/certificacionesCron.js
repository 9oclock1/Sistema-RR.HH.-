const cron = require('node-cron');
const pool = require('../../db/pool');
const capacitacionesModel = require('../models/capacitacionesModel');
const notificacionesService = require('../services/notificacionesService');

const EXPRESION_POR_DEFECTO = '0 8 * * *';
const DIAS_AVISO = capacitacionesModel.DIAS_AVISO_VENCIMIENTO;

const revisarCertificacionesPorVencer = async () => {
  const certificaciones = await capacitacionesModel.listarAlertasPendientes(pool, DIAS_AVISO);
  const resultado = {
    total: certificaciones.length,
    colaboradores_notificados: 0,
    fallidos: 0,
    rrhh_notificado: false,
    alertas_marcadas: 0,
  };

  if (certificaciones.length === 0) {
    console.log(`[certificaciones] No hay alertas pendientes de certificaciones que venzan en los próximos ${DIAS_AVISO} días.`);
    return resultado;
  }

  const alertados = [];
  const sinAviso = new Set();
  let simulado = false;
  for (const certificacion of certificaciones) {
    try {
      const respuesta = await notificacionesService.alertarColaborador(certificacion);
      simulado = simulado || Boolean(respuesta?.simulado);
      alertados.push(certificacion.id_capacitacion);
    } catch (error) {
      sinAviso.add(certificacion.id_capacitacion);
      console.error(`[certificaciones] No se pudo alertar a ${certificacion.empleado} (${certificacion.id_capacitacion})`, error.message);
    }
  }
  resultado.colaboradores_notificados = alertados.length;
  resultado.fallidos = sinAviso.size;

  try {
    const respuesta = await notificacionesService.alertarRRHH(certificaciones, DIAS_AVISO, sinAviso);
    simulado = simulado || Boolean(respuesta?.simulado);
    resultado.rrhh_notificado = true;
  } catch (error) {
    console.error('[certificaciones] No se pudo alertar a RRHH', error.message);
  }

  if (resultado.rrhh_notificado && !simulado) {
    await capacitacionesModel.marcarAlertasEnviadas(pool, alertados);
    resultado.alertas_marcadas = alertados.length;
  }

  console.log(
    `[certificaciones] ${resultado.total} por vencer: ${resultado.colaboradores_notificados} colaborador(es) alertado(s), ` +
      `${resultado.fallidos} fallido(s), RRHH ${resultado.rrhh_notificado ? 'alertado' : 'sin alertar'}, ` +
      `${resultado.alertas_marcadas} alerta(s) marcada(s) como enviada(s).`
  );
  return resultado;
};

const iniciarCronCertificaciones = () => {
  if (process.env.CRON_CERTIFICACIONES_ACTIVO === 'false') return null;

  const expresion = process.env.CRON_CERTIFICACIONES || EXPRESION_POR_DEFECTO;
  if (!cron.validate(expresion)) {
    console.error(`[certificaciones] Expresión cron inválida «${expresion}»; el job no se programó.`);
    return null;
  }

  const tarea = cron.schedule(
    expresion,
    async () => {
      try {
        await revisarCertificacionesPorVencer();
      } catch (error) {
        console.error('[certificaciones] Falló la revisión de certificaciones por vencer', error);
      }
    },
    { name: 'certificaciones-por-vencer', timezone: process.env.APP_TIMEZONE || 'America/La_Paz', noOverlap: true }
  );

  console.log(`[certificaciones] Revisión de vencimientos programada con «${expresion}».`);
  return tarea;
};

module.exports = { iniciarCronCertificaciones, revisarCertificacionesPorVencer };

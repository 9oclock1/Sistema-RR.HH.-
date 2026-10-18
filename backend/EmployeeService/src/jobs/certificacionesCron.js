const cron = require('node-cron');
const pool = require('../../db/pool');
const capacitacionesModel = require('../models/capacitacionesModel');
const notificacionesService = require('../services/notificacionesService');

const EXPRESION_POR_DEFECTO = '0 8 * * *';
const DIAS_AVISO = capacitacionesModel.DIAS_AVISO_VENCIMIENTO;

const revisarCertificacionesPorVencer = async () => {
  const certificaciones = await capacitacionesModel.listarQueVencenEn(pool, DIAS_AVISO);
  const resultado = { total: certificaciones.length, colaboradores_notificados: 0, fallidos: 0, rrhh_notificado: false };

  if (certificaciones.length === 0) {
    console.log(`[certificaciones] Ninguna certificación vence en ${DIAS_AVISO} días.`);
    return resultado;
  }

  for (const certificacion of certificaciones) {
    try {
      await notificacionesService.alertarColaborador(certificacion, DIAS_AVISO);
      resultado.colaboradores_notificados += 1;
    } catch (error) {
      resultado.fallidos += 1;
      console.error(`[certificaciones] No se pudo alertar a ${certificacion.empleado} (${certificacion.id_capacitacion})`, error.message);
    }
  }

  try {
    await notificacionesService.alertarRRHH(certificaciones, DIAS_AVISO);
    resultado.rrhh_notificado = true;
  } catch (error) {
    console.error('[certificaciones] No se pudo alertar a RRHH', error.message);
  }

  console.log(
    `[certificaciones] ${resultado.total} por vencer: ${resultado.colaboradores_notificados} colaborador(es) alertado(s), ` +
      `${resultado.fallidos} fallido(s), RRHH ${resultado.rrhh_notificado ? 'alertado' : 'sin alertar'}.`
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

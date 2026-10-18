const cron = require('node-cron');
const solicitudesService = require('../services/solicitudesServicioService');

const EXPRESION_POR_DEFECTO = '*/10 * * * *';

const iniciarCronReintentosCompras = () => {
  if (process.env.CRON_REINTENTOS_COMPRAS_ACTIVO === 'false') return null;

  const expresion = process.env.CRON_REINTENTOS_COMPRAS || EXPRESION_POR_DEFECTO;
  if (!cron.validate(expresion)) {
    console.error(`[compras] Expresión cron inválida «${expresion}»; los reintentos no se programaron.`);
    return null;
  }

  return cron.schedule(
    expresion,
    async () => {
      try {
        const { revisadas, enviadas } = await solicitudesService.reintentarPendientes();
        if (revisadas > 0) console.log(`[compras] Reintentos: ${enviadas} de ${revisadas} solicitud(es) publicadas.`);
      } catch (error) {
        console.error('[compras] Falló el reintento de solicitudes pendientes', error);
      }
    },
    { name: 'reintentos-solicitudes-compras', timezone: process.env.APP_TIMEZONE || 'America/La_Paz', noOverlap: true }
  );
};

module.exports = { iniciarCronReintentosCompras };

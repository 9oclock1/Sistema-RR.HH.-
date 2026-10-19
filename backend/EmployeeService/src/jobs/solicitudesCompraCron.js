const cron = require('node-cron');
const solicitudesService = require('../services/solicitudesServicioService');

const ZONA_HORARIA = () => process.env.APP_TIMEZONE || 'America/La_Paz';

const programar = ({ nombre, variableActivo, variableExpresion, expresionPorDefecto, tarea }) => {
  if (process.env[variableActivo] === 'false') return null;

  const expresion = process.env[variableExpresion] || expresionPorDefecto;
  if (!cron.validate(expresion)) {
    console.error(`[compras] Expresión cron inválida «${expresion}» en ${variableExpresion}; ${nombre} no se programó.`);
    return null;
  }

  return cron.schedule(
    expresion,
    async () => {
      try {
        await tarea();
      } catch (error) {
        console.error(`[compras] Falló ${nombre}`, error);
      }
    },
    { name: nombre, timezone: ZONA_HORARIA(), noOverlap: true }
  );
};

const iniciarCronReintentosCompras = () =>
  programar({
    nombre: 'reintentos-solicitudes-compras',
    variableActivo: 'CRON_REINTENTOS_COMPRAS_ACTIVO',
    variableExpresion: 'CRON_REINTENTOS_COMPRAS',
    expresionPorDefecto: '*/10 * * * *',
    tarea: async () => {
      const { revisadas, enviadas } = await solicitudesService.reintentarPendientes();
      if (revisadas > 0) console.log(`[compras] Reintentos: ${enviadas} de ${revisadas} solicitud(es) publicadas.`);
    },
  });

const iniciarCronRespuestaCompras = () =>
  programar({
    nombre: 'respuesta-simulada-compras',
    variableActivo: 'CRON_RESPUESTA_COMPRAS_ACTIVO',
    variableExpresion: 'CRON_RESPUESTA_COMPRAS',
    expresionPorDefecto: '* * * * *',
    tarea: async () => {
      const minutosPorEtapa = Number.parseInt(process.env.COMPRAS_SIMULADO_MINUTOS_POR_ETAPA, 10) || 1;
      const { revisadas, en_proceso, ordenes_emitidas } = await solicitudesService.simularRespuestasCompras({ minutosPorEtapa });
      if (revisadas > 0) {
        console.log(`[compras] Respuesta simulada: ${en_proceso} en proceso, ${ordenes_emitidas} orden(es) emitida(s).`);
      }
    },
  });

module.exports = { iniciarCronReintentosCompras, iniciarCronRespuestaCompras };

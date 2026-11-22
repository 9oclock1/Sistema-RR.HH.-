const cron = require('node-cron');
const convocatoriasService = require('../services/convocatoriasService');

const EXPRESION_POR_DEFECTO = '5 0 * * *';

const cerrarConvocatoriasVencidas = async () => {
  const cerradas = await convocatoriasService.cerrarVencidas();
  console.log(`[convocatorias] ${cerradas.length} convocatoria(s) cerrada(s) por vencimiento de su fecha de cierre.`);
  return cerradas;
};

const iniciarCronCierreConvocatorias = () => {
  if (process.env.CRON_CIERRE_CONVOCATORIAS_ACTIVO === 'false') return null;

  const expresion = process.env.CRON_CIERRE_CONVOCATORIAS || EXPRESION_POR_DEFECTO;
  if (!cron.validate(expresion)) {
    console.error(`[convocatorias] Expresión cron inválida «${expresion}»; el cierre automático no se programó.`);
    return null;
  }

  const ejecutar = async () => {
    try {
      await cerrarConvocatoriasVencidas();
    } catch (error) {
      console.error('[convocatorias] Falló el cierre automático de convocatorias vencidas', error);
    }
  };

  const tarea = cron.schedule(expresion, ejecutar, {
    name: 'cierre-convocatorias',
    timezone: process.env.APP_TIMEZONE || 'America/La_Paz',
    noOverlap: true,
  });
  ejecutar();

  console.log(`[convocatorias] Cierre automático de convocatorias vencidas programado con «${expresion}».`);
  return tarea;
};

module.exports = { iniciarCronCierreConvocatorias, cerrarConvocatoriasVencidas };

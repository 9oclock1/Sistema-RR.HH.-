const cron = require('node-cron');
const ascensosService = require('../services/ascensosService');

// KAN-84 (criterio 3): cada día aplica el cambio de cargo de los ascensos cuya fecha de vigencia ya llegó.
const EXPRESION_POR_DEFECTO = '10 0 * * *';

const aplicarAscensosProgramados = async () => {
  const { aplicados, fallidos } = await ascensosService.aplicarProgramados();
  console.log(`[ascensos] ${aplicados.length} ascenso(s) programado(s) aplicado(s); ${fallidos.length} con error.`);
  return { aplicados, fallidos };
};

const iniciarCronAscensosProgramados = () => {
  if (process.env.CRON_ASCENSOS_ACTIVO === 'false') return null;

  const expresion = process.env.CRON_ASCENSOS || EXPRESION_POR_DEFECTO;
  if (!cron.validate(expresion)) {
    console.error(`[ascensos] Expresión cron inválida «${expresion}»; la aplicación de ascensos programados no se programó.`);
    return null;
  }

  const ejecutar = async () => {
    try {
      await aplicarAscensosProgramados();
    } catch (error) {
      console.error('[ascensos] Falló la aplicación de ascensos programados', error);
    }
  };

  const tarea = cron.schedule(expresion, ejecutar, {
    name: 'ascensos-programados',
    timezone: process.env.APP_TIMEZONE || 'America/La_Paz',
    noOverlap: true,
  });
  // Al arrancar se ponen al día los que vencieron mientras el servicio estuvo detenido.
  ejecutar();

  console.log(`[ascensos] Aplicación de ascensos programados con «${expresion}».`);
  return tarea;
};

module.exports = { iniciarCronAscensosProgramados, aplicarAscensosProgramados };

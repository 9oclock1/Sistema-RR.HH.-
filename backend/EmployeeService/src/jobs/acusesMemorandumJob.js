const acusesMemorandumService = require('../services/acusesMemorandumService');

// RF-39 (criterio 4): cada cuánto se revisan los acuses vencidos y los avisos que no llegaron.
const intervaloMs = () => (Number(process.env.MEMORANDUM_REVISION_MINUTOS) || 15) * 60 * 1000;

let enCurso = false;

const revisar = async () => {
  // Una pasada lenta (NotificationService con demoras) no debe solaparse con la siguiente.
  if (enCurso) return;
  enCurso = true;
  try {
    const { notificados, alertados, fallidos } = await acusesMemorandumService.procesarPendientes();
    if (notificados || alertados || fallidos) {
      console.log(
        `Acuses de memorándums: ${notificados} aviso(s) reenviado(s), ${alertados} alerta(s) a RRHH, ${fallidos} alerta(s) por reintentar.`
      );
    }
  } catch (error) {
    console.error('Falló la revisión de acuses de memorándums:', error.message);
  } finally {
    enCurso = false;
  }
};

const iniciar = () => {
  const temporizador = setInterval(revisar, intervaloMs());
  temporizador.unref();
  revisar();
  return temporizador;
};

module.exports = { iniciar, revisar };

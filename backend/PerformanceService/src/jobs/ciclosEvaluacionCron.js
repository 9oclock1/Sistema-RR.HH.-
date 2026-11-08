const cron = require("node-cron");
const { procesar } = require("../services/procesoCiclosService");

const EXPRESION_POR_DEFECTO = "0 8 * * *";

function resumir(resultado) {
  const { activados, recordatorios, cerrados, cierres_fallidos: fallidos } = resultado;
  return (
    `${activados.length} ciclo(s) activado(s), ` +
    `${recordatorios.enviados} recordatorio(s) enviado(s) de ${recordatorios.evaluadores} (${recordatorios.fallidos} fallido(s)), ` +
    `${cerrados.length} ciclo(s) cerrado(s)` +
    (fallidos.length > 0 ? `, ${fallidos.length} cierre(s) fallido(s)` : "")
  );
}

async function ejecutar() {
  try {
    const resultado = await procesar();
    if (!resultado) {
      console.log("[ciclos] Ya hay otro proceso de ciclos en ejecución; se omite esta vuelta.");
      return;
    }
    console.log(`[ciclos] ${resumir(resultado)}.`);
  } catch (error) {
    console.error("[ciclos] Falló el proceso de ciclos de evaluación", error);
  }
}

// Corre una vez al arrancar el servicio (por si estuvo caído a la hora del job) y luego según CRON_CICLOS.
// CRON_CICLOS_ACTIVO=false lo desactiva, por ejemplo en entornos de prueba.
function iniciarCronCiclos() {
  if (process.env.CRON_CICLOS_ACTIVO === "false") return null;

  const expresion = process.env.CRON_CICLOS || EXPRESION_POR_DEFECTO;
  if (!cron.validate(expresion)) {
    console.error(`[ciclos] Expresión cron inválida «${expresion}»; el job no se programó.`);
    return null;
  }

  const tarea = cron.schedule(expresion, ejecutar, {
    name: "ciclos-evaluacion",
    timezone: process.env.APP_TIMEZONE || "America/La_Paz",
    noOverlap: true,
  });
  console.log(`[ciclos] Activación, recordatorios y cierre de ciclos programados con «${expresion}».`);
  ejecutar();
  return tarea;
}

module.exports = { iniciarCronCiclos, ejecutar };

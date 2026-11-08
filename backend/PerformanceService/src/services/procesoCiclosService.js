const pool = require("../config/db");
const modelo = require("../models/procesoCiclosModel");
const { hoy } = require("../models/evaluacionesModel");
const { enTransaccion } = require("../config/transaccion");
const { enviarRecordatorioEvaluaciones } = require("./recordatoriosExternos");
const { conLimite } = require("../utils/concurrencia");
const {
  DIAS_AVISO,
  agruparRecordatorios,
  armarAviso,
} = require("../utils/recordatoriosCiclo");

const AVISOS_SIMULTANEOS = 5;
const CLAVE_BLOQUEO = "ciclos_evaluacion_proceso";

// Solo un proceso a la vez (el cron y la ejecución manual podrían coincidir): el bloqueo es de sesión en PostgreSQL.
// Devuelve null si ya hay otro corriendo.
async function conBloqueo(trabajo) {
  const cliente = await pool.connect();
  try {
    const { rows } = await cliente.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS obtenido",
      [CLAVE_BLOQUEO],
    );
    if (!rows[0].obtenido) return null;
    try {
      return await trabajo();
    } finally {
      await cliente
        .query("SELECT pg_advisory_unlock(hashtext($1))", [CLAVE_BLOQUEO])
        .catch(() => {});
    }
  } finally {
    cliente.release();
  }
}

async function activar(dia) {
  const ciclos = await modelo.activarCiclos(dia);
  return ciclos.map((ciclo) => ciclo.nombre);
}

async function recordar(dia) {
  const grupos = agruparRecordatorios(
    await modelo.listarRecordatoriosPendientes(dia, DIAS_AVISO),
  );
  const resumen = {
    evaluadores: grupos.length,
    enviados: 0,
    fallidos: 0,
    evaluaciones_marcadas: 0,
  };

  await conLimite(grupos, AVISOS_SIMULTANEOS, async (grupo) => {
    try {
      const { entregado } = await enviarRecordatorioEvaluaciones({
        idRemitente: grupo.idRemitente,
        idEvaluador: grupo.idEvaluador,
        aviso: armarAviso(grupo),
      });
      if (!entregado) {
        resumen.fallidos += 1;
        return;
      }
      // Primero se espera y después se suma: `+= await` leería el contador antes de que otro aviso lo actualice.
      const marcadas = await modelo.marcarRecordatorios(grupo.idsEvaluaciones);
      resumen.enviados += 1;
      resumen.evaluaciones_marcadas += marcadas;
    } catch (error) {
      resumen.fallidos += 1;
      console.error(
        `[ciclos] No se pudo registrar el recordatorio del evaluador ${grupo.idEvaluador}:`,
        error.message,
      );
    }
  });
  return resumen;
}

async function cerrar(dia) {
  const vencidos = await modelo.listarCiclosVencidos(dia);
  const cerrados = [];
  const fallidos = [];
  for (const ciclo of vencidos) {
    try {
      const cierre = await enTransaccion((db) =>
        modelo.cerrarCiclo(db, ciclo.id_ciclo),
      );
      if (cierre) cerrados.push(cierre);
    } catch (error) {
      fallidos.push(ciclo.nombre);
      console.error(
        `[ciclos] No se pudo cerrar el ciclo «${ciclo.nombre}»:`,
        error.message,
      );
    }
  }
  return { cerrados, fallidos };
}

// Activa, recuerda y cierra. Cada paso se puede repetir sin efectos duplicados.
// Primero se activa y al final se cierra, así un ciclo que nunca llegó a activarse y ya venció también se cierra.
async function procesar() {
  return conBloqueo(async () => {
    const dia = await hoy();
    const activados = await activar(dia);
    const recordatorios = await recordar(dia);
    const { cerrados, fallidos } = await cerrar(dia);
    return {
      fecha: dia,
      activados,
      recordatorios,
      cerrados,
      cierres_fallidos: fallidos,
    };
  });
}

module.exports = { procesar, activar, recordar, cerrar };

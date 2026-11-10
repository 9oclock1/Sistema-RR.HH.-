const { nombreCompleto } = require("./evaluaciones");

// Criterio de aceptación: el aviso sale cuando faltan 3 días (o menos) para la fecha límite.
const DIAS_AVISO = 3;
const MAX_NOMBRES_EN_AVISO = 10;
const MAX_ASUNTO = 150;

// Un aviso por evaluador y ciclo, con todas sus evaluaciones sin enviar.
// El remitente es quien programó el ciclo.
function agruparRecordatorios(filas) {
  const grupos = new Map();
  for (const fila of filas) {
    const clave = `${fila.id_empleado_evaluador}|${fila.id_ciclo}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        idEvaluador: fila.id_empleado_evaluador,
        idRemitente: fila.id_empleado_creador,
        idCiclo: fila.id_ciclo,
        ciclo: fila.ciclo,
        fechaLimite: fila.fecha_limite,
        diasRestantes: fila.dias_restantes,
        evaluados: [],
        idsEvaluaciones: [],
      });
    }
    const grupo = grupos.get(clave);
    grupo.evaluados.push(nombreCompleto({ nombres: fila.nombres, apellidos: fila.apellidos }));
    grupo.idsEvaluaciones.push(fila.id_evaluacion);
  }
  return [...grupos.values()];
}

const formatearFecha = (fecha) => fecha.split("-").reverse().join("/");

function describirPlazo(dias) {
  if (dias <= 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  return `faltan ${dias} días`;
}

function armarAviso({ ciclo, fechaLimite, diasRestantes, evaluados }) {
  const cantidad = evaluados.length;
  const visibles = evaluados.slice(0, MAX_NOMBRES_EN_AVISO);
  const resto = cantidad - visibles.length;
  const lista = resto > 0 ? `${visibles.join(", ")} y ${resto} más` : visibles.join(", ");

  const asunto = `Recordatorio: evaluaciones pendientes del ciclo «${ciclo}»`;
  const contenido = [
    `Tiene ${cantidad} ${cantidad === 1 ? "evaluación de desempeño sin enviar" : "evaluaciones de desempeño sin enviar"} en el ciclo «${ciclo}».`,
    `La fecha límite es el ${formatearFecha(fechaLimite)} (${describirPlazo(diasRestantes)}).`,
    `Colaboradores pendientes: ${lista}.`,
    "Complete y envíe las evaluaciones desde Desempeño > Evaluaciones antes de esa fecha: después ya no se podrán editar y quedarán vencidas.",
  ].join("\n");

  return { asunto: asunto.length > MAX_ASUNTO ? `${asunto.slice(0, MAX_ASUNTO - 1)}…` : asunto, contenido };
}

module.exports = { DIAS_AVISO, agruparRecordatorios, armarAviso };

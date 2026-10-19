const { minutosDuracion } = require("./jornada");

const DESCANSO_MINIMO_HORAS = 11;

const TIPO_ALERTA = { SOLAPAMIENTO: "SOLAPAMIENTO", DESCANSO_INSUFICIENTE: "DESCANSO_INSUFICIENTE" };

const aMinutosDelDia = (hora) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

// Minutos desde el 1970-01-01 en hora local; Bolivia no tiene horario de verano.
const minutosDeFecha = (fecha) => Date.parse(`${fecha}T00:00:00Z`) / 60000;

// Inicio y fin del turno; si cruza la medianoche termina al día siguiente.
function intervaloTurno(fecha, turno) {
  const inicio = minutosDeFecha(fecha) + aMinutosDelDia(turno.hora_inicio);
  return { inicio, fin: inicio + minutosDuracion(turno) };
}

const fechaCorta = (fecha) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

function describirHoras(minutos) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

function crearAlerta(previo, actual, horasMinimas) {
  const separacion = actual.inicio - previo.fin;
  const anterior = `el turno ${previo.turno.nombre} del ${fechaCorta(previo.fecha)}`;
  const siguiente = `el turno ${actual.turno.nombre} del ${fechaCorta(actual.fecha)}`;
  const base = { id_empleado: actual.id_empleado, fecha: actual.fecha, fecha_anterior: previo.fecha };

  if (separacion < 0) {
    return {
      ...base,
      tipo: TIPO_ALERTA.SOLAPAMIENTO,
      minutos_descanso: 0,
      mensaje: `${siguiente[0].toUpperCase()}${siguiente.slice(1)} se superpone con ${anterior}.`,
    };
  }
  return {
    ...base,
    tipo: TIPO_ALERTA.DESCANSO_INSUFICIENTE,
    minutos_descanso: separacion,
    mensaje:
      separacion === 0
        ? `No hay descanso entre ${anterior} y ${siguiente} (mínimo ${horasMinimas} h).`
        : `Solo ${describirHoras(separacion)} de descanso entre ${anterior} y ${siguiente} (mínimo ${horasMinimas} h).`,
  };
}

// asignaciones: [{ id_empleado, fecha: "AAAA-MM-DD", turno: { nombre, hora_inicio, hora_fin } | null }]
// Un turno null es un descanso. Devuelve una alerta por cada turno que empieza
// antes de que termine el anterior o sin el descanso mínimo desde su fin.
function validarDescansos(asignaciones, { horasMinimas = DESCANSO_MINIMO_HORAS } = {}) {
  const minimo = horasMinimas * 60;
  const porEmpleado = new Map();
  for (const asignacion of asignaciones) {
    if (!asignacion.turno) continue;
    const lista = porEmpleado.get(asignacion.id_empleado) ?? [];
    lista.push({ ...asignacion, ...intervaloTurno(asignacion.fecha, asignacion.turno) });
    porEmpleado.set(asignacion.id_empleado, lista);
  }

  const alertas = [];
  for (const turnos of porEmpleado.values()) {
    turnos.sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);
    // Se compara con el turno que termina más tarde hasta ese punto.
    let previo = null;
    for (const actual of turnos) {
      if (previo && actual.inicio - previo.fin < minimo) alertas.push(crearAlerta(previo, actual, horasMinimas));
      if (!previo || actual.fin > previo.fin) previo = actual;
    }
  }
  return alertas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id_empleado.localeCompare(b.id_empleado));
}

module.exports = { DESCANSO_MINIMO_HORAS, TIPO_ALERTA, intervaloTurno, validarDescansos, describirHoras };

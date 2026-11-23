// KAN-83: estado de cada curso del plan de ascenso y avance del candidato, calculados contra el Kardex.

const ESTADO_CURSO = { CUMPLIDO: 'CUMPLIDO', PENDIENTE: 'PENDIENTE' };

// Fecha AAAA-MM-DD menos `meses` meses calendario (si el día no existe en el mes de llegada, se usa el último).
function restarMeses(fecha, meses) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const indice = anio * 12 + (mes - 1) - meses;
  const anioDestino = Math.floor(indice / 12);
  const mesDestino = (indice % 12) + 1;
  const ultimoDia = new Date(Date.UTC(anioDestino, mesDestino, 0)).getUTCDate();
  return `${anioDestino}-${String(mesDestino).padStart(2, '0')}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`;
}

// Criterios 1 y 2: un curso está cumplido si el Kardex tiene un certificado de ese curso que sigue vigente y, cuando el
// cargo exige que sea reciente (meses_validez_requerida), emitido dentro de ese plazo. Si no, queda pendiente y se
// explica por qué.
function estadoCurso({ fecha_emision: emision, fecha_vencimiento: vencimiento, meses_validez_requerida: meses }, hoy) {
  if (!emision) return { estado: ESTADO_CURSO.PENDIENTE, motivo: 'Sin registro en el Kardex.' };
  if (vencimiento && vencimiento < hoy) {
    return { estado: ESTADO_CURSO.PENDIENTE, motivo: `El certificado venció el ${vencimiento}: debe renovarlo.` };
  }
  if (meses && emision < restarMeses(hoy, meses)) {
    return {
      estado: ESTADO_CURSO.PENDIENTE,
      motivo: `El cargo exige un certificado de los últimos ${meses} meses y el registrado es del ${emision}.`,
    };
  }
  return { estado: ESTADO_CURSO.CUMPLIDO, motivo: null };
}

const aCurso = (fila, hoy) => ({
  id_curso: fila.id_curso,
  codigo: fila.codigo,
  nombre: fila.nombre,
  horas_academicas: fila.horas_academicas,
  es_obligatorio: fila.es_obligatorio,
  meses_validez_requerida: fila.meses_validez_requerida,
  ...estadoCurso(fila, hoy),
  certificado: fila.id_capacitacion
    ? {
        id_capacitacion: fila.id_capacitacion,
        institucion_emisora: fila.institucion_emisora,
        fecha_emision: fila.fecha_emision,
        fecha_vencimiento: fila.fecha_vencimiento,
      }
    : null,
});

// Criterio 4: el avance es el porcentaje de cursos obligatorios cumplidos (si el cargo solo tiene cursos opcionales,
// se mide sobre todos). Un plan sin cursos no existe: asignar exige que el cargo tenga capacitaciones requeridas.
function calcularAvance(cursos) {
  const base = cursos.some((c) => c.es_obligatorio) ? cursos.filter((c) => c.es_obligatorio) : cursos;
  const cumplidos = base.filter((c) => c.estado === ESTADO_CURSO.CUMPLIDO).length;
  return {
    cursos_requeridos: base.length,
    cursos_cumplidos: cumplidos,
    cursos_pendientes: base.length - cumplidos,
    porcentaje: base.length === 0 ? 0 : Math.round((cumplidos * 10000) / base.length) / 100,
  };
}

const pendientesDe = (cursos) =>
  cursos
    .filter((c) => c.estado === ESTADO_CURSO.PENDIENTE && (c.es_obligatorio || !cursos.some((x) => x.es_obligatorio)))
    .map(({ codigo, nombre, motivo }) => ({ codigo, nombre, motivo }));

// Criterio 3: texto de la advertencia al formalizar un ascenso con cursos pendientes.
function advertenciaPendientes(plan, pendientes) {
  const cantidad = pendientes.length;
  return (
    `${plan.empleado.nombre_completo} tiene ${cantidad} ${cantidad === 1 ? 'curso pendiente' : 'cursos pendientes'} ` +
    `del plan para «${plan.cargo_destino.nombre}»: ${pendientes.map((p) => p.nombre).join(', ')}.`
  );
}

module.exports = { ESTADO_CURSO, restarMeses, estadoCurso, aCurso, calcularAvance, pendientesDe, advertenciaPendientes };

const pool = require("../config/db");

// RF-73 (KAN-93): datos crudos para el dashboard de ausentismo y puntualidad. Reutiliza novedades_asistencia y
// marcajes, igual que reportes.model.js (RF-29), pero en minutos (no en días) porque KPI-04 se define sobre
// horas no laboradas / horas programadas, y agrupado también por día para el detalle de una sucursal (criterio 4).

// Por empleado: minutos no laborados por faltas (la columna minutos_programados de la novedad ya trae los
// minutos efectivos de esa jornada, ver utils/novedades.js), los marcajes de entrada fuera de la tolerancia
// (atraso, tipo 1, sin importar si luego se justificó: la tolerancia es un hecho físico, no administrativo) y
// sus minutos de atraso (KPI-06 del detalle, sin meta propia en el ticket).
async function totalizarIndicadores(ids, desde, hasta) {
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id_empleado,
            COALESCE(SUM(minutos_programados) FILTER (WHERE id_tipo_novedad = 2), 0)::int AS minutos_falta,
            COUNT(*) FILTER (WHERE id_tipo_novedad = 1)::int AS marcajes_fuera_tolerancia,
            COALESCE(SUM(minutos) FILTER (WHERE id_tipo_novedad = 1), 0)::int AS minutos_atraso
     FROM novedades_asistencia
     WHERE id_empleado = ANY($1::uuid[]) AND fecha_jornada BETWEEN $2 AND $3
     GROUP BY id_empleado`,
    [ids, desde, hasta]
  );
  return rows;
}

// Total de marcajes de entrada por empleado (denominador de KPI-05). Un día con más de una entrada (p. ej. un
// marcaje corregido) solo cuenta una vez por jornada, igual que reportes.model#listarDiasConEntrada.
async function totalizarMarcajesEntrada(ids, desde, hasta) {
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id_empleado, COUNT(DISTINCT fecha_jornada)::int AS entradas
     FROM marcajes
     WHERE id_tipo_marcaje = 1 AND id_empleado = ANY($1::uuid[]) AND fecha_jornada BETWEEN $2 AND $3
     GROUP BY id_empleado`,
    [ids, desde, hasta]
  );
  return rows;
}

// Criterio 4: faltas (justificadas/injustificadas) y atrasos por día, para el mapa de calor de una sucursal.
async function novedadesPorDia(ids, desde, hasta) {
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT fecha_jornada AS fecha,
            COUNT(*) FILTER (WHERE id_tipo_novedad = 2 AND id_estado_novedad = 1)::int AS faltas_injustificadas,
            COUNT(*) FILTER (WHERE id_tipo_novedad = 2 AND id_estado_novedad = 2)::int AS faltas_justificadas,
            COUNT(*) FILTER (WHERE id_tipo_novedad = 1)::int AS atrasos
     FROM novedades_asistencia
     WHERE id_empleado = ANY($1::uuid[]) AND fecha_jornada BETWEEN $2 AND $3
     GROUP BY fecha_jornada
     ORDER BY fecha_jornada`,
    [ids, desde, hasta]
  );
  return rows;
}

module.exports = { totalizarIndicadores, totalizarMarcajesEntrada, novedadesPorDia };

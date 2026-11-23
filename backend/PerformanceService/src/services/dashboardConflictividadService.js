const quejasModelo = require("../models/dashboardConflictividadModel");
const asistenciaExterna = require("./asistenciaExterna");
const empleadosExternos = require("./empleadosExternos");
const { leerFiltros, mesesDelPeriodo, calcularKpi03, calcularKpi06 } = require("../utils/dashboardConflictividad");

const SIN_AREA = "Sin área";
const SIN_SUCURSAL = "Sin sucursal";
const clave = (sucursal, area) => `${sucursal}|${area}`;

const grupoVacio = (sucursal, area) => ({ sucursal, area, plantilla: 0, empleados_activos: 0, minutos_atraso: 0, quejas: 0 });

function grupoDe(grupos, sucursal, area) {
  const s = sucursal ?? SIN_SUCURSAL;
  const a = area ?? SIN_AREA;
  if (!grupos.has(clave(s, a))) grupos.set(clave(s, a), grupoVacio(s, a));
  return grupos.get(clave(s, a));
}

// Criterio 1 y 2: KPI-03 y KPI-06 del alcance consultado, con su comparativo por área y sucursal.
// - KPI-03 cuenta las quejas de la sucursal (o de toda la empresa) sobre la plantilla activa de ese mismo alcance,
//   que da EmployeeService. No usa el personal del reporte de Asistencia porque, para un supervisor, ese reporte
//   trae solo a sus subordinados y el índice quedaba inflado (quejas de toda la sucursal / parte del personal).
// - KPI-06 suma los minutos de atraso de los empleados activos del reporte de Asistencia y divide entre ellos.
async function obtenerDashboard(consulta, identidad) {
  const filtros = leerFiltros(consulta);
  const reporteAsistencia = await asistenciaExterna.obtenerReporteAsistencia(filtros, identidad);

  // Asistencia ya resolvió el alcance por rol (criterio 3): si es un supervisor (o RRHH filtrando una
  // sucursal), esa misma sucursal acota las quejas y la plantilla.
  const idSucursalEfectivo = reporteAsistencia.filtros.sucursal?.id_sucursal ?? filtros.idSucursal;
  const alcance = { ...filtros, idSucursal: idSucursalEfectivo };
  const [filasQuejas, plantilla] = await Promise.all([
    quejasModelo.contarQuejasPorAreaYSucursal(alcance),
    empleadosExternos.listarPlantilla(alcance),
  ]);
  const meses = mesesDelPeriodo(filtros.desde, filtros.hasta);

  const grupos = new Map();
  const plantillaActiva = plantilla.filter((e) => e.activo);
  for (const e of plantillaActiva) grupoDe(grupos, e.sucursal, e.area).plantilla += 1;

  const asistenciaActiva = reporteAsistencia.empleados.filter((fila) => fila.empleado.activo);
  for (const fila of asistenciaActiva) {
    const grupo = grupoDe(grupos, fila.empleado.sucursal, fila.empleado.area);
    grupo.empleados_activos += 1;
    grupo.minutos_atraso += fila.minutos_retraso;
  }

  for (const fila of filasQuejas) grupoDe(grupos, fila.sucursal, fila.departamento).quejas += fila.quejas;

  const comparativo = [...grupos.values()]
    .map((g) => ({
      sucursal: g.sucursal,
      area: g.area,
      kpi_03: calcularKpi03({ quejas: g.quejas, empleadosActivos: g.plantilla, meses }),
      kpi_06: calcularKpi06({ minutosAtraso: g.minutos_atraso, empleadosActivos: g.empleados_activos, meses }),
    }))
    .sort((a, b) => a.sucursal.localeCompare(b.sucursal, "es") || a.area.localeCompare(b.area, "es"));

  const totalQuejas = filasQuejas.reduce((total, fila) => total + fila.quejas, 0);
  const totalMinutos = asistenciaActiva.reduce((total, fila) => total + fila.minutos_retraso, 0);

  return {
    filtros,
    alcance: reporteAsistencia.alcance,
    kpis: {
      indice_quejas: calcularKpi03({ quejas: totalQuejas, empleadosActivos: plantillaActiva.length, meses }),
      minutos_atraso: calcularKpi06({ minutosAtraso: totalMinutos, empleadosActivos: asistenciaActiva.length, meses }),
    },
    comparativo,
  };
}

module.exports = { obtenerDashboard };

const quejasModelo = require("../models/dashboardConflictividadModel");
const asistenciaExterna = require("./asistenciaExterna");
const { leerFiltros, calcularKpi03, calcularKpi06 } = require("../utils/dashboardConflictividad");

const SIN_AREA = "Sin área";
const SIN_SUCURSAL = "Sin sucursal";
const clave = (sucursal, area) => `${sucursal}|${area}`;

// Personal activo y minutos de atraso del periodo, por sucursal y área (viene de Asistencia).
function agruparAsistencia(empleados) {
  const grupos = new Map();
  for (const fila of empleados) {
    const sucursal = fila.empleado.sucursal ?? SIN_SUCURSAL;
    const area = fila.empleado.area ?? SIN_AREA;
    const grupo = grupos.get(clave(sucursal, area)) ?? { sucursal, area, empleados_activos: 0, minutos_atraso: 0, quejas: 0 };
    if (fila.empleado.activo) grupo.empleados_activos += 1;
    grupo.minutos_atraso += fila.minutos_retraso;
    grupos.set(clave(sucursal, area), grupo);
  }
  return grupos;
}

// Criterio 1 y 2: KPI-03 y KPI-06 del alcance consultado, con su comparativo por área y sucursal.
async function obtenerDashboard(consulta, identidad) {
  const filtros = leerFiltros(consulta);
  const reporteAsistencia = await asistenciaExterna.obtenerReporteAsistencia(filtros, identidad);

  // Asistencia ya resolvió el alcance por rol (criterio 3): si es un supervisor (o RRHH filtrando una
  // sucursal), reaprovecha esa misma sucursal para acotar las quejas, en vez de volver a averiguar a quién
  // supervisa cada quien.
  const idSucursalEfectivo = reporteAsistencia.filtros.sucursal?.id_sucursal ?? filtros.idSucursal;
  const filasQuejas = await quejasModelo.contarQuejasPorAreaYSucursal({ ...filtros, idSucursal: idSucursalEfectivo });

  const porGrupo = agruparAsistencia(reporteAsistencia.empleados);
  for (const fila of filasQuejas) {
    const sucursal = fila.sucursal ?? SIN_SUCURSAL;
    const area = fila.departamento ?? SIN_AREA;
    const grupo = porGrupo.get(clave(sucursal, area)) ?? { sucursal, area, empleados_activos: 0, minutos_atraso: 0, quejas: 0 };
    grupo.quejas += fila.quejas;
    porGrupo.set(clave(sucursal, area), grupo);
  }

  const comparativo = [...porGrupo.values()]
    .map((g) => ({
      sucursal: g.sucursal,
      area: g.area,
      kpi_03: calcularKpi03({ quejas: g.quejas, empleadosActivos: g.empleados_activos }),
      kpi_06: calcularKpi06({ minutosAtraso: g.minutos_atraso, empleadosActivos: g.empleados_activos }),
    }))
    .sort((a, b) => a.sucursal.localeCompare(b.sucursal, "es") || a.area.localeCompare(b.area, "es"));

  const totalQuejas = filasQuejas.reduce((total, fila) => total + fila.quejas, 0);
  const activos = reporteAsistencia.empleados.filter((fila) => fila.empleado.activo);
  const totalMinutos = reporteAsistencia.empleados.reduce((total, fila) => total + fila.minutos_retraso, 0);

  return {
    filtros,
    alcance: reporteAsistencia.alcance,
    kpis: {
      indice_quejas: calcularKpi03({ quejas: totalQuejas, empleadosActivos: activos.length }),
      minutos_atraso: calcularKpi06({ minutosAtraso: totalMinutos, empleadosActivos: activos.length }),
    },
    comparativo,
  };
}

module.exports = { obtenerDashboard };

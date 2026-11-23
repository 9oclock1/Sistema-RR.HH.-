const modelo = require("../models/dashboardAsistencia.model");
const programacion = require("../models/novedades.model");
const empleados = require("./empleados.service");
const { leerFiltros, resolverAlcance, personalDelAlcance } = require("./reportes.service");
const { minutosEfectivos } = require("../utils/jornada");

// RF-73 (KAN-93): KPI-04 (ausentismo) y KPI-05 (puntualidad), con su meta y semáforo según el ticket.
// KPI-04 = horas no laboradas por faltas / horas programadas. KPI-05 = marcajes de entrada dentro de la
// tolerancia / total de marcajes de entrada. El semáforo es el mismo para ambos: verde si cumple la meta,
// amarillo si está a menos del 10 % de ella, rojo si no la cumple.
const META_AUSENTISMO = 3;
const META_PUNTUALIDAD = 95;
const MARGEN_AMARILLO = 0.1;

const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null);

// `masBajoEsMejor` distingue KPI-04 (cumple si valor <= meta) de KPI-05 (cumple si valor >= meta).
function semaforo(valor, meta, masBajoEsMejor) {
  if (valor === null) return null;
  const cumple = masBajoEsMejor ? valor <= meta : valor >= meta;
  if (cumple) return "verde";
  const limiteAmarillo = masBajoEsMejor ? meta * (1 + MARGEN_AMARILLO) : meta * (1 - MARGEN_AMARILLO);
  const dentroDelMargen = masBajoEsMejor ? valor <= limiteAmarillo : valor >= limiteAmarillo;
  return dentroDelMargen ? "amarillo" : "rojo";
}

// KPI-06 (ver subtarea KAN-491 "minutos de atraso"): el ticket no le da meta ni semáforo propios, así que
// queda como indicador informativo del detalle, no como un tercer semáforo inventado.
function kpisDe({ minutosProgramados, minutosFalta, entradas, fueraTolerancia, minutosAtraso }) {
  const ausentismo = porcentaje(minutosFalta, minutosProgramados);
  const puntualidad = porcentaje(Math.max(0, entradas - fueraTolerancia), entradas);
  return {
    ausentismo: { valor: ausentismo, meta: META_AUSENTISMO, semaforo: semaforo(ausentismo, META_AUSENTISMO, true) },
    puntualidad: { valor: puntualidad, meta: META_PUNTUALIDAD, semaforo: semaforo(puntualidad, META_PUNTUALIDAD, false) },
    minutos_atraso: {
      total: minutosAtraso,
      promedio_por_atraso: fueraTolerancia > 0 ? Math.round((minutosAtraso / fueraTolerancia) * 10) / 10 : null,
    },
  };
}

function acumuladorVacio() {
  return { minutosProgramados: 0, minutosFalta: 0, entradas: 0, fueraTolerancia: 0, minutosAtraso: 0 };
}

function acumular(a, b) {
  return {
    minutosProgramados: a.minutosProgramados + b.minutosProgramados,
    minutosFalta: a.minutosFalta + b.minutosFalta,
    entradas: a.entradas + b.entradas,
    fueraTolerancia: a.fueraTolerancia + b.fueraTolerancia,
    minutosAtraso: a.minutosAtraso + b.minutosAtraso,
  };
}

// Minutos programados (jornada menos refrigerio) por empleado; los días de descanso no suman.
function sumarMinutosProgramados(turnos) {
  const minutos = new Map();
  for (const t of turnos) {
    if (t.descanso) continue;
    minutos.set(t.id_empleado, (minutos.get(t.id_empleado) ?? 0) + minutosEfectivos(t));
  }
  return minutos;
}

// Criterio 1 y 3: KPI-04/KPI-05 (con semáforo) del alcance consultado y su comparativo por sucursal.
async function generar(filtros, identidad) {
  const { ahora, hoy } = await programacion.momentoActual();
  const { desde, hasta, hastaEfectiva, idSucursal, idDepartamento } = leerFiltros(filtros, hoy);
  const alcance = await resolverAlcance(identidad);
  const personal = await personalDelAlcance(alcance, { idSucursal, idDepartamento });
  const ids = personal.map((e) => e.id_empleado);

  const [turnos, indicadoresNovedad, entradasPorEmpleado] = await Promise.all([
    ids.length > 0 ? programacion.listarProgramacion(desde, hastaEfectiva, ids) : [],
    modelo.totalizarIndicadores(ids, desde, hastaEfectiva),
    modelo.totalizarMarcajesEntrada(ids, desde, hastaEfectiva),
  ]);
  const minutosProgramadosDe = sumarMinutosProgramados(turnos);
  const indicadorDe = new Map(indicadoresNovedad.map((n) => [n.id_empleado, n]));
  const entradasDe = new Map(entradasPorEmpleado.map((n) => [n.id_empleado, n.entradas]));

  const acumuladoDe = (e) => {
    const n = indicadorDe.get(e.id_empleado);
    return {
      minutosProgramados: minutosProgramadosDe.get(e.id_empleado) ?? 0,
      minutosFalta: n?.minutos_falta ?? 0,
      entradas: entradasDe.get(e.id_empleado) ?? 0,
      fueraTolerancia: n?.marcajes_fuera_tolerancia ?? 0,
      minutosAtraso: n?.minutos_atraso ?? 0,
    };
  };

  // Comparativo por sucursal (criterio 3): se agrupa por la sucursal real de cada empleado, no por el filtro,
  // así que si el alcance trae varias (RRHH sin filtrar una sola) cada una aparece con sus propios KPI.
  const porSucursal = new Map();
  for (const e of personal) {
    const clave = e.id_sucursal ?? "sin-sucursal";
    const actual = porSucursal.get(clave) ?? {
      id_sucursal: e.id_sucursal,
      nombre: e.sucursal ?? "(sin sucursal)",
      acumulado: acumuladorVacio(),
    };
    actual.acumulado = acumular(actual.acumulado, acumuladoDe(e));
    porSucursal.set(clave, actual);
  }
  const comparativo_sucursales = [...porSucursal.values()]
    .map((s) => ({ id_sucursal: s.id_sucursal, sucursal: s.nombre, ...kpisDe(s.acumulado) }))
    .sort((a, b) => a.sucursal.localeCompare(b.sucursal, "es"));

  const total = personal.reduce((acc, e) => acumular(acc, acumuladoDe(e)), acumuladorVacio());

  // Criterio 4: con una sola sucursal en el alcance (el supervisor, o RRHH filtrando una), el detalle diario.
  const unaSolaSucursal = alcance.tipo === "SUPERVISOR" || Boolean(idSucursal);
  const detalle_diario = unaSolaSucursal && ids.length > 0 ? await modelo.novedadesPorDia(ids, desde, hastaEfectiva) : unaSolaSucursal ? [] : null;

  const sucursalConsultada = alcance.tipo === "SUPERVISOR" ? alcance.idSucursal : idSucursal;
  const [sucursal, area] = await Promise.all([
    sucursalConsultada ? empleados.obtenerSucursal(sucursalConsultada).catch(() => null) : null,
    idDepartamento ? empleados.obtenerArea(idDepartamento).catch(() => null) : null,
  ]);

  return {
    filtros: {
      desde,
      hasta,
      hasta_efectiva: hastaEfectiva,
      sucursal: sucursalConsultada ? { id_sucursal: sucursalConsultada, nombre: sucursal?.nombre ?? null } : null,
      area: idDepartamento ? { id_departamento: idDepartamento, nombre: area?.nombre ?? null } : null,
    },
    alcance:
      alcance.tipo === "SUPERVISOR"
        ? { tipo: "SUPERVISOR", supervisor: alcance.supervisor }
        : { tipo: "RRHH", supervisor: null },
    generado_en: ahora,
    kpis: kpisDe(total),
    comparativo_sucursales,
    detalle_diario,
  };
}

module.exports = { META_AUSENTISMO, META_PUNTUALIDAD, semaforo, kpisDe, generar };

const modelo = require("../models/reportes.model");
const programacion = require("../models/novedades.model");
const empleados = require("./empleados.service");
const horasExtra = require("./horasExtra.service");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { esFechaValida, sumarDias } = require("../utils/periodos");

// RF-29: reportes de asistencia, ausentismo y puntualidad por sucursal y área.
const DIAS_MAXIMOS = 366;
// Ven toda la empresa; el supervisor solo su sucursal y su dependencia directa (criterio 4).
const ROLES_RRHH = ["admin", "gerente"];
const ROL_SUPERVISOR = "supervisor";

const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null);

// Solo cuentan las jornadas cerradas: el reporte llega como máximo hasta ayer.
function leerFiltros({ id_sucursal, id_departamento, desde, hasta } = {}, hoy) {
  const ayer = sumarDias(hoy, -1);
  const fin = hasta || ayer;
  const inicio = desde || `${fin.slice(0, 8)}01`;
  const errores = [];
  if (!esFechaValida(inicio)) errores.push({ campo: "desde", mensaje: "Use el formato AAAA-MM-DD." });
  if (!esFechaValida(fin)) errores.push({ campo: "hasta", mensaje: "Use el formato AAAA-MM-DD." });
  if (errores.length === 0) {
    if (inicio > fin) errores.push({ campo: "desde", mensaje: "La fecha inicial no puede ser posterior a la final." });
    else if (sumarDias(inicio, DIAS_MAXIMOS - 1) < fin) {
      errores.push({ campo: "desde", mensaje: `Consulte como máximo ${DIAS_MAXIMOS} días.` });
    } else if (inicio > ayer) {
      errores.push({ campo: "desde", mensaje: "El reporte solo incluye jornadas cerradas: elija una fecha anterior a hoy." });
    }
  }
  if (id_sucursal && !UUID_RE.test(id_sucursal)) errores.push({ campo: "id_sucursal", mensaje: "Sucursal inválida." });
  if (id_departamento && !UUID_RE.test(id_departamento)) errores.push({ campo: "id_departamento", mensaje: "Área inválida." });
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return {
    desde: inicio,
    hasta: fin,
    hastaEfectiva: fin < ayer ? fin : ayer,
    idSucursal: id_sucursal?.toLowerCase() || null,
    idDepartamento: id_departamento?.toLowerCase() || null,
  };
}

// Quién consulta y qué personal puede ver. `rol` e `idEmpleado` llegan por cabecera hasta contar con autenticación.
async function resolverAlcance({ idEmpleado, rol } = {}) {
  const codigo = (rol || "").trim().toLowerCase();
  if (ROLES_RRHH.includes(codigo)) return { tipo: "RRHH" };
  if (codigo !== ROL_SUPERVISOR) {
    throw new ErrorApp(403, "Los reportes de asistencia están disponibles para RRHH y supervisores.");
  }
  if (!idEmpleado) throw new ErrorApp(401, "Identifíquese como supervisor para consultar los reportes.");
  if (!UUID_RE.test(idEmpleado)) throw new ErrorApp(400, "El identificador del supervisor no es válido.");

  const supervisor = await empleados.obtenerUbicacion(idEmpleado.toLowerCase());
  if (!supervisor) throw new ErrorApp(403, "El identificador no corresponde a un empleado registrado.");
  if (supervisor.activo === false) throw new ErrorApp(403, "Su acceso está deshabilitado: no puede consultar los reportes.");
  if (!supervisor.id_sucursal || !supervisor.id_cargo) {
    throw new ErrorApp(403, "No tiene una sucursal y un cargo asignados: no hay personal bajo su dependencia.");
  }
  return {
    tipo: "SUPERVISOR",
    supervisor: { id_empleado: supervisor.id_empleado, nombre_completo: supervisor.nombre_completo },
    idSucursal: supervisor.id_sucursal,
    cargos: new Set(await empleados.listarCargosSubordinados(supervisor.id_cargo)),
  };
}

// Personal visible según el alcance. El supervisor no puede pedir otra sucursal ni ver a quien no depende de él.
async function personalDelAlcance(alcance, { idSucursal, idDepartamento }) {
  if (alcance.tipo === "RRHH") {
    if (idSucursal) return empleados.listarPorArea(idSucursal, idDepartamento);
    const todos = await empleados.listarPersonal();
    return idDepartamento ? todos.filter((e) => e.id_departamento === idDepartamento) : todos;
  }
  if (idSucursal && idSucursal !== alcance.idSucursal) {
    throw new ErrorApp(403, "Solo puede consultar el personal de su sucursal.");
  }
  const personal = await empleados.listarPorArea(alcance.idSucursal, idDepartamento);
  return personal.filter(
    (e) => alcance.cargos.has(e.id_cargo) && e.id_empleado !== alcance.supervisor.id_empleado
  );
}

function contarProgramados(turnos) {
  const dias = new Map();
  for (const turno of turnos) {
    if (!turno.descanso) dias.set(turno.id_empleado, (dias.get(turno.id_empleado) ?? 0) + 1);
  }
  return dias;
}

// Días programados en que el empleado marcó entrada.
function contarAsistidos(turnos, entradas) {
  const programados = new Set(turnos.filter((t) => !t.descanso).map((t) => `${t.id_empleado}|${t.fecha}`));
  const dias = new Map();
  for (const { id_empleado, fecha } of entradas) {
    if (programados.has(`${id_empleado}|${fecha}`)) dias.set(id_empleado, (dias.get(id_empleado) ?? 0) + 1);
  }
  return dias;
}

const SIN_NOVEDADES = {
  atrasos: 0,
  minutos_retraso: 0,
  atrasos_justificados: 0,
  faltas_injustificadas: 0,
  faltas_justificadas: 0,
  salidas_anticipadas: 0,
  omisiones_salida: 0,
};
const SIN_EXTRA = { minutos_extra: 0, extra_por_revisar: 0 };

// Indicadores de un empleado (criterio 3) a partir de sus días programados, novedades y horas extra.
// `asistidos` son los días con marcaje de entrada; sin ese dato se estiman restando las faltas registradas.
function indicadores(diasProgramados, novedades = SIN_NOVEDADES, extra = SIN_EXTRA, asistidos = null) {
  const faltas = novedades.faltas_justificadas + novedades.faltas_injustificadas;
  const diasAsistidos = asistidos ?? Math.max(0, diasProgramados - faltas);
  return {
    dias_programados: diasProgramados,
    dias_asistidos: diasAsistidos,
    faltas_justificadas: novedades.faltas_justificadas,
    faltas_injustificadas: novedades.faltas_injustificadas,
    porcentaje_ausentismo: porcentaje(faltas, diasProgramados),
    atrasos: novedades.atrasos,
    minutos_retraso: novedades.minutos_retraso,
    atrasos_justificados: novedades.atrasos_justificados,
    porcentaje_puntualidad: porcentaje(Math.max(0, diasAsistidos - novedades.atrasos), diasAsistidos),
    salidas_anticipadas: novedades.salidas_anticipadas,
    omisiones_salida: novedades.omisiones_salida,
    minutos_extra: extra.minutos_extra,
    extra_por_revisar: extra.extra_por_revisar,
  };
}

const CAMPOS_SUMA = [
  "dias_programados",
  "dias_asistidos",
  "faltas_justificadas",
  "faltas_injustificadas",
  "atrasos",
  "minutos_retraso",
  "atrasos_justificados",
  "salidas_anticipadas",
  "omisiones_salida",
  "minutos_extra",
  "extra_por_revisar",
];

function totalizar(filas) {
  const totales = Object.fromEntries(CAMPOS_SUMA.map((c) => [c, filas.reduce((s, f) => s + f[c], 0)]));
  return {
    empleados: filas.length,
    ...totales,
    porcentaje_ausentismo: porcentaje(totales.faltas_justificadas + totales.faltas_injustificadas, totales.dias_programados),
    porcentaje_puntualidad: porcentaje(Math.max(0, totales.dias_asistidos - totales.atrasos), totales.dias_asistidos),
  };
}

async function nombreDe(buscar, id) {
  if (!id) return null;
  return (await buscar(id).catch(() => null))?.nombre ?? null;
}

// Criterio 1: consolidado por empleado de la sucursal, área y rango elegidos.
async function generar(filtros, identidad) {
  const { ahora, hoy } = await programacion.momentoActual();
  const { desde, hasta, hastaEfectiva, idSucursal, idDepartamento } = leerFiltros(filtros, hoy);
  const alcance = await resolverAlcance(identidad);
  const personal = await personalDelAlcance(alcance, { idSucursal, idDepartamento });
  const ids = personal.map((e) => e.id_empleado);

  // Las horas extra se calculan al pedirlas (igual que en su resumen); si falla, se informa lo ya calculado.
  if (ids.length > 0) {
    await horasExtra.calcular({ desde, hasta: hastaEfectiva, ids }).catch((error) => {
      console.error("Reporte de asistencia con horas extra sin recalcular:", error.message);
    });
  }
  const [turnos, novedades, extras, entradas] = await Promise.all([
    ids.length > 0 ? programacion.listarProgramacion(desde, hastaEfectiva, ids) : [],
    modelo.totalizarNovedades(ids, desde, hastaEfectiva),
    modelo.totalizarHorasExtra(ids, desde, hastaEfectiva),
    modelo.listarDiasConEntrada(ids, desde, hastaEfectiva),
  ]);
  const programados = contarProgramados(turnos);
  const asistidos = contarAsistidos(turnos, entradas);
  const novedadDe = new Map(novedades.map((n) => [n.id_empleado, n]));
  const extraDe = new Map(extras.map((h) => [h.id_empleado, h]));

  // Los inactivos aparecen solo si tuvieron turnos o novedades en el periodo.
  const filas = personal
    .filter((e) => e.activo || programados.has(e.id_empleado) || novedadDe.has(e.id_empleado))
    .map((e) => ({
      empleado: {
        id_empleado: e.id_empleado,
        nombre_completo: e.nombre_completo,
        cargo: e.cargo ?? null,
        area: e.area ?? null,
        sucursal: e.sucursal ?? null,
        activo: e.activo,
      },
      ...indicadores(
        programados.get(e.id_empleado) ?? 0,
        novedadDe.get(e.id_empleado),
        extraDe.get(e.id_empleado),
        asistidos.get(e.id_empleado) ?? 0
      ),
    }))
    .sort((a, b) => a.empleado.nombre_completo.localeCompare(b.empleado.nombre_completo, "es"));

  const sucursalConsultada = alcance.tipo === "SUPERVISOR" ? alcance.idSucursal : idSucursal;
  const [sucursal, area] = await Promise.all([
    nombreDe(empleados.obtenerSucursal, sucursalConsultada),
    nombreDe(empleados.obtenerArea, idDepartamento),
  ]);

  return {
    filtros: {
      desde,
      hasta,
      hasta_efectiva: hastaEfectiva,
      sucursal: sucursalConsultada ? { id_sucursal: sucursalConsultada, nombre: sucursal } : null,
      area: idDepartamento ? { id_departamento: idDepartamento, nombre: area } : null,
    },
    alcance:
      alcance.tipo === "SUPERVISOR"
        ? { tipo: "SUPERVISOR", supervisor: alcance.supervisor }
        : { tipo: "RRHH", supervisor: null },
    generado_en: ahora,
    totales: totalizar(filas),
    empleados: filas,
  };
}

// Filtros que puede usar quien consulta (criterio 4): el supervisor solo ve su sucursal y las áreas de su personal.
async function alcanceFiltros(identidad) {
  const alcance = await resolverAlcance(identidad);
  if (alcance.tipo === "RRHH") {
    const [sucursales, areas] = await Promise.all([empleados.listarSucursales(), empleados.listarAreas()]);
    return { tipo: "RRHH", supervisor: null, sucursal_fija: null, sucursales, areas, personal_a_cargo: null };
  }
  const [sucursal, personal] = await Promise.all([
    empleados.obtenerSucursal(alcance.idSucursal).catch(() => null),
    personalDelAlcance(alcance, {}),
  ]);
  const areas = new Map(personal.filter((e) => e.id_departamento).map((e) => [e.id_departamento, e.area]));
  return {
    tipo: "SUPERVISOR",
    supervisor: alcance.supervisor,
    sucursal_fija: alcance.idSucursal,
    sucursales: [{ id_sucursal: alcance.idSucursal, nombre: sucursal?.nombre ?? "Su sucursal" }],
    areas: [...areas].map(([id_departamento, nombre]) => ({ id_departamento, nombre })),
    personal_a_cargo: personal.filter((e) => e.activo).length,
  };
}

module.exports = { DIAS_MAXIMOS, leerFiltros, resolverAlcance, indicadores, totalizar, generar, alcanceFiltros };

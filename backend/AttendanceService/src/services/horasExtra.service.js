const pool = require("../config/db");
const modelo = require("../models/horasExtra.model");
const programacion = require("../models/novedades.model");
const empleados = require("./empleados.service");
const eventos = require("./eventos.service");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { esFechaValida, sumarDias } = require("../utils/periodos");
const { TIPO_EVENTO } = require("../utils/eventos");
const { horarioProgramado } = require("../utils/novedades");
const {
  ESTADO_HORAS_EXTRA,
  minutosMinimosExtra,
  segregarJornada,
  liquidarJornada,
  estadoInicial,
} = require("../utils/horasExtra");

const DIAS_MAXIMOS_CONSULTA = 92;
const DIAS_MAXIMOS_PERIODO = 62;
const CODIGOS_ESTADO = Object.keys(ESTADO_HORAS_EXTRA);

// Entrada y salida de cada jornada marcada (empleado y fecha de jornada).
function agruparJornadas(marcajes) {
  const jornadas = new Map();
  for (const m of marcajes) {
    const clave = `${m.id_empleado}|${m.fecha_jornada}`;
    if (!jornadas.has(clave)) jornadas.set(clave, { id_empleado: m.id_empleado, fecha: m.fecha_jornada });
    const jornada = jornadas.get(clave);
    if (m.tipo_codigo === "ENTRADA") jornada.entrada ??= m;
    else jornada.salida ??= m;
  }
  return [...jornadas.values()].filter((j) => j.entrada && j.salida);
}

// Fila de HORAS_JORNADA de una jornada con entrada y salida, con la copia de su turno programado.
function filaCalculo(jornada, turno, { esFeriado, minimo }) {
  const conTurno = turno && !turno.descanso;
  const horario = conTurno ? horarioProgramado(turno, jornada.fecha) : null;
  const calculo = segregarJornada(
    {
      entrada: jornada.entrada.fecha_hora_marcaje,
      salida: jornada.salida.fecha_hora_marcaje,
      inicioProgramado: horario && new Date(horario.inicioMs),
      finProgramado: horario && new Date(horario.finMs),
      minutosRefrigerio: conTurno ? turno.minutos_refrigerio : 0,
    },
    minimo
  );
  const { idEstado, aprobados } = estadoInicial(calculo);
  const pago = liquidarJornada(calculo, { aprobados: aprobados ?? 0, esFeriado });
  return {
    id_empleado: jornada.id_empleado,
    fecha_jornada: jornada.fecha,
    id_turno: conTurno ? turno.id_turno : null,
    id_rol: conTurno ? (turno.id_rol ?? null) : null,
    nombre_turno: conTurno ? turno.nombre_turno : null,
    inicio_programado: horario && new Date(horario.inicioMs),
    fin_programado: horario && new Date(horario.finMs),
    minutos_refrigerio: conTurno ? turno.minutos_refrigerio : 0,
    id_marcaje_entrada: jornada.entrada.id_marcaje,
    id_marcaje_salida: jornada.salida.id_marcaje,
    entrada_en: jornada.entrada.fecha_hora_marcaje,
    salida_en: jornada.salida.fecha_hora_marcaje,
    es_feriado: esFeriado,
    minutos_trabajados: calculo.minutos_trabajados,
    minutos_ordinarios: calculo.minutos_ordinarios,
    minutos_ordinarios_nocturnos: calculo.minutos_ordinarios_nocturnos,
    minutos_extra: calculo.minutos_extra,
    minutos_anticipados: calculo.minutos_anticipados,
    id_estado_horas_extra: idEstado,
    minutos_extra_aprobados: aprobados,
    ...pago,
  };
}

// Calcula las horas de las jornadas cerradas (con entrada y salida) del rango. `ids` NULL: todo el personal.
async function calcular({ desde, hasta, ids = null }) {
  const jornadas = agruparJornadas(await modelo.listarMarcajes(desde, hasta, ids));
  if (jornadas.length === 0) return 0;
  const idsEmpleados = [...new Set(jornadas.map((j) => j.id_empleado))];
  const [turnos, feriados] = await Promise.all([
    programacion.listarProgramacion(desde, hasta, idsEmpleados),
    modelo.listarFeriados(desde, hasta),
  ]);
  const turnoDe = new Map(turnos.map((t) => [`${t.id_empleado}|${t.fecha}`, t]));
  const esFeriado = new Set(feriados.map((f) => f.fecha));
  const minimo = minutosMinimosExtra();
  const filas = jornadas.map((j) =>
    filaCalculo(j, turnoDe.get(`${j.id_empleado}|${j.fecha}`), { esFeriado: esFeriado.has(j.fecha), minimo })
  );
  return modelo.guardarCalculos(filas);
}

function leerRango({ desde, hasta } = {}, hoy, maximo = DIAS_MAXIMOS_CONSULTA) {
  const fin = hasta || hoy;
  const inicio = desde || `${fin.slice(0, 8)}01`;
  const errores = [];
  if (!esFechaValida(inicio)) errores.push({ campo: "desde", mensaje: "Use el formato AAAA-MM-DD." });
  if (!esFechaValida(fin)) errores.push({ campo: "hasta", mensaje: "Use el formato AAAA-MM-DD." });
  if (errores.length === 0 && inicio > fin) {
    errores.push({ campo: "desde", mensaje: "La fecha inicial no puede ser posterior a la final." });
  } else if (errores.length === 0 && sumarDias(inicio, maximo - 1) < fin) {
    errores.push({ campo: "desde", mensaje: `Consulte como máximo ${maximo} días.` });
  }
  return { desde: inicio, hasta: fin, errores };
}

function leerFiltros({ id_sucursal, id_departamento, estado, ...rango } = {}, hoy, { sucursalObligatoria = true } = {}) {
  const { desde, hasta, errores } = leerRango(rango, hoy);
  if (!id_sucursal && sucursalObligatoria) errores.push({ campo: "id_sucursal", mensaje: "Seleccione la sucursal." });
  else if (id_sucursal && !UUID_RE.test(id_sucursal)) errores.push({ campo: "id_sucursal", mensaje: "Sucursal inválida." });
  if (id_departamento && !UUID_RE.test(id_departamento)) errores.push({ campo: "id_departamento", mensaje: "Área inválida." });
  const codigo = (estado || "TODAS").toUpperCase();
  const valido = codigo === "TODAS" || codigo === "CON_EXTRA" || CODIGOS_ESTADO.includes(codigo);
  if (!valido) errores.push({ campo: "estado", mensaje: `Use ${[...CODIGOS_ESTADO, "CON_EXTRA", "TODAS"].join(", ")}.` });
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);

  let estados = null;
  if (codigo === "CON_EXTRA") estados = CODIGOS_ESTADO.filter((c) => c !== "SIN_EXTRA").map((c) => ESTADO_HORAS_EXTRA[c]);
  else if (codigo !== "TODAS") estados = [ESTADO_HORAS_EXTRA[codigo]];
  return {
    desde,
    hasta,
    idSucursal: id_sucursal?.toLowerCase() || null,
    idDepartamento: id_departamento?.toLowerCase() || null,
    estados,
  };
}

const resumirEmpleado = (e, id) =>
  e
    ? { id_empleado: e.id_empleado, nombre_completo: e.nombre_completo, cargo: e.cargo ?? null, area: e.area ?? null }
    : { id_empleado: id, nombre_completo: "Empleado no encontrado", cargo: null, area: null };

const resumirJornada = (h, empleado) => ({
  id_horas_jornada: h.id_horas_jornada,
  empleado,
  fecha_jornada: h.fecha_jornada,
  feriado: h.es_feriado ? (h.nombre_feriado ?? "Feriado") : null,
  turno: h.inicio_programado
    ? {
        nombre: h.nombre_turno,
        inicio_programado: h.inicio_programado,
        fin_programado: h.fin_programado,
        minutos_refrigerio: h.minutos_refrigerio,
      }
    : null,
  entrada_en: h.entrada_en,
  salida_en: h.salida_en,
  minutos_trabajados: h.minutos_trabajados,
  minutos_ordinarios: h.minutos_ordinarios,
  minutos_ordinarios_nocturnos: h.minutos_ordinarios_nocturnos,
  minutos_extra: h.minutos_extra,
  minutos_anticipados: h.minutos_anticipados,
  estado: { codigo: h.estado_codigo, nombre: h.estado_nombre },
  minutos_extra_aprobados: h.minutos_extra_aprobados,
  pago: {
    minutos_extra_simples: h.minutos_extra_simples,
    minutos_extra_dobles: h.minutos_extra_dobles,
    minutos_extra_nocturnos: h.minutos_extra_nocturnos,
    minutos_feriado: h.minutos_feriado,
    minutos_nocturnos: h.minutos_nocturnos,
  },
  consolidada: h.id_periodo !== null,
  calculada_en: h.calculada_en,
});

const sumar = (filas, campo) => filas.reduce((total, f) => total + (f[campo] ?? 0), 0);

function resumirTotales(filas) {
  return {
    jornadas: filas.length,
    minutos_ordinarios: sumar(filas, "minutos_ordinarios"),
    minutos_nocturnos: sumar(filas, "minutos_nocturnos"),
    minutos_extra: sumar(filas, "minutos_extra"),
    minutos_anticipados: sumar(filas, "minutos_anticipados"),
    minutos_extra_aprobados: sumar(filas, "minutos_extra_aprobados"),
    minutos_extra_simples: sumar(filas, "minutos_extra_simples"),
    minutos_extra_dobles: sumar(filas, "minutos_extra_dobles"),
    minutos_feriado: sumar(filas, "minutos_feriado"),
    pendientes: filas.filter((f) => f.id_estado_horas_extra === ESTADO_HORAS_EXTRA.PENDIENTE).length,
  };
}

// Suma de los totales por empleado.
const sumarResumen = (filas) => ({
  ...resumirTotales([]),
  ...Object.fromEntries(
    ["jornadas", ...Object.keys(resumirTotales([])).filter((c) => c.startsWith("minutos_")), "pendientes"].map((c) => [
      c,
      sumar(filas, c),
    ])
  ),
});

// Desglose por jornada del personal de una sucursal (y área): horas ordinarias, nocturnas y extra.
async function listar(filtros) {
  const { hoy } = await modelo.momentoActual();
  const { desde, hasta, idSucursal, idDepartamento, estados } = leerFiltros(filtros, hoy);
  const personal = await empleados.listarPorArea(idSucursal, idDepartamento);
  const porId = new Map(personal.map((e) => [e.id_empleado, e]));
  const ids = [...porId.keys()];
  if (ids.length > 0) await calcular({ desde, hasta, ids });

  const todas = ids.length > 0 ? await modelo.listar(ids, desde, hasta) : [];
  const filas = estados ? todas.filter((h) => estados.includes(h.id_estado_horas_extra)) : todas;
  return {
    desde,
    hasta,
    resumen: resumirTotales(todas),
    jornadas: filas.map((h) => resumirJornada(h, resumirEmpleado(porId.get(h.id_empleado), h.id_empleado))),
  };
}

// Personal de la sucursal (o de toda la empresa) con sus nombres; sin EmployeeService se informa igual por id.
async function personalDe(idSucursal, idDepartamento) {
  if (idSucursal) return empleados.listarPorArea(idSucursal, idDepartamento);
  return empleados.listarPersonal().catch((error) => {
    console.error("Resumen de horas sin nombres, no se obtuvo el personal:", error.message);
    return [];
  });
}

const filaResumen = (t, empleado) => ({
  empleado,
  jornadas: t.jornadas,
  minutos_ordinarios: t.minutos_ordinarios,
  minutos_nocturnos: t.minutos_nocturnos,
  minutos_extra: t.minutos_extra,
  minutos_anticipados: t.minutos_anticipados,
  minutos_extra_aprobados: t.minutos_extra_aprobados,
  minutos_extra_simples: t.minutos_extra_simples,
  minutos_extra_dobles: t.minutos_extra_dobles,
  minutos_feriado: t.minutos_feriado,
  pendientes: t.pendientes,
});

async function armarResumen(db, { desde, hasta, ids, porId }) {
  const totales = await modelo.totalizar(db, desde, hasta, ids);
  return totales
    .map((t) => filaResumen(t, resumirEmpleado(porId.get(t.id_empleado), t.id_empleado)))
    .sort((a, b) => a.empleado.nombre_completo.localeCompare(b.empleado.nombre_completo, "es"));
}

// Totales del periodo por empleado para planillas: horas extra simples, dobles y nocturnas.
async function resumen(filtros) {
  const { hoy } = await modelo.momentoActual();
  const { desde, hasta, idSucursal, idDepartamento } = leerFiltros(filtros, hoy, { sucursalObligatoria: false });
  const personal = await personalDe(idSucursal, idDepartamento);
  const porId = new Map(personal.map((e) => [e.id_empleado, e]));
  const ids = idSucursal ? [...porId.keys()] : null;
  if (!ids || ids.length > 0) await calcular({ desde, hasta, ids });
  const empleadosResumen = ids && ids.length === 0 ? [] : await armarResumen(pool, { desde, hasta, ids, porId });
  return { desde, hasta, empleados: empleadosResumen, totales: sumarResumen(empleadosResumen) };
}

const horas = (minutos) => (minutos / 60).toFixed(2).replace(".", ",");
const celda = (valor) => {
  const texto = String(valor ?? "");
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

// CSV para hojas de cálculo en español: separador punto y coma, decimales con coma y BOM para los acentos.
function aCsv({ desde, hasta, empleados: filas }) {
  const encabezado = [
    "Empleado",
    "Cargo",
    "Área",
    "Jornadas",
    "Horas ordinarias",
    "Horas nocturnas",
    "Horas extra simples",
    "Horas extra dobles (incluye feriados)",
    "Horas trabajadas en feriado",
    "Horas extra marcadas",
    "Horas extra aprobadas",
    "Jornadas por revisar",
  ];
  const lineas = filas.map((f) =>
    [
      f.empleado.nombre_completo,
      f.empleado.cargo,
      f.empleado.area,
      f.jornadas,
      horas(f.minutos_ordinarios),
      horas(f.minutos_nocturnos),
      horas(f.minutos_extra_simples),
      horas(f.minutos_extra_dobles),
      horas(f.minutos_feriado),
      horas(f.minutos_extra + f.minutos_anticipados),
      horas(f.minutos_extra_aprobados),
      f.pendientes,
    ]
      .map(celda)
      .join(";")
  );
  return {
    nombre: `horas-extra_${desde}_${hasta}.csv`,
    contenido: `﻿${[encabezado.map(celda).join(";"), ...lineas].join("\r\n")}\r\n`,
  };
}

async function verificarResponsable(idResponsable) {
  if (!UUID_RE.test(idResponsable ?? "")) throw new ErrorApp(401, "Identificación de empleado inválida.");
  const responsable = await empleados.obtener(idResponsable);
  if (!responsable) throw new ErrorApp(403, "El responsable no corresponde a un empleado registrado.");
  if (responsable.activo !== true) throw new ErrorApp(403, "El responsable no está activo.");
  return `${responsable.nombres} ${responsable.apellidos}`.trim();
}

const resumirPeriodo = (p) => ({
  id_periodo: p.id_periodo,
  fecha_inicio: p.fecha_inicio,
  fecha_fin: p.fecha_fin,
  cantidad_jornadas: p.cantidad_jornadas,
  responsable: { id_empleado: p.id_responsable, nombre_completo: p.nombre_responsable },
  consolidado_en: p.consolidado_en,
});

// Cierra un periodo ya terminado: sus jornadas dejan de cambiar y se envían los totales a compensaciones.
// No se puede cerrar con horas extra pendientes de revisión.
async function consolidar(idResponsable, cuerpo = {}) {
  const { hoy } = await modelo.momentoActual();
  const { desde, hasta, errores } = leerRango(
    { desde: cuerpo.desde ?? "", hasta: cuerpo.hasta ?? "" },
    hoy,
    DIAS_MAXIMOS_PERIODO
  );
  if (!cuerpo.desde) errores.unshift({ campo: "desde", mensaje: "Indique el primer día del periodo." });
  if (!cuerpo.hasta) errores.unshift({ campo: "hasta", mensaje: "Indique el último día del periodo." });
  else if (errores.length === 0 && hasta >= hoy) {
    errores.push({ campo: "hasta", mensaje: "Solo se consolidan días que ya terminaron: elija hasta ayer." });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Periodo inválido", errores);
  const nombreResponsable = await verificarResponsable(idResponsable);

  await calcular({ desde, hasta });
  const personal = await empleados.listarPersonal().catch(() => []);
  const porId = new Map(personal.map((e) => [e.id_empleado, e]));

  try {
    const { periodo, filas } = await enTransaccion(async (cliente) => {
      // Bloquea las jornadas del rango para que ninguna revisión cambie mientras se cierra.
      await cliente.query("SELECT 1 FROM horas_jornada WHERE fecha_jornada BETWEEN $1 AND $2 FOR UPDATE", [desde, hasta]);
      const pendientes = await modelo.contarPendientes(cliente, desde, hasta);
      if (pendientes > 0) {
        throw new ErrorApp(
          409,
          pendientes === 1
            ? "Queda 1 jornada con horas extra por revisar en el periodo."
            : `Quedan ${pendientes} jornadas con horas extra por revisar en el periodo.`
        );
      }
      const creado = await modelo.crearPeriodo(cliente, { desde, hasta, idResponsable, nombreResponsable });
      const cerrado = await modelo.cerrarJornadas(cliente, creado);
      const totales = await armarResumen(cliente, { desde, hasta, ids: null, porId });
      await eventos.registrarConsolidacion(cliente, {
        evento: TIPO_EVENTO.HORAS_EXTRA_CONSOLIDADAS,
        id_periodo: cerrado.id_periodo,
        fecha_inicio: desde,
        fecha_fin: hasta,
        consolidado_en: cerrado.consolidado_en,
        responsable: { id_empleado: idResponsable, nombre_completo: nombreResponsable },
        empleados: totales.map((t) => ({
          id_empleado: t.empleado.id_empleado,
          nombre_completo: t.empleado.nombre_completo,
          jornadas: t.jornadas,
          minutos_ordinarios: t.minutos_ordinarios,
          minutos_nocturnos: t.minutos_nocturnos,
          minutos_extra_simples: t.minutos_extra_simples,
          minutos_extra_dobles: t.minutos_extra_dobles,
          minutos_feriado: t.minutos_feriado,
        })),
      });
      return { periodo: cerrado, filas: totales };
    });
    return { ...resumirPeriodo(periodo), empleados: filas, totales: sumarResumen(filas) };
  } catch (error) {
    if (error.code === "23P01") throw new ErrorApp(409, "Ya hay un periodo consolidado que incluye alguno de esos días.");
    throw error;
  }
}

async function listarPeriodos() {
  return (await modelo.listarPeriodos()).map(resumirPeriodo);
}

module.exports = { calcular, listar, resumen, aCsv, consolidar, listarPeriodos };

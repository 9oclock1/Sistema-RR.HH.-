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
  MINUTOS_EXTRA_DIA,
  tipoDia,
  minutosMinimosExtra,
  segregarJornada,
  liquidarJornada,
  estadoInicial,
  validarRevision,
  validarAutorizacion,
  calculoDesdeFila,
  maximoAprobable,
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

// Fila de HORAS_JORNADA de una jornada con entrada y salida, con la copia de su turno programado
// y, si la hay, la autorización previa del día.
function filaCalculo(jornada, turno, { tipo, minimo, autorizacion = null }) {
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
  const { idEstado, aprobados } = estadoInicial(calculo, autorizacion);
  const pago = liquidarJornada(calculo, { aprobados: aprobados ?? 0, tipoDia: tipo });
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
    tipo_dia: tipo,
    minutos_trabajados: calculo.minutos_trabajados,
    minutos_ordinarios: calculo.minutos_ordinarios,
    minutos_ordinarios_nocturnos: calculo.minutos_ordinarios_nocturnos,
    minutos_extra: calculo.minutos_extra,
    minutos_anticipados: calculo.minutos_anticipados,
    id_estado_horas_extra: idEstado,
    minutos_extra_aprobados: aprobados,
    ...pago,
    id_autorizacion: autorizacion?.id_autorizacion ?? null,
  };
}

// Calcula las horas de las jornadas cerradas (con entrada y salida) del rango. `ids` NULL: todo el personal.
async function calcular({ desde, hasta, ids = null }) {
  const jornadas = agruparJornadas(await modelo.listarMarcajes(desde, hasta, ids));
  if (jornadas.length === 0) return 0;
  const idsEmpleados = [...new Set(jornadas.map((j) => j.id_empleado))];
  const [turnos, feriados, autorizaciones] = await Promise.all([
    programacion.listarProgramacion(desde, hasta, idsEmpleados),
    modelo.listarFeriados(desde, hasta),
    modelo.listarAutorizaciones(desde, hasta, idsEmpleados),
  ]);
  const turnoDe = new Map(turnos.map((t) => [`${t.id_empleado}|${t.fecha}`, t]));
  const autorizacionDe = new Map(autorizaciones.map((a) => [`${a.id_empleado}|${a.fecha_jornada}`, a]));
  const esFeriado = new Set(feriados.map((f) => f.fecha));
  const minimo = minutosMinimosExtra();
  const filas = jornadas.map((j) => {
    const clave = `${j.id_empleado}|${j.fecha}`;
    return filaCalculo(j, turnoDe.get(clave), {
      tipo: tipoDia(j.fecha, esFeriado.has(j.fecha)),
      minimo,
      autorizacion: autorizacionDe.get(clave),
    });
  });
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
  tipo_dia: h.tipo_dia,
  feriado: h.nombre_feriado ?? null,
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
  // Tope legal de lo aprobable: 2 h extra con turno; sin turno, la jornada de 8 h y 2 h extra.
  maximo_aprobable: maximoAprobable(calculoDesdeFila(h)),
  estado: { codigo: h.estado_codigo, nombre: h.estado_nombre },
  minutos_extra_aprobados: h.minutos_extra_aprobados,
  autorizacion: h.id_autorizacion
    ? {
        id_autorizacion: h.id_autorizacion,
        minutos_autorizados: h.minutos_autorizados,
        motivo: h.motivo_autorizacion,
        autorizador: { id_empleado: h.id_autorizador, nombre_completo: h.nombre_autorizador },
      }
    : null,
  revision: h.revisada_en
    ? {
        id_revisor: h.id_revisor,
        nombre_revisor: h.nombre_revisor,
        comentario: h.comentario_revision,
        revisada_en: h.revisada_en,
      }
    : null,
  pago: Object.fromEntries(CAMPOS_PAGO.map((c) => [c, h[c]])),
  consolidada: h.id_periodo !== null,
  calculada_en: h.calculada_en,
});

// Minutos a pagar de cada jornada, separados para planillas.
const CAMPOS_PAGO = [
  "minutos_extra_habil",
  "minutos_extra_domingo",
  "minutos_extra_feriado",
  "minutos_domingo",
  "minutos_feriado",
  "minutos_descanso",
  "minutos_extra_nocturnos",
  "minutos_nocturnos",
];
const CAMPOS_TOTALES = [
  "minutos_ordinarios",
  "minutos_nocturnos",
  "minutos_extra",
  "minutos_anticipados",
  "minutos_extra_aprobados",
  ...CAMPOS_PAGO.filter((c) => c !== "minutos_nocturnos"),
];

const sumar = (filas, campo) => filas.reduce((total, f) => total + (f[campo] ?? 0), 0);

function resumirTotales(filas) {
  return {
    jornadas: filas.length,
    ...Object.fromEntries(CAMPOS_TOTALES.map((c) => [c, sumar(filas, c)])),
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
  ...Object.fromEntries(CAMPOS_TOTALES.map((c) => [c, t[c]])),
  pendientes: t.pendientes,
});

async function armarResumen(db, { desde, hasta, ids, porId }) {
  const totales = await modelo.totalizar(db, desde, hasta, ids);
  return totales
    .map((t) => filaResumen(t, resumirEmpleado(porId.get(t.id_empleado), t.id_empleado)))
    .sort((a, b) => a.empleado.nombre_completo.localeCompare(b.empleado.nombre_completo, "es"));
}

// Totales del periodo por empleado para planillas: horas extra, domingos, feriados, descansos y nocturnas.
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
    "Horas extra en día hábil",
    "Horas trabajadas en domingo",
    "Horas extra en domingo",
    "Horas trabajadas en feriado",
    "Horas extra en feriado",
    "Horas trabajadas en descanso",
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
      horas(f.minutos_extra_habil),
      horas(f.minutos_domingo),
      horas(f.minutos_extra_domingo),
      horas(f.minutos_feriado),
      horas(f.minutos_extra_feriado),
      horas(f.minutos_descanso),
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

// Quien revisa, autoriza o consolida debe ser un empleado activo; devuelve su nombre para el registro.
async function verificarActivo(idEmpleado, quien = "El responsable") {
  if (!UUID_RE.test(idEmpleado ?? "")) throw new ErrorApp(401, "Identificación de empleado inválida.");
  const empleado = await empleados.obtener(idEmpleado);
  if (!empleado) throw new ErrorApp(403, `${quien} no corresponde a un empleado registrado.`);
  if (empleado.activo !== true) throw new ErrorApp(403, `${quien} no está activo.`);
  return `${empleado.nombres} ${empleado.apellidos}`.trim();
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
  const nombreResponsable = await verificarActivo(idResponsable);

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
          ...Object.fromEntries(CAMPOS_PAGO.filter((c) => c !== "minutos_nocturnos").map((c) => [c, t[c]])),
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

const noEncontrada = () => new ErrorApp(404, "Jornada no encontrada");

// Aprueba (lo marcado o con ajuste) o rechaza las horas extra de una jornada. Se puede corregir
// la decisión mientras el periodo no esté consolidado.
async function revisar(idHorasJornada, idRevisor, cuerpo) {
  if (!UUID_RE.test(idHorasJornada ?? "")) throw noEncontrada();
  const id = idHorasJornada.toLowerCase();
  const nombreRevisor = await verificarActivo(idRevisor, "El revisor");

  await enTransaccion(async (cliente) => {
    const fila = await modelo.bloquear(cliente, id);
    if (!fila) throw noEncontrada();
    if (fila.id_empleado === idRevisor) throw new ErrorApp(403, "No puede revisar sus propias horas extra.");
    if (fila.id_periodo) throw new ErrorApp(409, "La jornada ya se consolidó para planillas: no se puede modificar.");
    if (fila.id_estado_horas_extra === ESTADO_HORAS_EXTRA.SIN_EXTRA) {
      throw new ErrorApp(409, "La jornada no tiene horas extra por revisar.");
    }
    const calculo = calculoDesdeFila(fila);
    const { idEstado, aprobados, comentario } = validarRevision(cuerpo, calculo);
    const pago = liquidarJornada(calculo, { aprobados, tipoDia: fila.tipo_dia });
    await modelo.registrarRevision(cliente, id, { idEstado, aprobados, pago, idRevisor, nombreRevisor, comentario });
  });

  const fila = await modelo.obtener(pool, id);
  const empleado = { id_empleado: fila.id_empleado, nombre_completo: await empleados.obtenerNombre(fila.id_empleado) };
  return resumirJornada(fila, { ...empleado, cargo: null, area: null });
}

const resumirAutorizacion = (a, empleado = null) => ({
  id_autorizacion: a.id_autorizacion,
  id_empleado: a.id_empleado,
  ...(empleado && { empleado }),
  fecha_jornada: a.fecha_jornada,
  minutos_autorizados: a.minutos_autorizados,
  motivo: a.motivo,
  autorizador: { id_empleado: a.id_autorizador, nombre_completo: a.nombre_autorizador },
  creado_en: a.creado_en,
  actualizado_en: a.actualizado_en,
});

// Autorización previa de horas extra para un colaborador y un día (hoy o después).
async function autorizar(idAutorizador, cuerpo) {
  const { hoy } = await modelo.momentoActual();
  const datos = validarAutorizacion(cuerpo, hoy);
  const nombreAutorizador = await verificarActivo(idAutorizador, "Quien autoriza");
  if (datos.idEmpleado === idAutorizador) throw new ErrorApp(403, "No puede autorizar sus propias horas extra.");
  const colaborador = await empleados.obtener(datos.idEmpleado);
  if (!colaborador) throw new ErrorApp(404, "Colaborador no encontrado");
  if (datos.minutos > MINUTOS_EXTRA_DIA) {
    const [turno] = await programacion.listarProgramacion(datos.fecha, datos.fecha, [datos.idEmpleado]);
    if (turno && !turno.descanso) {
      throw new ErrorApp(400, "Datos de autorización inválidos", [
        {
          campo: "minutos_autorizados",
          mensaje: `Ese día tiene turno: autorice como máximo ${MINUTOS_EXTRA_DIA} minutos, la ley permite hasta 2 horas extra por día.`,
        },
      ]);
    }
  }

  const autorizacion = await modelo.guardarAutorizacion({ ...datos, idAutorizador, nombreAutorizador });
  // Si la jornada ya terminó (hoy, antes de la revisión), se aprueba con lo autorizado.
  await calcular({ desde: datos.fecha, hasta: datos.fecha, ids: [datos.idEmpleado] });
  return { ...resumirAutorizacion(autorizacion), creada: autorizacion.creada };
}

function leerFiltrosAutorizaciones({ id_sucursal, id_departamento, desde, hasta } = {}, hoy) {
  const inicio = desde || hoy;
  const rango = leerRango({ desde: inicio, hasta: hasta || (esFechaValida(inicio) ? sumarDias(inicio, 30) : inicio) }, hoy);
  const { errores } = rango;
  if (!id_sucursal) errores.push({ campo: "id_sucursal", mensaje: "Seleccione la sucursal." });
  else if (!UUID_RE.test(id_sucursal)) errores.push({ campo: "id_sucursal", mensaje: "Sucursal inválida." });
  if (id_departamento && !UUID_RE.test(id_departamento)) errores.push({ campo: "id_departamento", mensaje: "Área inválida." });
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return {
    desde: rango.desde,
    hasta: rango.hasta,
    idSucursal: id_sucursal.toLowerCase(),
    idDepartamento: id_departamento?.toLowerCase() || null,
  };
}

// Autorizaciones previas del personal de una sucursal (por defecto, de hoy a 30 días).
async function listarAutorizaciones(filtros) {
  const { hoy } = await modelo.momentoActual();
  const { desde, hasta, idSucursal, idDepartamento } = leerFiltrosAutorizaciones(filtros, hoy);
  const personal = await empleados.listarPorArea(idSucursal, idDepartamento);
  const porId = new Map(personal.map((e) => [e.id_empleado, e]));
  const lista = porId.size > 0 ? await modelo.listarAutorizaciones(desde, hasta, [...porId.keys()]) : [];
  return {
    desde,
    hasta,
    autorizaciones: lista.map((a) => resumirAutorizacion(a, resumirEmpleado(porId.get(a.id_empleado), a.id_empleado))),
  };
}

// Solo se anula la autorización de un día que todavía no pasó; la jornada vuelve a quedar pendiente.
async function eliminarAutorizacion(idAutorizacion, idSolicitante) {
  if (!UUID_RE.test(idAutorizacion ?? "")) throw new ErrorApp(404, "Autorización no encontrada");
  await verificarActivo(idSolicitante, "Quien anula");
  const { hoy } = await modelo.momentoActual();
  const autorizacion = await modelo.obtenerAutorizacion(idAutorizacion.toLowerCase());
  if (!autorizacion) throw new ErrorApp(404, "Autorización no encontrada");
  if (autorizacion.fecha_jornada < hoy) {
    throw new ErrorApp(409, "El día ya pasó: revise las horas extra de la jornada en lugar de anular la autorización.");
  }
  await modelo.eliminarAutorizacion(autorizacion.id_autorizacion);
  await calcular({ desde: autorizacion.fecha_jornada, hasta: autorizacion.fecha_jornada, ids: [autorizacion.id_empleado] });
}

module.exports = {
  calcular,
  listar,
  resumen,
  aCsv,
  consolidar,
  listarPeriodos,
  revisar,
  autorizar,
  listarAutorizaciones,
  eliminarAutorizacion,
};

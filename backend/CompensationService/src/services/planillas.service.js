const pool = require("../config/db");
const modelo = require("../models/planillas.model");
const externos = require("./externos.service");
const condiciones = require("./condiciones.service");
const bonosProductividad = require("./ventasProductividad.service");
const antiguedad = require("./antiguedad.service");
const anticiposModelo = require("../models/anticipos.model");
const empleadosCliente = require("../clients/empleados.cliente");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { hoyLaPaz } = require("../utils/fechas");
const { CAMPOS_MINUTOS, rangoPlanilla, tramoSinConsolidar, validarResponsable, consolidarPlanilla } = require("../utils/planillas");
const { antiguedadDelColaborador, calcularEmpleado } = require("../utils/calculo");

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const noEncontrada = () => new ErrorApp(404, "Planilla no encontrada");
const fechaCorta = (fecha) => fecha.split("-").reverse().join("/");
const nombreMes = (periodo) =>
  new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${periodo}-01T00:00:00Z`));
const yaAprobada = (periodo) =>
  new ErrorApp(409, `La planilla de ${nombreMes(periodo)} ya fue aprobada: no se puede volver a generar ni modificar.`);

const formatearPlanilla = (p) => ({
  id_planilla: p.id_planilla,
  periodo: p.periodo,
  fecha_inicio: p.fecha_inicio,
  fecha_fin: p.fecha_fin,
  datos_hasta: p.datos_hasta,
  estado: p.estado,
  colaboradores: p.colaboradores,
  advertencias: p.advertencias,
  generada: { por: { id_empleado: p.generada_por, nombre_completo: p.generada_por_nombre }, en: p.generada_en },
  aprobada: p.aprobada_en
    ? { por: { id_empleado: p.aprobada_por, nombre_completo: p.aprobada_por_nombre }, en: p.aprobada_en }
    : null,
  integraciones: { contabilidad: p.estado_contabilidad, pagos: p.estado_pagos },
  cerrada_en: p.cerrada_en,
});

const formatearEmpleado = (e) => ({
  id_planilla_empleado: e.id_planilla_empleado,
  empleado: {
    id_empleado: e.id_empleado,
    nombre_completo: e.nombre_empleado,
    numero_documento: e.numero_documento,
    cargo: e.cargo,
    area: e.area,
    sucursal: e.sucursal,
  },
  contrato: {
    id_contrato: e.id_contrato,
    numero_contrato: e.numero_contrato,
    haber_mensual: e.haber_mensual,
    desde: e.contrato_desde,
    hasta: e.contrato_hasta,
  },
  dias: {
    contrato: e.dias_contrato,
    faltas_injustificadas: e.faltas_injustificadas,
    licencia_sin_goce: e.dias_licencia_sin_goce,
    licencia_con_goce: e.dias_licencia_con_goce,
    pagados: e.dias_pagados,
  },
  atrasos: { cantidad: e.atrasos, minutos: e.minutos_atraso },
  minutos: Object.fromEntries(CAMPOS_MINUTOS.map((c) => [c.replace("minutos_", ""), e[c]])),
  novedades: e.novedades,
  observaciones: e.observaciones,
  // KAN-64: desglose de cada concepto con su base y su resultado.
  calculo: {
    ingresos: e.renglones.filter((r) => r.tipo === "INGRESO"),
    descuentos: e.renglones.filter((r) => r.tipo === "DESCUENTO"),
    aportes: e.renglones.filter((r) => r.tipo === "APORTE"),
    total_ganado: e.total_ganado,
    total_descuentos: e.total_descuentos,
    liquido_pagable: e.liquido_pagable,
    total_aportes: e.total_aportes,
  },
  alertas: e.alertas,
});

const sumar = (filas, valor) => filas.reduce((total, f) => total + valor(f), 0);
const sumarBs = (filas, valor) => Math.round(sumar(filas, (f) => Math.round(valor(f) * 100))) / 100;
const MINUTOS_EXTRA = ["extra_habil", "extra_domingo", "extra_feriado"];

function totalizar(empleados) {
  const novedades = empleados.flatMap((e) => e.novedades);
  return {
    total_ganado: sumarBs(empleados, (e) => e.calculo.total_ganado),
    total_descuentos: sumarBs(empleados, (e) => e.calculo.total_descuentos),
    liquido_pagable: sumarBs(empleados, (e) => e.calculo.liquido_pagable),
    total_aportes: sumarBs(empleados, (e) => e.calculo.total_aportes),
    con_alertas: empleados.filter((e) => e.alertas.length > 0).length,
    colaboradores: empleados.length,
    dias_pagados: sumar(empleados, (e) => e.dias.pagados),
    faltas_injustificadas: sumar(empleados, (e) => e.dias.faltas_injustificadas),
    dias_licencia_sin_goce: sumar(empleados, (e) => e.dias.licencia_sin_goce),
    minutos_atraso: sumar(empleados, (e) => e.atrasos.minutos),
    minutos_extra: sumar(empleados, (e) => sumar(MINUTOS_EXTRA, (c) => e.minutos[c])),
    bonos: novedades.length,
    bonos_monto_fijo: Math.round(sumar(novedades, (n) => n.monto ?? 0) * 100) / 100,
  };
}

async function listar({ periodo } = {}) {
  if (periodo !== undefined && !PERIODO_RE.test(periodo)) {
    throw new ErrorApp(400, "Filtros inválidos", [{ campo: "periodo", mensaje: "Use el formato AAAA-MM." }]);
  }
  return (await modelo.listar(periodo ?? null)).map(formatearPlanilla);
}

async function obtener(id) {
  const planilla = UUID_RE.test(id ?? "") ? await modelo.obtener(pool, id) : undefined;
  if (!planilla) throw noEncontrada();
  const empleados = (await modelo.listarEmpleados(id)).map(formatearEmpleado);
  return { ...formatearPlanilla(planilla), totales: totalizar(empleados), empleados };
}

// El responsable debe ser un colaborador activo de EmployeeService.
function responsableEn(personal, id) {
  const persona = personal.find((e) => String(e.id_empleado).toLowerCase() === id);
  if (!persona || persona.activo === false) {
    throw new ErrorApp(403, "El usuario elegido no corresponde a un colaborador activo.");
  }
  return persona.nombre_completo;
}

async function escalaDelMes(fecha) {
  try {
    return await antiguedad.obtenerEscalaVigente(fecha);
  } catch (error) {
    if (error.estado === 409) return null;
    throw error;
  }
}

async function fechasDeIngreso(empleados) {
  const resultados = await Promise.allSettled(empleados.map((e) => empleadosCliente.obtenerEmpleado(e.id_empleado)));
  return new Map(
    empleados.map((e, i) => [e.id_empleado, resultados[i].status === "fulfilled" ? resultados[i].value?.fecha_ingreso ?? null : null])
  );
}

// Criterio 1: consolida asistencia, horas extra, recargos, licencias y bonos del mes en una planilla borrador.
// Volver a generar un borrador reemplaza sus datos; una planilla aprobada ya no se genera.
async function generar(datos = {}, identidad = {}) {
  const idResponsable = validarResponsable(identidad);
  const periodo = datos.periodo;
  const rango = rangoPlanilla(periodo, hoyLaPaz());
  const existente = (await modelo.listar(periodo))[0];
  if (existente && existente.estado !== "BORRADOR") throw yaAprobada(periodo);

  const tramo = tramoSinConsolidar(await externos.listarPeriodosHorasExtra(), rango.desde, rango.datos_hasta);
  if (tramo) {
    throw new ErrorApp(
      409,
      `Consolide en Asistencia las horas extra del ${fechaCorta(tramo.desde)} al ${fechaCorta(tramo.hasta)} antes de generar la planilla.`
    );
  }

  const [personal, contratos, asistencia, horasExtra, licencias] = await Promise.all([
    externos.listarPersonal(),
    externos.listarContratos(rango.desde, rango.hasta),
    externos.resumirAsistencia(rango.desde, rango.datos_hasta),
    externos.resumirHorasExtra(rango.desde, rango.datos_hasta),
    externos.listarLicencias(rango.desde, rango.datos_hasta),
  ]);
  const nombreResponsable = responsableEn(personal, idResponsable);
  // Los bonos por condiciones especiales y por productividad se vuelven a procesar para reflejar las
  // jornadas, asignaciones y métricas de ventas actuales (RF-51).
  const [{ bonos: bonosCondicion }, { bonos: bonosProductividadDelMes }] = await Promise.all([
    condiciones.procesar({ periodo }),
    bonosProductividad.procesar({ periodo }),
  ]);
  const bonos = [...bonosCondicion, ...bonosProductividadDelMes];

  const consolidado = consolidarPlanilla({ personal, contratos, asistencia, horasExtra, licencias, bonos }, rango);
  const { advertencias } = consolidado;
  // KAN-64: haberes, descuentos y líquido de cada colaborador con los conceptos vigentes al cierre del mes.
  const conceptos = await modelo.conceptosVigentes(rango.hasta);
  const inicioMes = `${periodo}-01`;
  const [escala, cuotas, fechasIngreso] = await Promise.all([
    escalaDelMes(inicioMes),
    anticiposModelo.listarCuotasDelPeriodo(inicioMes),
    fechasDeIngreso(consolidado.empleados),
  ]);
  const empleados = consolidado.empleados.map((e) => {
    const fila = {
      ...e,
      antiguedad: antiguedadDelColaborador(escala, fechasIngreso.get(e.id_empleado), inicioMes),
      cuotas: cuotas.filter((c) => c.id_empleado === e.id_empleado),
    };
    return { ...e, ...calcularEmpleado(fila, conceptos) };
  });
  const cabecera = {
    periodo,
    fecha_inicio: rango.desde,
    fecha_fin: rango.hasta,
    datos_hasta: rango.datos_hasta,
    advertencias,
    generada_por: idResponsable,
    generada_por_nombre: nombreResponsable,
  };

  const { id, creada } = await enTransaccion(async (cliente) => {
    const actual = await modelo.bloquearPeriodo(cliente, periodo);
    if (actual && actual.estado !== "BORRADOR") throw yaAprobada(periodo);
    const idPlanilla = actual ? actual.id_planilla : await modelo.crear(cliente, cabecera);
    if (actual && !(await modelo.reemplazar(cliente, idPlanilla, cabecera))) throw yaAprobada(periodo);
    await modelo.guardarEmpleados(cliente, idPlanilla, empleados);
    return { id: idPlanilla, creada: !actual };
  });

  return { creada, planilla: await obtener(id) };
}

// Descarta un borrador. Una planilla aprobada no se elimina.
async function descartar(id, identidad = {}) {
  const idResponsable = validarResponsable(identidad);
  if (!UUID_RE.test(id ?? "")) throw noEncontrada();
  responsableEn(await externos.listarPersonal(), idResponsable);
  await enTransaccion(async (cliente) => {
    const planilla = await modelo.bloquear(cliente, id);
    if (!planilla) throw noEncontrada();
    const noSeDescarta = () =>
      new ErrorApp(409, `La planilla de ${nombreMes(planilla.periodo)} ya fue aprobada: no se puede descartar.`);
    if (planilla.estado !== "BORRADOR" || !(await modelo.eliminar(cliente, id))) throw noSeDescarta();
  });
}

// Criterio 2: el Administrador aprueba el borrador y la planilla queda bloqueada para edición.
// Solo se aprueba un mes completo, con datos hasta su último día y al menos un colaborador.
async function aprobar(id, identidad = {}) {
  const idResponsable = validarResponsable(identidad);
  if (!UUID_RE.test(id ?? "")) throw noEncontrada();
  const nombre = responsableEn(await externos.listarPersonal(), idResponsable);
  await enTransaccion(async (cliente) => {
    const planilla = await modelo.bloquear(cliente, id);
    if (!planilla) throw noEncontrada();
    const mes = nombreMes(planilla.periodo);
    if (planilla.estado !== "BORRADOR") throw new ErrorApp(409, `La planilla de ${mes} ya fue aprobada.`);
    if (planilla.datos_hasta < planilla.fecha_fin) {
      throw new ErrorApp(
        409,
        `La planilla de ${mes} tiene datos hasta el ${fechaCorta(planilla.datos_hasta)}: vuelva a generarla cuando termine el mes para aprobarla.`
      );
    }
    if ((await modelo.contarEmpleados(cliente, id)) === 0) {
      throw new ErrorApp(409, `La planilla de ${mes} no tiene colaboradores: no se puede aprobar.`);
    }
    // KAN-64, criterio 3: con alertas de inconsistencia no se aprueba.
    const conAlertas = await modelo.contarConAlertas(cliente, id);
    if (conAlertas > 0) {
      throw new ErrorApp(
        409,
        `La planilla de ${mes} tiene ${conAlertas === 1 ? "1 colaborador" : `${conAlertas} colaboradores`} con alertas de inconsistencia: corríjalas y vuelva a generarla.`
      );
    }
    if (!(await modelo.aprobar(cliente, id, { idEmpleado: idResponsable, nombre }))) {
      throw new ErrorApp(409, `La planilla de ${mes} ya fue aprobada.`);
    }
  });
  return obtener(id);
}

module.exports = { listar, obtener, generar, descartar, aprobar };

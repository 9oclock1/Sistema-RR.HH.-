const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { sumarDias, diaAnterior } = require("./fechas");
const { rangoPeriodo } = require("./condiciones");

// Mes comercial: un mes completo de contrato se paga como 30 días.
const DIAS_MES_COMERCIAL = 30;
const ROLES_PLANILLA = ["admin"];
const MAXIMO_NOMBRES = 5;

const CAMPOS_MINUTOS = [
  "minutos_extra_habil",
  "minutos_extra_domingo",
  "minutos_extra_feriado",
  "minutos_extra_nocturnos",
  "minutos_domingo",
  "minutos_feriado",
  "minutos_descanso",
  "minutos_nocturnos",
];

const fechaCorta = (fecha) => fecha.slice(5).split("-").reverse().join("/");
const redondear = (valor) => Math.round((valor + Number.EPSILON) * 100) / 100;
const diasEntre = (desde, hasta) => (Date.parse(hasta) - Date.parse(desde)) / 86400000 + 1;

// Días de [inicio, fin] que caen en [desde, hasta]; fin NULL = sin fecha de fin.
function diasEnComun(inicio, fin, desde, hasta) {
  const a = inicio > desde ? inicio : desde;
  const b = fin === null || fin > hasta ? hasta : fin;
  return a > b ? 0 : diasEntre(a, b);
}

// Mes a generar y último día con datos: en el mes en curso, hasta ayer.
function rangoPlanilla(periodo, hoy) {
  const rango = rangoPeriodo(periodo, hoy);
  const ayer = diaAnterior(hoy);
  const datosHasta = rango.hasta < ayer ? rango.hasta : ayer;
  if (datosHasta < rango.desde) {
    throw new ErrorApp(409, "El mes recién empieza: todavía no hay jornadas cerradas para la planilla.");
  }
  return { ...rango, datos_hasta: datosHasta, en_curso: datosHasta < rango.hasta };
}

// Primer tramo de días sin consolidar en Asistencia, o null si los periodos cubren todo el rango.
function tramoSinConsolidar(periodos, desde, hasta) {
  const ordenados = [...periodos].sort((a, b) => (a.fecha_inicio < b.fecha_inicio ? -1 : 1));
  let dia = desde;
  for (const p of ordenados) {
    if (p.fecha_fin < dia) continue;
    if (p.fecha_inicio > dia) break;
    dia = sumarDias(p.fecha_fin, 1);
    if (dia > hasta) return null;
  }
  const siguiente = ordenados.find((p) => p.fecha_inicio > dia && p.fecha_inicio <= hasta);
  return { desde: dia, hasta: siguiente ? diaAnterior(siguiente.fecha_inicio) : hasta };
}

// Quién genera o aprueba: el Administrador de RRHH con su usuario de prueba.
function validarResponsable({ idEmpleado, rol }) {
  if (!ROLES_PLANILLA.includes((rol ?? "").trim().toLowerCase())) {
    throw new ErrorApp(403, "Solo el Administrador de RRHH puede generar, aprobar o descartar planillas.");
  }
  if (!idEmpleado) throw new ErrorApp(401, "Identifíquese: elija su usuario en la barra superior.");
  if (!UUID_RE.test(idEmpleado)) throw new ErrorApp(401, "El usuario indicado no es válido.");
  return idEmpleado.toLowerCase();
}

// Contrato del colaborador en el mes: versión al cierre, haber promedio por días y días a pagar por contrato.
function contratoDelMes(versiones, rango) {
  const tramos = versiones
    .map((v) => ({ ...v, dias: diasEnComun(v.vigente_desde, v.vigente_hasta, rango.desde, rango.hasta) }))
    .filter((v) => v.dias > 0)
    .sort((a, b) => (a.vigente_desde < b.vigente_desde ? -1 : 1));
  if (tramos.length === 0) return null;
  const ultimo = tramos[tramos.length - 1];
  const diasCubiertos = tramos.reduce((total, t) => total + t.dias, 0);
  const haber = tramos.reduce((total, t) => total + t.haber_mensual_pactado * t.dias, 0) / diasCubiertos;
  const desde = tramos[0].vigente_desde > rango.desde ? tramos[0].vigente_desde : rango.desde;
  const hasta = ultimo.vigente_hasta === null || ultimo.vigente_hasta > rango.hasta ? rango.hasta : ultimo.vigente_hasta;
  const haberes = [...new Set(tramos.map((t) => t.haber_mensual_pactado))];
  return {
    id_contrato: ultimo.id_contrato,
    numero_contrato: ultimo.numero_contrato,
    haber_mensual: redondear(haber),
    contrato_desde: desde,
    contrato_hasta: hasta,
    dias_contrato: diasCubiertos >= rango.dias ? DIAS_MES_COMERCIAL : Math.min(diasCubiertos, DIAS_MES_COMERCIAL),
    haberes,
  };
}

// Días de licencia con y sin goce dentro del contrato en el mes.
function diasDeLicencia(licencias, contrato) {
  const dias = { con_goce: 0, sin_goce: 0 };
  for (const l of licencias) {
    const enComun = diasEnComun(l.fecha_inicio, l.fecha_fin, contrato.contrato_desde, contrato.contrato_hasta);
    dias[l.con_goce_haberes ? "con_goce" : "sin_goce"] += enComun;
  }
  return dias;
}

function detalleBono(b) {
  if (b.origen === "DETECCION") {
    const jornadas = b.cantidad === 1 ? "1 jornada" : `${b.cantidad} jornadas`;
    return `${jornadas}: ${b.fechas.map(fechaCorta).join(", ")}`;
  }
  return b.cantidad === 1 ? "1 día asignado" : `${b.cantidad} días asignados`;
}

const novedadDeBono = (b) => ({
  origen: "BONO_CONDICION",
  id_vigencia: b.id_vigencia,
  codigo: b.condicion.codigo,
  nombre: b.condicion.nombre,
  forma_calculo: b.condicion.forma_calculo,
  cantidad: b.cantidad,
  factor: b.factor,
  valor: b.valor,
  monto: b.monto,
  detalle: detalleBono(b),
});

const montoBs = (valor) => `Bs ${valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Fila de la planilla de un colaborador con contrato en el mes.
function consolidarEmpleado({ empleado, contrato, asistencia, extra, licencias, bonos }, rango) {
  const faltas = asistencia?.faltas_injustificadas ?? 0;
  const licencia = diasDeLicencia(licencias, contrato);
  const observaciones = [];
  if (contrato.contrato_desde > rango.desde) observaciones.push(`Contrato desde el ${fechaCorta(contrato.contrato_desde)}.`);
  if (contrato.contrato_hasta < rango.hasta) observaciones.push(`Contrato hasta el ${fechaCorta(contrato.contrato_hasta)}.`);
  if (contrato.haberes.length > 1) {
    observaciones.push(`El haber cambió en el mes (${contrato.haberes.map(montoBs).join(" → ")}): se promedia por días.`);
  }
  if (licencia.sin_goce > 0) {
    observaciones.push(licencia.sin_goce === 1 ? "1 día de licencia sin goce de haberes." : `${licencia.sin_goce} días de licencia sin goce de haberes.`);
  }
  const { haberes, ...datosContrato } = contrato;
  return {
    id_empleado: empleado.id_empleado,
    nombre_empleado: empleado.nombre_completo,
    numero_documento: empleado.numero_documento ?? null,
    cargo: empleado.cargo ?? null,
    area: empleado.area ?? null,
    sucursal: empleado.sucursal ?? null,
    ...datosContrato,
    faltas_injustificadas: faltas,
    dias_licencia_sin_goce: licencia.sin_goce,
    dias_licencia_con_goce: licencia.con_goce,
    dias_pagados: Math.max(0, contrato.dias_contrato - faltas - licencia.sin_goce),
    atrasos: asistencia?.atrasos ?? 0,
    minutos_atraso: asistencia?.minutos_retraso ?? 0,
    ...Object.fromEntries(CAMPOS_MINUTOS.map((c) => [c, extra?.[c] ?? 0])),
    observaciones,
    novedades: bonos.map(novedadDeBono),
  };
}

const listaNombres = (nombres) =>
  nombres.length > MAXIMO_NOMBRES
    ? `${nombres.slice(0, MAXIMO_NOMBRES).join(", ")} y ${nombres.length - MAXIMO_NOMBRES} más`
    : nombres.join(", ");

const porEmpleado = (filas, clave = (f) => f.id_empleado) => {
  const mapa = new Map();
  for (const f of filas) {
    const id = String(clave(f)).toLowerCase();
    if (!mapa.has(id)) mapa.set(id, []);
    mapa.get(id).push(f);
  }
  return mapa;
};

// Consolida las novedades del mes: una fila por colaborador con contrato y las advertencias de la planilla.
function consolidarPlanilla({ personal, contratos, asistencia, horasExtra, licencias, bonos }, rango) {
  const versiones = porEmpleado(contratos);
  const asistenciaDe = new Map(asistencia.map((a) => [String(a.empleado.id_empleado).toLowerCase(), a]));
  const extraDe = new Map(horasExtra.map((h) => [String(h.empleado.id_empleado).toLowerCase(), h]));
  const licenciasDe = porEmpleado(licencias);
  const bonosDe = porEmpleado(bonos, (b) => b.empleado.id_empleado);

  const empleados = [];
  const sinContrato = [];
  for (const empleado of personal) {
    const id = String(empleado.id_empleado).toLowerCase();
    const contrato = contratoDelMes(versiones.get(id) ?? [], rango);
    if (!contrato) {
      if (empleado.activo) sinContrato.push(empleado.nombre_completo);
      continue;
    }
    empleados.push(
      consolidarEmpleado(
        {
          empleado: { ...empleado, id_empleado: id },
          contrato,
          asistencia: asistenciaDe.get(id),
          extra: extraDe.get(id),
          licencias: licenciasDe.get(id) ?? [],
          bonos: bonosDe.get(id) ?? [],
        },
        rango
      )
    );
  }
  empleados.sort((a, b) => a.nombre_empleado.localeCompare(b.nombre_empleado, "es"));

  const incluidos = new Set(empleados.map((e) => e.id_empleado));
  const fueraDePlanilla = new Set(
    [
      ...horasExtra.filter((h) => CAMPOS_MINUTOS.some((c) => h[c] > 0)).map((h) => h.empleado.id_empleado),
      ...bonos.map((b) => b.empleado.id_empleado),
    ]
      .map((id) => String(id).toLowerCase())
      .filter((id) => !incluidos.has(id))
  );

  const advertencias = [];
  if (rango.en_curso) {
    advertencias.push(
      `Mes en curso: incluye datos hasta el ${fechaCorta(rango.datos_hasta)}. Vuelva a generarla cuando termine el mes para poder aprobarla.`
    );
  }
  if (sinContrato.length > 0) {
    advertencias.push(
      `${sinContrato.length === 1 ? "1 colaborador activo no tiene" : `${sinContrato.length} colaboradores activos no tienen`} contrato en el mes y no se incluye${sinContrato.length === 1 ? "" : "n"}: ${listaNombres(sinContrato)}.`
    );
  }
  if (fueraDePlanilla.size > 0) {
    advertencias.push(
      `${fueraDePlanilla.size === 1 ? "1 colaborador" : `${fueraDePlanilla.size} colaboradores`} sin contrato en el mes tiene${fueraDePlanilla.size === 1 ? "" : "n"} horas extra o bonos que no se pagan en esta planilla.`
    );
  }
  return { empleados, advertencias };
}

module.exports = {
  DIAS_MES_COMERCIAL,
  CAMPOS_MINUTOS,
  diasEnComun,
  rangoPlanilla,
  tramoSinConsolidar,
  validarResponsable,
  contratoDelMes,
  diasDeLicencia,
  consolidarEmpleado,
  consolidarPlanilla,
};

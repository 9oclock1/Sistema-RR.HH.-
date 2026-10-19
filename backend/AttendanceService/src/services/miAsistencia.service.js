const modelo = require("../models/miAsistencia.model");
const programacion = require("../models/novedades.model");
const justificaciones = require("../models/justificaciones.model");
const empleados = require("./empleados.service");
const horasExtra = require("./horasExtra.service");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { esFechaValida, sumarDias, calcularPeriodo, diasDelPeriodo } = require("../utils/periodos");

// RF-28: historial de asistencia del propio colaborador (marcajes, atrasos, faltas y horas computadas).
const DIAS_MAXIMOS = 366;
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Rango pedido: un mes (?mes=AAAA-MM) o un rango (?desde&hasta). Por defecto, el mes en curso hasta hoy.
function leerFiltros({ mes, desde, hasta } = {}, hoy) {
  const errores = [];
  let inicio;
  let fin;
  if (mes) {
    if (!MES_RE.test(mes)) throw new ErrorApp(400, "Filtros inválidos", [{ campo: "mes", mensaje: "Use el formato AAAA-MM." }]);
    ({ fecha_inicio: inicio, fecha_fin: fin } = calcularPeriodo("MENSUAL", `${mes}-01`));
  } else {
    fin = hasta || hoy;
    inicio = desde || `${fin.slice(0, 8)}01`;
    if (!esFechaValida(inicio)) errores.push({ campo: "desde", mensaje: "Use el formato AAAA-MM-DD." });
    if (!esFechaValida(fin)) errores.push({ campo: "hasta", mensaje: "Use el formato AAAA-MM-DD." });
  }
  if (errores.length === 0) {
    if (inicio > fin) errores.push({ campo: "desde", mensaje: "La fecha inicial no puede ser posterior a la final." });
    else if (sumarDias(inicio, DIAS_MAXIMOS - 1) < fin) {
      errores.push({ campo: "desde", mensaje: `Consulte como máximo ${DIAS_MAXIMOS} días.` });
    } else if (inicio > hoy) {
      errores.push({ campo: mes ? "mes" : "desde", mensaje: "Elija un periodo que no sea posterior a hoy." });
    }
  }
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return { desde: inicio, hasta: fin, hastaEfectiva: fin < hoy ? fin : hoy };
}

// Criterio 4: solo el propio historial. El id llega por cabecera hasta contar con autenticación;
// pedir el de otra persona (?id_empleado=) se rechaza en lugar de ignorarse.
async function verificarAcceso(idEmpleado, { id_empleado: solicitado } = {}) {
  if (!idEmpleado || !UUID_RE.test(idEmpleado)) throw new ErrorApp(401, "Identificación de empleado inválida.");
  if (solicitado !== undefined && String(solicitado).trim().toLowerCase() !== idEmpleado) {
    throw new ErrorApp(403, "Solo puede consultar su propio historial de asistencia.");
  }
  const empleado = await empleados.obtener(idEmpleado);
  if (!empleado) throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");
  return {
    id_empleado: idEmpleado,
    nombre_completo: empleado.nombre_completo ?? `${empleado.nombres ?? ""} ${empleado.apellidos ?? ""}`.trim(),
  };
}

const agrupar = (filas, clave) => {
  const mapa = new Map();
  for (const fila of filas) {
    const valor = fila[clave];
    if (!mapa.has(valor)) mapa.set(valor, []);
    mapa.get(valor).push(fila);
  }
  return mapa;
};

const resumirMarcaje = (m) =>
  m && {
    id_marcaje: m.id_marcaje,
    fecha_hora: m.fecha_hora_marcaje,
    origen: { codigo: m.origen_codigo, nombre: m.origen_nombre },
    codigo_dispositivo: m.codigo_dispositivo ?? null,
    estado: { codigo: m.estado_codigo, nombre: m.estado_nombre },
  };

const resumirTurno = (t) =>
  t && {
    nombre: t.descanso ? null : t.nombre_turno,
    hora_inicio: t.descanso ? null : t.hora_inicio?.slice(0, 5) ?? null,
    hora_fin: t.descanso ? null : t.hora_fin?.slice(0, 5) ?? null,
    descanso: t.descanso === true,
  };

// Criterio 3: estado del justificativo más reciente de la novedad (pendiente, aprobada o rechazada).
const resumirJustificacion = (s) =>
  s && {
    id_solicitud: s.id_solicitud,
    estado: { codigo: s.estado_codigo, nombre: s.estado_nombre },
    motivo: s.motivo_nombre,
    enviada_en: s.creado_en,
    revision: s.revisada_en
      ? { nombre_revisor: s.nombre_revisor, revisada_en: s.revisada_en, comentario: s.comentario_revision ?? null }
      : null,
  };

const resumirNovedad = (n, ultima) => ({
  id_novedad: n.id_novedad,
  tipo: { codigo: n.tipo_codigo, nombre: n.tipo_nombre },
  estado: { codigo: n.estado_codigo, nombre: n.estado_nombre },
  minutos: n.minutos,
  justificable: n.es_justificable === true,
  justificacion: resumirJustificacion(ultima) ?? null,
});

const resumirLicencia = (l) => ({
  id_solicitud: l.id_solicitud,
  tipo: { codigo: l.tipo_codigo, nombre: l.tipo_nombre },
  estado: { codigo: l.estado_codigo, nombre: l.estado_nombre },
  fecha_inicio: l.fecha_inicio,
  fecha_fin: l.fecha_fin,
  resuelta_en: l.resuelto_en ?? null,
  motivo_resolucion: l.motivo_resolucion ?? null,
});

// LABORADO, LICENCIA (aprobada), FALTA, DESCANSO, SIN_TURNO, EN_CURSO (hoy) o SIN_REGISTRO (turno sin marcajes ni novedad).
function estadoDelDia({ fecha, hoy, turno, entrada, salida, novedades, licencias }) {
  if (entrada || salida) return "LABORADO";
  if (licencias.some((l) => l.estado.codigo === "APROBADA")) return "LICENCIA";
  if (novedades.some((n) => n.tipo.codigo === "INASISTENCIA")) return "FALTA";
  if (turno?.descanso) return "DESCANSO";
  if (!turno) return "SIN_TURNO";
  return fecha === hoy ? "EN_CURSO" : "SIN_REGISTRO";
}

// Criterio 2: días laborados, atrasos acumulados en minutos, faltas y horas computadas del periodo.
function resumir(dias) {
  const novedades = dias.flatMap((d) => d.novedades);
  const de = (codigo) => novedades.filter((n) => n.tipo.codigo === codigo);
  const justificada = (n) => n.estado.codigo === "JUSTIFICADA";
  const atrasos = de("ATRASO");
  const faltas = de("INASISTENCIA");
  const suma = (filas, campo) => filas.reduce((total, f) => total + (f[campo] ?? 0), 0);
  return {
    dias_programados: dias.filter((d) => d.turno && !d.turno.descanso).length,
    dias_laborados: dias.filter((d) => d.estado === "LABORADO").length,
    dias_con_licencia: dias.filter((d) => d.estado === "LICENCIA").length,
    faltas: faltas.length,
    faltas_justificadas: faltas.filter(justificada).length,
    faltas_injustificadas: faltas.filter((n) => !justificada(n)).length,
    atrasos: atrasos.length,
    atrasos_justificados: atrasos.filter(justificada).length,
    minutos_atraso: suma(atrasos, "minutos"),
    minutos_atraso_sin_justificar: suma(atrasos.filter((n) => !justificada(n)), "minutos"),
    salidas_anticipadas: de("SALIDA_ANTICIPADA").length,
    omisiones_salida: de("OMISION_SALIDA").length,
    minutos_trabajados: suma(dias, "minutos_trabajados"),
    minutos_extra_aprobados: suma(dias, "minutos_extra_aprobados"),
  };
}

async function consultar(idEmpleado, consulta = {}) {
  const id = idEmpleado?.trim().toLowerCase();
  const empleado = await verificarAcceso(id, consulta);
  const { ahora, hoy } = await programacion.momentoActual();
  const { desde, hasta, hastaEfectiva } = leerFiltros(consulta, hoy);

  // Las horas se calculan al pedirlas (igual que en los reportes); si falla, se muestra lo ya calculado.
  await horasExtra.calcular({ desde, hasta: hastaEfectiva, ids: [id] }).catch((error) => {
    console.error("Historial de asistencia con horas sin recalcular:", error.message);
  });
  const [turnos, marcajes, novedades, horas, licencias] = await Promise.all([
    programacion.listarProgramacion(desde, hastaEfectiva, [id]),
    modelo.listarMarcajes(id, desde, hastaEfectiva),
    modelo.listarNovedades(id, desde, hastaEfectiva),
    modelo.listarHoras(id, desde, hastaEfectiva),
    modelo.listarLicencias(id, desde, hastaEfectiva),
  ]);
  const solicitudes = await justificaciones.listarPorNovedades(novedades.map((n) => n.id_novedad));
  // Vienen de la más reciente a la más antigua: la primera de cada novedad es la vigente.
  const ultimaDe = new Map();
  for (const s of solicitudes) if (!ultimaDe.has(s.id_novedad)) ultimaDe.set(s.id_novedad, s);

  const turnoDe = new Map(turnos.map((t) => [t.fecha, t]));
  const marcajesDe = agrupar(marcajes, "fecha_jornada");
  const novedadesDe = agrupar(novedades, "fecha_jornada");
  const horasDe = new Map(horas.map((h) => [h.fecha_jornada, h]));
  const licenciasResumidas = licencias.map(resumirLicencia);

  const dias = diasDelPeriodo(desde, hastaEfectiva)
    .reverse()
    .map((fecha) => {
      const delDia = marcajesDe.get(fecha) ?? [];
      const entrada = delDia.find((m) => m.tipo_codigo === "ENTRADA") ?? null;
      const salida = delDia.find((m) => m.tipo_codigo === "SALIDA") ?? null;
      const turno = resumirTurno(turnoDe.get(fecha)) ?? null;
      const novedadesDia = (novedadesDe.get(fecha) ?? []).map((n) => resumirNovedad(n, ultimaDe.get(n.id_novedad)));
      const licenciasDia = licenciasResumidas.filter((l) => l.fecha_inicio <= fecha && l.fecha_fin >= fecha);
      const h = horasDe.get(fecha);
      return {
        fecha,
        estado: estadoDelDia({ fecha, hoy, turno, entrada, salida, novedades: novedadesDia, licencias: licenciasDia }),
        turno,
        entrada: resumirMarcaje(entrada),
        salida: resumirMarcaje(salida),
        minutos_trabajados: h?.minutos_trabajados ?? null,
        minutos_extra_aprobados: h?.minutos_extra_aprobados ?? 0,
        horas_extra: h && h.estado_extra_codigo !== "SIN_EXTRA" ? { codigo: h.estado_extra_codigo, nombre: h.estado_extra_nombre } : null,
        novedades: novedadesDia,
        licencias: licenciasDia,
      };
    });

  return {
    empleado,
    filtros: { desde, hasta, hasta_efectiva: hastaEfectiva },
    generado_en: ahora,
    resumen: resumir(dias),
    dias,
  };
}

module.exports = { DIAS_MAXIMOS, leerFiltros, verificarAcceso, estadoDelDia, resumir, consultar };

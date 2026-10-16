const pool = require("../config/db");
const modelo = require("../models/justificaciones.model");
const { momentoActual } = require("../models/novedades.model");
const almacen = require("../utils/adjuntosJustificacion");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { esFechaValida, sumarDias } = require("../utils/periodos");
const { horasPlazo, evaluarPlazo, errorDePlazo, validarSolicitud, nombreVisible } = require("../utils/justificaciones");

const DIAS_CONSULTA = 30;
const DIAS_MAXIMOS_CONSULTA = 92;

function verificarIdentidad(idEmpleado) {
  if (!UUID_RE.test(idEmpleado)) throw new ErrorApp(401, "Identificación de empleado inválida.");
  return idEmpleado;
}

const noEncontrada = () => new ErrorApp(404, "Novedad no encontrada");

const resumirNovedad = (n) => ({
  id_novedad: n.id_novedad,
  id_empleado: n.id_empleado,
  tipo: { codigo: n.tipo_codigo, nombre: n.tipo_nombre },
  estado: { codigo: n.estado_codigo, nombre: n.estado_nombre },
  fecha_jornada: n.fecha_jornada,
  minutos: n.minutos,
  minutos_penalizacion: n.minutos_penalizacion,
  fecha_hora_marcaje: n.fecha_hora_marcaje ?? null,
  turno: {
    nombre: n.nombre_turno,
    inicio_programado: n.inicio_programado,
    fin_programado: n.fin_programado,
    minutos_tolerancia: n.minutos_tolerancia,
  },
});

const resumirAdjunto = (a) => ({
  id_adjunto: a.id_adjunto,
  nombre: a.nombre_original,
  tipo_mime: a.tipo_mime,
  tamano_bytes: a.tamano_bytes,
  url: `/justificaciones/${a.id_solicitud}/adjuntos/${a.id_adjunto}`,
});

const resumirSolicitud = (s, adjuntos = []) => ({
  id_solicitud: s.id_solicitud,
  id_novedad: s.id_novedad,
  id_empleado: s.id_empleado,
  estado: { codigo: s.estado_codigo, nombre: s.estado_nombre },
  motivo: { id_motivo: s.id_motivo_justificacion, codigo: s.motivo_codigo, nombre: s.motivo_nombre },
  descripcion: s.descripcion,
  creado_en: s.creado_en,
  revision: s.revisada_en
    ? {
        id_revisor: s.id_revisor,
        nombre_revisor: s.nombre_revisor,
        comentario: s.comentario_revision,
        revisada_en: s.revisada_en,
      }
    : null,
  adjuntos: adjuntos.filter((a) => a.id_solicitud === s.id_solicitud).map(resumirAdjunto),
});

async function detalle(db, idSolicitud) {
  const solicitud = await modelo.obtener(db, idSolicitud);
  if (!solicitud) return null;
  const [novedad, adjuntos] = await Promise.all([
    modelo.obtenerNovedad(db, solicitud.id_novedad),
    modelo.listarAdjuntos(db, [idSolicitud]),
  ]);
  return { ...resumirSolicitud(solicitud, adjuntos), novedad: resumirNovedad(novedad) };
}

async function listarMotivos() {
  return (await modelo.listarMotivos()).map((m) => ({
    id_motivo: m.id_motivo_justificacion,
    codigo: m.codigo,
    nombre: m.nombre,
  }));
}

function leerRango({ desde, hasta } = {}, hoy) {
  const fin = hasta || hoy;
  const inicio = desde || sumarDias(fin, -DIAS_CONSULTA);
  const errores = [];
  if (!esFechaValida(inicio)) errores.push({ campo: "desde", mensaje: "Use el formato AAAA-MM-DD." });
  if (!esFechaValida(fin)) errores.push({ campo: "hasta", mensaje: "Use el formato AAAA-MM-DD." });
  if (errores.length === 0 && inicio > fin) {
    errores.push({ campo: "desde", mensaje: "La fecha inicial no puede ser posterior a la final." });
  } else if (errores.length === 0 && sumarDias(inicio, DIAS_MAXIMOS_CONSULTA) < fin) {
    errores.push({ campo: "desde", mensaje: `Consulte como máximo ${DIAS_MAXIMOS_CONSULTA} días.` });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return { desde: inicio, hasta: fin };
}

// Panel del colaborador: sus atrasos, faltas y salidas anticipadas, con el plazo y la última solicitud de cada una.
async function misNovedades(idEmpleado, filtros) {
  verificarIdentidad(idEmpleado);
  const { ahora, hoy } = await momentoActual();
  const { desde, hasta } = leerRango(filtros, hoy);
  const horas = horasPlazo();

  const novedades = await modelo.listarNovedadesDelEmpleado(idEmpleado, desde, hasta);
  const solicitudes = await modelo.listarPorNovedades(novedades.map((n) => n.id_novedad));
  const ultimas = new Map();
  for (const s of solicitudes) if (!ultimas.has(s.id_novedad)) ultimas.set(s.id_novedad, s);
  const adjuntos = await modelo.listarAdjuntos(pool, [...ultimas.values()].map((s) => s.id_solicitud));

  return {
    desde,
    hasta,
    horas_plazo: horas,
    generado_en: ahora,
    novedades: novedades.map((n) => {
      const ultima = ultimas.get(n.id_novedad) ?? null;
      const vigente = ultima && ["PENDIENTE", "APROBADA"].includes(ultima.estado_codigo) ? ultima : null;
      return {
        ...resumirNovedad(n),
        plazo: evaluarPlazo(n, { vigente, ahoraMs: ahora.getTime(), horas }),
        solicitud: ultima ? resumirSolicitud(ultima, adjuntos) : null,
        solicitudes: solicitudes.filter((s) => s.id_novedad === n.id_novedad).length,
      };
    }),
  };
}

// Registra la solicitud y sus comprobantes. Si algo falla, no quedan archivos sueltos en disco.
async function registrar(idEmpleado, cuerpo, archivos = []) {
  verificarIdentidad(idEmpleado);
  const datos = validarSolicitud(cuerpo, archivos, await modelo.listarMotivos());
  const { ahora } = await momentoActual();
  const claves = [];
  try {
    const idSolicitud = await enTransaccion(async (cliente) => {
      const novedad = await modelo.bloquearNovedadDelEmpleado(cliente, datos.idNovedad, idEmpleado);
      if (!novedad) throw noEncontrada();
      const vigente = await modelo.obtenerVigente(cliente, novedad.id_novedad);
      const plazo = evaluarPlazo(novedad, { vigente, ahoraMs: ahora.getTime(), horas: horasPlazo() });
      if (!plazo.justificable) throw errorDePlazo(plazo);

      const id = await modelo.crear(cliente, { ...datos, idEmpleado });
      const adjuntos = [];
      for (const archivo of archivos) {
        const clave = await almacen.guardar(archivo);
        claves.push(clave);
        adjuntos.push({
          nombre_original: nombreVisible(archivo.originalname),
          tipo_mime: archivo.mimetype,
          tamano_bytes: archivo.size,
          clave_almacenamiento: clave,
        });
      }
      await modelo.agregarAdjuntos(cliente, id, adjuntos);
      return id;
    });
    return detalle(pool, idSolicitud);
  } catch (error) {
    await Promise.all(claves.map((clave) => almacen.eliminar(clave).catch(() => {})));
    if (error.code === "23505") throw errorDePlazo({ razon: "PENDIENTE" });
    throw error;
  }
}

module.exports = { listarMotivos, misNovedades, registrar, detalle, resumirNovedad, resumirSolicitud };

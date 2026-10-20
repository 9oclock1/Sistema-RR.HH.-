const modelo = require("../models/aprobaciones.model");
const licenciasModelo = require("../models/licencias.model");
const vacacionesModelo = require("../models/solicitudesVacacion.model");
const empleados = require("./empleados.service");
const licencias = require("./licencias.service");
const solicitudesVacacion = require("./solicitudesVacacion.service");
const vacaciones = require("./vacaciones.service");
const almacenamiento = require("../utils/almacenamiento");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { fechaBolivia } = require("../utils/vacaciones");
const {
  CATEGORIA,
  ESTADOS_BANDEJA,
  PRIORIDADES,
  calcularPrioridad,
  ordenarBandeja,
  calcularCobertura,
} = require("../utils/aprobaciones");

const LIMITE_BANDEJA = 300;

const categoriaValida = (categoria) => {
  const codigo = typeof categoria === "string" ? categoria.toUpperCase() : "";
  if (!Object.hasOwn(CATEGORIA, codigo)) throw new ErrorApp(404, "Tipo de solicitud no encontrado");
  return codigo;
};

function leerFiltros({ id_sucursal, id_departamento, estado, categoria, prioridad } = {}) {
  const errores = [];
  if (!UUID_RE.test(id_sucursal ?? "")) errores.push({ campo: "id_sucursal", mensaje: "Seleccione una sucursal válida." });
  if (id_departamento && !UUID_RE.test(id_departamento)) errores.push({ campo: "id_departamento", mensaje: "Área inválida." });
  const estadoPedido = (estado ?? "PENDIENTE").toUpperCase();
  if (!ESTADOS_BANDEJA.includes(estadoPedido)) {
    errores.push({ campo: "estado", mensaje: `Use uno de: ${ESTADOS_BANDEJA.join(", ")}.` });
  }
  const categoriaPedida = categoria ? categoria.toUpperCase() : null;
  if (categoriaPedida && !Object.hasOwn(CATEGORIA, categoriaPedida)) {
    errores.push({ campo: "categoria", mensaje: "Use VACACIONES o LICENCIA." });
  }
  const prioridadPedida = prioridad ? prioridad.toUpperCase() : null;
  if (prioridadPedida && !PRIORIDADES.includes(prioridadPedida)) {
    errores.push({ campo: "prioridad", mensaje: `Use uno de: ${PRIORIDADES.join(", ")}.` });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return {
    idSucursal: id_sucursal.toLowerCase(),
    idDepartamento: id_departamento ? id_departamento.toLowerCase() : null,
    estado: estadoPedido === "TODAS" ? null : estadoPedido,
    categoria: categoriaPedida,
    prioridad: prioridadPedida,
  };
}

function armarItem(fila, persona, hoy) {
  const pendiente = fila.estado_codigo === "PENDIENTE";
  return {
    categoria: fila.categoria,
    id_solicitud: fila.id_solicitud,
    empleado: {
      id_empleado: fila.id_empleado,
      nombre_completo: persona?.nombre_completo ?? "Empleado no encontrado",
      cargo: persona?.cargo ?? null,
      area: persona?.area ?? null,
    },
    tipo: fila.tipo_nombre,
    fecha_inicio: fila.fecha_inicio,
    fecha_fin: fila.fecha_fin,
    dias: fila.dias,
    // Vacaciones se cuentan en días hábiles; las licencias, en días corridos.
    dias_tipo: fila.categoria === CATEGORIA.VACACIONES ? "habiles" : "calendario",
    con_goce_haberes: fila.categoria === CATEGORIA.VACACIONES ? true : fila.es_con_goce_haberes,
    requiere_rrhh: fila.excede_limite_dias === true,
    estado: { codigo: fila.estado_codigo, nombre: fila.estado_nombre },
    prioridad: pendiente
      ? calcularPrioridad({ fechaInicio: fila.fecha_inicio, hoy, exigeRrhh: fila.excede_limite_dias === true })
      : null,
    creado_en: fila.creado_en,
    resuelto_en: fila.resuelto_en,
    motivo_resolucion: fila.motivo_resolucion,
  };
}

// Bandeja del supervisor o RRHH: solicitudes del personal de una sucursal (y área), con prioridad y contadores.
async function listarBandeja(consulta) {
  const filtros = leerFiltros(consulta);
  const personal = await empleados.listarPorArea(filtros.idSucursal, filtros.idDepartamento);
  const resumen = { pendientes: 0, aprobadas: 0, rechazadas: 0 };
  if (personal.length === 0) return { resumen, solicitudes: [] };

  const ids = personal.map((p) => p.id_empleado);
  const porId = new Map(personal.map((p) => [p.id_empleado, p]));
  const hoy = fechaBolivia();
  const [filas, conteo] = await Promise.all([
    modelo.listar(ids, filtros.estado, LIMITE_BANDEJA),
    modelo.contarPorEstado(ids),
  ]);

  resumen.pendientes = conteo.PENDIENTE ?? 0;
  resumen.aprobadas = conteo.APROBADA ?? 0;
  resumen.rechazadas = conteo.RECHAZADA ?? 0;

  const items = filas
    .map((fila) => armarItem(fila, porId.get(fila.id_empleado), hoy))
    .filter((item) => !filtros.categoria || item.categoria === filtros.categoria)
    .filter((item) => !filtros.prioridad || item.prioridad === filtros.prioridad);
  return { resumen, solicitudes: ordenarBandeja(items) };
}

async function obtenerSolicitud(categoria, idSolicitud) {
  const solicitud = UUID_RE.test(idSolicitud)
    ? categoria === CATEGORIA.VACACIONES
      ? await vacacionesModelo.obtener(idSolicitud)
      : await licenciasModelo.obtener(idSolicitud)
    : null;
  if (!solicitud) throw new ErrorApp(404, "Solicitud no encontrada");
  return solicitud;
}

// Datos de apoyo que no deben impedir revisar la solicitud: si fallan, se informa y se sigue.
const opcional = (promesa) => promesa.then((valor) => ({ valor }), (error) => ({ error: error.message }));

// Impacto de cobertura: quién del equipo (misma sucursal y área) también falta en esas fechas.
async function calcularCoberturaDelEquipo(solicitud, ubicacion) {
  if (!ubicacion?.id_sucursal || !ubicacion?.id_departamento) return null;
  const equipo = (await empleados.listarPorArea(ubicacion.id_sucursal, ubicacion.id_departamento)).filter((p) => p.activo);
  const companeros = equipo.filter((p) => p.id_empleado !== solicitud.id_empleado);
  const porId = new Map(equipo.map((p) => [p.id_empleado, p]));
  const ausencias = companeros.length
    ? await modelo.listarAusenciasSolapadas(
        companeros.map((p) => p.id_empleado),
        solicitud.fecha_inicio,
        solicitud.fecha_fin,
        solicitud.id_solicitud
      )
    : [];
  return calcularCobertura({
    fechaInicio: solicitud.fecha_inicio,
    fechaFin: solicitud.fecha_fin,
    equipoTotal: equipo.some((p) => p.id_empleado === solicitud.id_empleado) ? equipo.length : equipo.length + 1,
    ausencias: ausencias.map((a) => ({
      categoria: a.categoria,
      id_solicitud: a.id_solicitud,
      tipo: a.tipo_nombre,
      estado_codigo: a.estado_codigo,
      fecha_inicio: a.fecha_inicio,
      fecha_fin: a.fecha_fin,
      empleado: { id_empleado: a.id_empleado, nombre_completo: porId.get(a.id_empleado)?.nombre_completo ?? "Compañero" },
    })),
  });
}

const resumirSaldo = (s) => ({
  acumulados: s.saldo.acumulados,
  gozados: s.saldo.gozados,
  en_proceso: s.saldo.en_proceso,
  disponibles: s.saldo.disponibles,
});

// Criterio 1: fechas, días hábiles, causal, comprobante e impacto de cobertura en el equipo.
async function obtenerDetalle(categoriaPedida, idSolicitud) {
  const categoria = categoriaValida(categoriaPedida);
  const solicitud = await obtenerSolicitud(categoria, idSolicitud);
  const [persona, ubicacion, nombreResolutor] = await Promise.all([
    empleados.obtenerNombre(solicitud.id_empleado),
    opcional(empleados.obtenerUbicacion(solicitud.id_empleado)),
    solicitud.id_empleado_resolutor ? empleados.obtenerNombre(solicitud.id_empleado_resolutor) : null,
  ]);
  const cobertura = await opcional(calcularCoberturaDelEquipo(solicitud, ubicacion.valor));
  const esVacacion = categoria === CATEGORIA.VACACIONES;
  const saldo = esVacacion ? await opcional(vacaciones.consultarSaldo(solicitud.id_empleado)) : null;

  return {
    categoria,
    id_solicitud: solicitud.id_solicitud,
    empleado: {
      id_empleado: solicitud.id_empleado,
      nombre_completo: persona,
      cargo: ubicacion.valor?.cargo ?? null,
      area: ubicacion.valor?.area ?? null,
      sucursal: ubicacion.valor?.sucursal ?? null,
    },
    tipo: esVacacion ? "Vacaciones" : solicitud.tipo_nombre,
    estado: { codigo: solicitud.estado_codigo, nombre: solicitud.estado_nombre },
    fecha_inicio: solicitud.fecha_inicio,
    fecha_fin: solicitud.fecha_fin,
    dias: esVacacion ? solicitud.dias_habiles : solicitud.dias_solicitados,
    dias_tipo: esVacacion ? "habiles" : "calendario",
    con_goce_haberes: esVacacion ? true : solicitud.es_con_goce_haberes,
    requiere_rrhh: solicitud.excede_limite_dias === true,
    motivo: esVacacion ? null : solicitud.motivo,
    adjuntos: esVacacion
      ? []
      : solicitud.adjuntos.map((a) => ({
          id_adjunto: a.id_adjunto,
          nombre: a.nombre_original,
          tipo_mime: a.formato_mimetype,
          tamano_bytes: a.tamano_bytes,
        })),
    saldo: saldo?.valor ? resumirSaldo(saldo.valor) : null,
    cobertura: cobertura.valor ?? null,
    aviso_cobertura: cobertura.error ?? ubicacion.error ?? null,
    creado_en: solicitud.creado_en,
    resolucion: solicitud.resuelto_en
      ? {
          resuelto_por: nombreResolutor,
          resuelto_en: solicitud.resuelto_en,
          motivo: solicitud.motivo_resolucion,
        }
      : null,
  };
}

async function resolver(categoriaPedida, idResolutor, idSolicitud, datos, opciones) {
  const categoria = categoriaValida(categoriaPedida);
  return categoria === CATEGORIA.VACACIONES
    ? solicitudesVacacion.resolverSolicitud(idResolutor, idSolicitud, datos)
    : licencias.resolver(idResolutor, idSolicitud, datos, opciones);
}

// El resolutor revisa el comprobante antes de decidir (a diferencia del colaborador, que solo ve los suyos).
async function obtenerAdjunto(idSolicitud, idAdjunto) {
  const adjunto =
    UUID_RE.test(idSolicitud) && UUID_RE.test(idAdjunto) ? await licenciasModelo.obtenerAdjunto(idSolicitud, idAdjunto) : null;
  if (!adjunto) throw new ErrorApp(404, "Comprobante no encontrado");
  return {
    ruta: almacenamiento.rutaDe(adjunto.archivo_url),
    nombre: adjunto.nombre_original,
    mimetype: adjunto.formato_mimetype,
  };
}

// Reintenta los avisos de resoluciones (de ambas clases) que NotificationService no alcanzó a confirmar.
function iniciarReintentoDeAvisos() {
  const intervalo = Number(process.env.INTERVALO_AVISOS_MS) || 60 * 1000;
  let ocupado = false;
  const ejecutar = async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await licencias.reintentarAvisosPendientes();
      await solicitudesVacacion.reintentarAvisosPendientes();
    } catch (error) {
      console.error("Error al reintentar los avisos de resolución:", error.message);
    } finally {
      ocupado = false;
    }
  };
  setTimeout(ejecutar, 15 * 1000);
  setInterval(ejecutar, intervalo);
}

module.exports = { listarBandeja, obtenerDetalle, resolver, obtenerAdjunto, iniciarReintentoDeAvisos };

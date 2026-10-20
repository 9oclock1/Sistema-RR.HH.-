const modelo = require("../models/notificaciones.model");
const empleadosServicio = require("./empleados.service");
const correoServicio = require("./correo.service");
const { ErrorApp } = require("../utils/errores");
const { validarUuid, esUuidValido } = require("../utils/validaciones");

const TIPO_NOTIFICACION = {
  SOLICITUD_APROBADA: "SOLICITUD_APROBADA",
  SOLICITUD_RECHAZADA: "SOLICITUD_RECHAZADA",
};

const RESOLUCIONES = {
  APROBADA: { tipo: TIPO_NOTIFICACION.SOLICITUD_APROBADA, verbo: "aprobada" },
  RECHAZADA: { tipo: TIPO_NOTIFICACION.SOLICITUD_RECHAZADA, verbo: "rechazada" },
};

// Cada categoría de ausencia abre su propia pantalla de detalle. Sin categoría se asume licencia (emisores anteriores).
const CATEGORIAS = {
  LICENCIA: () => "/asistencia/licencias",
  VACACIONES: () => process.env.RUTA_VACACIONES || "/asistencia/solicitud-vacaciones",
};

const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 50;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const formatearFecha = (iso) => iso.split("-").reverse().join("/");

function validarResolucion(datos = {}) {
  const errores = [];
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

  const estado = texto(datos.estado).toUpperCase();
  if (!Object.hasOwn(RESOLUCIONES, estado)) agregar("estado", "El resultado debe ser APROBADA o RECHAZADA.");
  if (!esUuidValido(datos.id_solicitud)) agregar("id_solicitud", "Identificador de solicitud inválido.");
  if (!esUuidValido(datos.id_empleado)) agregar("id_empleado", "Identificador de empleado inválido.");

  const categoria = texto(datos.categoria).toUpperCase() || "LICENCIA";
  if (!Object.hasOwn(CATEGORIAS, categoria)) agregar("categoria", "La categoría debe ser LICENCIA o VACACIONES.");

  const tipoSolicitud = texto(datos.tipo_solicitud);
  if (!tipoSolicitud) agregar("tipo_solicitud", "Indique el tipo de solicitud resuelta.");
  else if (tipoSolicitud.length > 80) agregar("tipo_solicitud", "El tipo de solicitud no puede exceder los 80 caracteres.");

  for (const campo of ["fecha_inicio", "fecha_fin"]) {
    if (!FECHA_RE.test(texto(datos[campo]))) agregar(campo, "Ingrese una fecha válida (AAAA-MM-DD).");
  }

  // Criterio 2: el rechazo siempre lleva la justificación formal del supervisor.
  const motivo = texto(datos.motivo_resolucion);
  if (estado === "RECHAZADA" && !motivo) {
    agregar("motivo_resolucion", "Un rechazo debe incluir la justificación del supervisor.");
  }

  if (errores.length > 0) throw new ErrorApp(400, "Datos de la resolución inválidos", errores);

  return {
    estado,
    categoria,
    idSolicitud: datos.id_solicitud.toLowerCase(),
    idEmpleado: datos.id_empleado.toLowerCase(),
    tipoSolicitud,
    fechaInicio: texto(datos.fecha_inicio),
    fechaFin: texto(datos.fecha_fin),
    motivo: motivo || null,
    resueltoPor: texto(datos.resuelto_por_nombre) || null,
  };
}

function armarMensaje({ estado, tipoSolicitud, fechaInicio, fechaFin, motivo, resueltoPor }) {
  const { verbo } = RESOLUCIONES[estado];
  const periodo =
    fechaInicio === fechaFin ? formatearFecha(fechaInicio) : `${formatearFecha(fechaInicio)} al ${formatearFecha(fechaFin)}`;
  const lineas = [
    `Su solicitud de «${tipoSolicitud}» para el ${periodo} fue ${verbo}${resueltoPor ? ` por ${resueltoPor}` : ""}.`,
  ];
  if (motivo) lineas.push(`${estado === "RECHAZADA" ? "Justificación" : "Observación"}: ${motivo}`);
  return lineas.join("\n");
}

function armarCorreo(mensaje, enlace) {
  const portal = (process.env.PORTAL_URL || "").replace(/\/+$/, "");
  const acceso = portal
    ? `Ver el detalle de la solicitud: ${portal}${enlace}`
    : "Ingrese al portal de RR.HH. para ver el detalle de la solicitud.";
  return `${mensaje}\n\n${acceso}\n\nEste es un aviso automático del Sistema de RR.HH.; no responda a este correo.`;
}

// RF-34: avisa al colaborador el resultado de su solicitud, en el portal y por correo si lo tiene registrado.
async function notificarResolucionSolicitud(datos) {
  const resolucion = validarResolucion(datos);
  const { tipo, verbo } = RESOLUCIONES[resolucion.estado];
  const mensaje = armarMensaje(resolucion);
  // Criterio 4: la alerta abre el detalle de la solicitud resuelta.
  const enlace = `${CATEGORIAS[resolucion.categoria]()}?solicitud=${resolucion.idSolicitud}`;

  const { notificacion, creada } = await modelo.crear({
    idEmpleado: resolucion.idEmpleado,
    tipo,
    titulo: `Solicitud ${verbo}: ${resolucion.tipoSolicitud}`.slice(0, 150),
    mensaje,
    enlace,
    idReferencia: resolucion.idSolicitud,
  });

  // Un reintento del emisor no vuelve a escribir ni a enviar correo.
  if (!creada) {
    return {
      notificacion,
      creada,
      correo: { enviado: notificacion.correo_estado === "ENVIADO", motivo: notificacion.correo_detalle },
    };
  }

  // Sin datos del empleado la alerta del portal ya quedó; solo se omite el correo.
  const empleado = await empleadosServicio.obtenerEmpleado(resolucion.idEmpleado).catch(() => null);
  const correo = await correoServicio.enviarCorreo({
    para: empleado?.correo,
    asunto: notificacion.titulo,
    texto: armarCorreo(mensaje, enlace),
  });
  const estadoCorreo = correo.enviado ? "ENVIADO" : empleado?.correo ? "FALLIDO" : "NO_APLICA";
  await modelo.registrarCorreo(notificacion.id_notificacion, estadoCorreo, correo.motivo).catch((error) => {
    console.error("No se pudo registrar el resultado del correo:", error.message);
  });

  return {
    notificacion: { ...notificacion, correo_estado: estadoCorreo, correo_detalle: correo.motivo },
    creada,
    correo,
  };
}

function paginacion({ limite, desplazamiento }) {
  const tope = Number.parseInt(limite, 10);
  const salto = Number.parseInt(desplazamiento, 10);
  return {
    limite: Number.isInteger(tope) && tope > 0 ? Math.min(tope, LIMITE_MAXIMO) : LIMITE_POR_DEFECTO,
    desplazamiento: Number.isInteger(salto) && salto > 0 ? salto : 0,
  };
}

// Devuelve la página pedida y el total de no leídas, que alimenta el contador de la campana.
async function listarMisNotificaciones(idEmpleado, { estado, limite, desplazamiento } = {}) {
  const soloNoLeidas = estado === "no_leidas";
  const [notificaciones, no_leidas] = await Promise.all([
    modelo.listar(idEmpleado, { soloNoLeidas, ...paginacion({ limite, desplazamiento }) }),
    modelo.contarNoLeidas(idEmpleado),
  ]);
  return { notificaciones, no_leidas };
}

const contarNoLeidas = async (idEmpleado) => ({ no_leidas: await modelo.contarNoLeidas(idEmpleado) });

async function marcarLeida(idEmpleado, idNotificacion) {
  const id = validarUuid(idNotificacion, "idNotificacion");
  // Una notificación ajena se responde igual que una inexistente.
  const notificacion = await modelo.marcarLeida(id, idEmpleado);
  if (!notificacion) throw new ErrorApp(404, "Notificación no encontrada.");
  return notificacion;
}

async function marcarTodasLeidas(idEmpleado) {
  return { marcadas: await modelo.marcarTodasLeidas(idEmpleado), no_leidas: 0 };
}

module.exports = {
  TIPO_NOTIFICACION,
  notificarResolucionSolicitud,
  listarMisNotificaciones,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
};

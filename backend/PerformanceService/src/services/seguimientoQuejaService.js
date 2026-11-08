const pool = require("../config/db");
const modelo = require("../models/seguimientoQuejaModel");
const casosModelo = require("../models/casosQuejaModel");
const casos = require("./casosQuejaService");
const { enTransaccion } = require("../config/transaccion");
const { enviarAvisoResolucion } = require("./avisosExternos");
const { ErrorApp } = require("../utils/errores");
const { cifrarTexto, descifrarTexto } = require("../utils/cifrado");
const { ESTADO_QUEJA } = require("../utils/quejas");
const { ESTADO_NOTIFICACION, CODIGO_NOTIFICACION, normalizarUuid, nombreCompleto } = require("../utils/casosQueja");
const {
  transicionesDesde,
  esTransicionValida,
  admiteAcciones,
  validarAccion,
  validarCambioEstado,
  armarAvisoResolucion,
} = require("../utils/seguimientoQueja");

const NO_ENCONTRADA = "No se encontró la queja.";
const NO_ASIGNADA = "Este caso no está asignado a usted.";
const SOLO_RESPONSABLE = "Solo el responsable asignado a este caso puede registrar acciones y cambiar su estado.";
const QUEJA_CERRADA = "El caso ya está cerrado y no admite cambios.";

function idQuejaValido(idQueja) {
  const id = normalizarUuid(idQueja);
  if (!id) throw new ErrorApp(404, NO_ENCONTRADA);
  return id;
}

const empleado = (id, nombres, apellidos) => ({ id_empleado: id, nombre_completo: nombreCompleto(nombres, apellidos) });

async function exigirResponsable(db, idQueja, idEmpleado, mensaje = SOLO_RESPONSABLE) {
  const vigente = await casosModelo.obtenerResponsableVigente(db, idQueja);
  if (!idEmpleado || vigente !== idEmpleado) throw new ErrorApp(403, mensaje);
}

async function bloquearParaGestion(db, idQueja, idEmpleado) {
  const queja = await casosModelo.bloquearQueja(db, idQueja);
  if (!queja) throw new ErrorApp(404, NO_ENCONTRADA);
  await exigirResponsable(db, idQueja, idEmpleado);
  if (queja.es_final) throw new ErrorApp(409, QUEJA_CERRADA);
  return queja;
}

const listarCatalogos = () => casos.listarCatalogos();

const listarAsignados = (consulta, idEmpleado) => casos.listarCasos(consulta, { idResponsable: idEmpleado });

async function obtenerAsignado(idQueja, idEmpleado) {
  const id = idQuejaValido(idQueja);
  await exigirResponsable(pool, id, idEmpleado, NO_ASIGNADA);
  const caso = await casos.obtenerCaso(id);
  return { ...caso, denunciante: null, derivaciones: [] };
}

const avisoDe = (fila) =>
  fila.aviso_codigo
    ? { estado: { codigo: fila.aviso_codigo, nombre: fila.aviso_nombre }, notificada_en: fila.aviso_resolucion_en }
    : null;

async function obtenerSeguimiento(idQueja, { esAdministrador, idEmpleado }) {
  const id = idQuejaValido(idQueja);
  const vigente = await casosModelo.obtenerResponsableVigente(pool, id);
  const esResponsable = Boolean(idEmpleado) && vigente === idEmpleado;
  if (!esAdministrador && !esResponsable) throw new ErrorApp(403, NO_ASIGNADA);

  const [queja, acciones, tipos, estados] = await Promise.all([
    modelo.obtenerSituacion(id),
    modelo.listarAcciones(id),
    modelo.listarTiposAccion(),
    casosModelo.listarEstados(),
  ]);
  if (!queja) throw new ErrorApp(404, NO_ENCONTRADA);

  const puedeActuar = esResponsable && !queja.es_final;
  const transiciones = puedeActuar
    ? transicionesDesde(queja.id_estado_queja)
        .map((idEstado) => estados.find((estado) => estado.id_estado_queja === idEstado))
        .filter(Boolean)
        .map((estado) => ({ id_estado_queja: estado.id_estado_queja, codigo: estado.codigo, nombre: estado.nombre }))
    : [];
  const aviso = avisoDe(queja);

  return {
    id_queja: id,
    acciones: acciones.map((fila) => ({
      id_accion: fila.id_accion,
      tipo: { codigo: fila.tipo_codigo, nombre: fila.tipo_nombre },
      descripcion: descifrarTexto(fila.descripcion),
      registrada_por: empleado(fila.id_empleado_registrador, fila.nombres, fila.apellidos),
      registrada_en: fila.creado_en,
    })),
    resolucion: queja.resolucion ? { descripcion: descifrarTexto(queja.resolucion), aviso } : null,
    gestion: {
      puede_actuar: puedeActuar,
      puede_registrar_acciones: puedeActuar && admiteAcciones(queja.id_estado_queja),
      transiciones,
      tipos_accion: tipos,
      puede_reintentar_aviso: esResponsable && Boolean(aviso) && aviso.estado.codigo !== "ENTREGADO",
    },
  };
}

async function registrarAccion({ idQueja, cuerpo = {}, idEmpleado }) {
  const id = idQuejaValido(idQueja);
  const tipos = await modelo.listarTiposAccion();
  const datos = validarAccion(cuerpo, new Set(tipos.map((tipo) => tipo.id_tipo_accion_queja)));

  const fila = await enTransaccion(async (db) => {
    const queja = await bloquearParaGestion(db, id, idEmpleado);
    if (!admiteAcciones(queja.id_estado_queja)) {
      throw new ErrorApp(409, "El caso todavía no está en atención: no admite acciones.");
    }
    const accion = await modelo.insertarAccion(db, {
      idQueja: id,
      idTipo: datos.idTipo,
      idEmpleado,
      descripcion: cifrarTexto(datos.descripcion),
    });
    await casosModelo.actualizarQueja(db, { idQueja: id });
    return accion;
  });

  return {
    id_accion: fila.id_accion,
    tipo: { codigo: fila.tipo_codigo, nombre: fila.tipo_nombre },
    descripcion: datos.descripcion,
    registrada_por: empleado(idEmpleado, fila.nombres, fila.apellidos),
    registrada_en: fila.creado_en,
  };
}

async function avisarDenunciante(idQueja, idRemitente) {
  let datos;
  try {
    datos = await modelo.obtenerDatosAvisoResolucion(idQueja);
  } catch (error) {
    console.error("No se pudo preparar el aviso de resolución de la queja:", error.name);
  }
  if (datos && (datos.es_anonima || !datos.id_empleado_denunciante)) return null;

  let estado = ESTADO_NOTIFICACION.FALLIDO;
  if (datos) {
    try {
      const aviso = armarAvisoResolucion({ codigoSeguimiento: datos.codigo_seguimiento });
      const resultado = await enviarAvisoResolucion({ idRemitente, idDenunciante: datos.id_empleado_denunciante, aviso });
      if (resultado.entregado) estado = ESTADO_NOTIFICACION.ENTREGADO;
    } catch (error) {
      console.error("No se pudo enviar el aviso de resolución de la queja:", error.name);
    }
  }

  try {
    const fila = await modelo.registrarAvisoResolucion(idQueja, estado);
    return { estado: CODIGO_NOTIFICACION[estado], notificada_en: fila?.aviso_resolucion_en ?? null };
  } catch (error) {
    console.error("No se pudo registrar el estado del aviso de resolución:", error.name);
    return { estado: CODIGO_NOTIFICACION[ESTADO_NOTIFICACION.PENDIENTE], notificada_en: null };
  }
}

function errorTransicion(estados, desde, hacia) {
  const nombre = (idEstado) => estados.find((estado) => estado.id_estado_queja === idEstado)?.nombre ?? "desconocido";
  const permitidos = transicionesDesde(desde).map((idEstado) => `«${nombre(idEstado)}»`);
  const detalle = permitidos.length
    ? `Desde «${nombre(desde)}» solo puede pasar a ${permitidos.join(" o ")}.`
    : `El estado «${nombre(desde)}» no admite cambios.`;
  return new ErrorApp(409, `No se puede pasar el caso de «${nombre(desde)}» a «${nombre(hacia)}». ${detalle}`, [
    { campo: "id_estado_queja", mensaje: detalle },
  ]);
}

async function cambiarEstado({ idQueja, cuerpo = {}, idEmpleado }) {
  const id = idQuejaValido(idQueja);
  const estados = await casosModelo.listarEstados();
  const datos = validarCambioEstado(cuerpo, new Set(estados.map((estado) => estado.id_estado_queja)));
  const resuelve = datos.idEstado === ESTADO_QUEJA.RESUELTA;

  const cambio = await enTransaccion(async (db) => {
    const queja = await bloquearParaGestion(db, id, idEmpleado);
    if (!esTransicionValida(queja.id_estado_queja, datos.idEstado)) {
      throw errorTransicion(estados, queja.id_estado_queja, datos.idEstado);
    }
    const identificada = Boolean(queja.id_empleado_denunciante);
    await modelo.cambiarEstado(db, {
      idQueja: id,
      idEstado: datos.idEstado,
      resolucion: resuelve ? cifrarTexto(datos.resolucion) : null,
      idEstadoAviso: resuelve && identificada ? ESTADO_NOTIFICACION.PENDIENTE : null,
    });
    const transicion = await modelo.insertarTransicion(db, {
      idQueja: id,
      idEstadoAnterior: queja.id_estado_queja,
      idEstado: datos.idEstado,
      idEmpleado,
    });
    return { idEstadoAnterior: queja.id_estado_queja, cambiadoEn: transicion.fecha_cambio, identificada };
  });

  const avisoResolucion = resuelve && cambio.identificada ? await avisarDenunciante(id, idEmpleado) : null;
  const estadoDe = (idEstado) => estados.find((estado) => estado.id_estado_queja === idEstado);
  const nuevo = estadoDe(datos.idEstado);
  const anterior = estadoDe(cambio.idEstadoAnterior);
  return {
    id_queja: id,
    estado: { codigo: nuevo.codigo, nombre: nuevo.nombre, es_final: nuevo.es_final },
    estado_anterior: { codigo: anterior.codigo, nombre: anterior.nombre },
    cambiado_en: cambio.cambiadoEn,
    aviso_resolucion: avisoResolucion,
  };
}

async function reintentarAvisoResolucion({ idQueja, idEmpleado }) {
  const id = idQuejaValido(idQueja);
  const datos = await modelo.obtenerDatosAvisoResolucion(id);
  if (!datos) throw new ErrorApp(404, NO_ENCONTRADA);
  await exigirResponsable(pool, id, idEmpleado);
  if (datos.es_anonima) throw new ErrorApp(409, "La queja es anónima: no hay a quién avisar.");
  if (!datos.id_estado_aviso_resolucion) throw new ErrorApp(409, "El caso todavía no está resuelto.");
  if (datos.id_estado_aviso_resolucion === ESTADO_NOTIFICACION.ENTREGADO) {
    throw new ErrorApp(409, "Quien presentó la queja ya recibió el aviso de resolución.");
  }
  return avisarDenunciante(id, idEmpleado);
}

module.exports = {
  listarCatalogos,
  listarAsignados,
  obtenerAsignado,
  obtenerSeguimiento,
  registrarAccion,
  cambiarEstado,
  reintentarAvisoResolucion,
};

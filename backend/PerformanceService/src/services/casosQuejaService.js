const modelo = require("../models/casosQuejaModel");
const quejasModelo = require("../models/quejasModel");
const { enTransaccion } = require("../config/transaccion");
const { consultarEmpleado, listarResponsables } = require("./empleadosExternos");
const { enviarAvisoDerivacion } = require("./avisosExternos");
const { ErrorApp } = require("../utils/errores");
const { descifrarTexto } = require("../utils/cifrado");
const { ESTADO_QUEJA, ADJUNTOS } = require("../utils/quejas");
const {
  ESTADO_NOTIFICACION,
  CODIGO_NOTIFICACION,
  CONFLICTO_INTERES,
  normalizarUuid,
  nombreCompleto,
  validarClasificacion,
  validarDerivacion,
  leerFiltros,
  armarAviso,
} = require("../utils/casosQueja");

const NO_ENCONTRADA = "No se encontró la queja.";
const QUEJA_CERRADA = "La queja ya está cerrada y no admite cambios.";
const MENSAJE_CONFLICTO =
  "Conflicto de interés: la persona elegida está involucrada en esta queja. Derive el caso a otra persona.";

const empleado = (id, nombres, apellidos) => (id ? { id_empleado: id, nombre_completo: nombreCompleto(nombres, apellidos) } : null);
const categoriaDe = (fila) => ({ id: fila.id_categoria_queja, codigo: fila.categoria_codigo, nombre: fila.categoria_nombre });
const prioridadDe = (fila) =>
  fila.id_prioridad_queja ? { id: fila.id_prioridad_queja, codigo: fila.prioridad_codigo, nombre: fila.prioridad_nombre } : null;
const estadoDe = (fila) => ({
  id: fila.id_estado_queja,
  codigo: fila.estado_codigo,
  nombre: fila.estado_nombre,
  es_final: fila.es_final,
});

function idQuejaValido(idQueja) {
  const id = normalizarUuid(idQueja);
  if (!id) throw new ErrorApp(404, NO_ENCONTRADA);
  return id;
}

async function catalogosDeClasificacion() {
  const [categorias, prioridades] = await Promise.all([quejasModelo.listarCategorias(), modelo.listarPrioridades()]);
  return {
    categorias: new Set(categorias.map((c) => c.id_categoria_queja)),
    prioridades: new Set(prioridades.map((p) => p.id_prioridad_queja)),
  };
}

async function listarCatalogos() {
  const [categorias, prioridades, estados] = await Promise.all([
    quejasModelo.listarCategorias(),
    modelo.listarPrioridades(),
    modelo.listarEstados(),
  ]);
  return { categorias, prioridades, estados };
}

async function listarCasos(consulta) {
  const filtros = leerFiltros(consulta);
  const [filas, total] = await Promise.all([modelo.listarCasos(filtros), modelo.contarCasos(filtros)]);
  return {
    casos: filas.map((fila) => ({
      id_queja: fila.id_queja,
      codigo_seguimiento: fila.codigo_seguimiento,
      es_anonima: fila.es_anonima,
      categoria: categoriaDe(fila),
      prioridad: prioridadDe(fila),
      estado: estadoDe(fila),
      responsable: empleado(fila.id_empleado_responsable, fila.responsable_nombres, fila.responsable_apellidos),
      registrada_en: fila.creado_en,
      actualizada_en: fila.actualizado_en,
    })),
    total,
    pagina: filtros.pagina,
    limite: filtros.limite,
  };
}

const nombreAdjunto = (adjunto) =>
  adjunto.nombre_original
    ? descifrarTexto(adjunto.nombre_original)
    : `adjunto-${adjunto.orden}.${ADJUNTOS.TIPOS[adjunto.tipo_mime] ?? "bin"}`;

const notificacionDe = (fila) => ({
  estado: { codigo: fila.notificacion_codigo, nombre: fila.notificacion_nombre },
  notificada_en: fila.notificada_en,
});

async function obtenerCaso(idQueja) {
  const id = idQuejaValido(idQueja);
  const caso = await modelo.obtenerCaso(id);
  if (!caso) throw new ErrorApp(404, NO_ENCONTRADA);

  const [adjuntos, historial, asignaciones, involucrados] = await Promise.all([
    modelo.listarAdjuntos(id),
    modelo.listarHistorial(id),
    modelo.listarAsignaciones(id),
    modelo.listarInvolucrados(id),
  ]);

  const derivaciones = asignaciones.map((fila) => ({
    id_asignacion: fila.id_asignacion,
    responsable: empleado(fila.id_empleado_responsable, fila.responsable_nombres, fila.responsable_apellidos),
    asignador: empleado(fila.id_empleado_asignador, fila.asignador_nombres, fila.asignador_apellidos),
    comentario: fila.comentario,
    asignada_en: fila.asignada_en,
    notificacion: notificacionDe(fila),
  }));

  return {
    id_queja: caso.id_queja,
    codigo_seguimiento: caso.codigo_seguimiento,
    es_anonima: caso.es_anonima,
    denunciante: caso.es_anonima
      ? null
      : empleado(caso.id_empleado_denunciante, caso.denunciante_nombres, caso.denunciante_apellidos),
    categoria: categoriaDe(caso),
    prioridad: prioridadDe(caso),
    estado: estadoDe(caso),
    asunto: descifrarTexto(caso.asunto),
    descripcion: descifrarTexto(caso.descripcion),
    registrada_en: caso.creado_en,
    actualizada_en: caso.actualizado_en,
    adjuntos: adjuntos.map((adjunto) => ({
      orden: adjunto.orden,
      nombre: nombreAdjunto(adjunto),
      tipo_mime: adjunto.tipo_mime,
      tamano_bytes: adjunto.tamano_bytes,
    })),
    responsable: derivaciones[0]?.responsable ?? null,
    derivaciones,
    involucrados: involucrados.map((fila) => ({
      ...empleado(fila.id_empleado, fila.nombres, fila.apellidos),
      registrado_en: fila.registrado_en,
    })),
    historial: historial.map((paso) => ({
      estado: { codigo: paso.estado_codigo, nombre: paso.estado_nombre },
      estado_anterior: paso.anterior_codigo ? { codigo: paso.anterior_codigo, nombre: paso.anterior_nombre } : null,
      fecha: paso.fecha_cambio,
      registrado_por: empleado(paso.id_empleado_responsable, paso.nombres, paso.apellidos),
      comentario: paso.comentario,
    })),
  };
}

async function quejaEditable(db, idQueja) {
  const queja = await modelo.bloquearQueja(db, idQueja);
  if (!queja) throw new ErrorApp(404, NO_ENCONTRADA);
  if (queja.es_final) throw new ErrorApp(409, QUEJA_CERRADA);
  return queja;
}

async function datosDelAdministrador(idAdministrador) {
  const datos = await consultarEmpleado(idAdministrador);
  if (datos.estado === "no_existe") throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");
  return datos;
}

const sincronizar = (db, idEmpleado, datos) =>
  quejasModelo.sincronizarEmpleado(db, { idEmpleado, nombres: datos.nombres, apellidos: datos.apellidos });

async function clasificar({ idQueja, cuerpo = {} }) {
  const id = idQuejaValido(idQueja);
  const { idCategoria, idPrioridad } = validarClasificacion(cuerpo, await catalogosDeClasificacion());
  const resultado = await enTransaccion(async (db) => {
    await quejaEditable(db, id);
    return modelo.actualizarQueja(db, { idQueja: id, idCategoria, idPrioridad });
  });
  return {
    id_queja: id,
    id_categoria_queja: resultado.id_categoria_queja,
    id_prioridad_queja: resultado.id_prioridad_queja,
    actualizada_en: resultado.actualizado_en,
  };
}

const esInvolucradoRepetido = (error) =>
  error.code === "23505" && error.constraint === "uq_involucrado_queja_empleado";

async function registrarInvolucrado({ idQueja, cuerpo = {}, idAdministrador }) {
  const id = idQuejaValido(idQueja);
  const idEmpleado = normalizarUuid(cuerpo.id_empleado);
  if (!idEmpleado) {
    throw new ErrorApp(400, "Seleccione al empleado involucrado.", [
      { campo: "id_empleado", mensaje: "Seleccione al empleado involucrado." },
    ]);
  }

  const [involucrado, administrador] = await Promise.all([
    consultarEmpleado(idEmpleado),
    datosDelAdministrador(idAdministrador),
  ]);
  if (involucrado.estado === "no_existe") {
    throw new ErrorApp(400, "El empleado seleccionado no existe.", [
      { campo: "id_empleado", mensaje: "El empleado seleccionado no existe." },
    ]);
  }
  if (involucrado.estado !== "encontrado") {
    throw new ErrorApp(503, "No se pudo consultar al personal. Intente nuevamente en unos minutos.");
  }

  try {
    return await enTransaccion(async (db) => {
      await quejaEditable(db, id);
      await sincronizar(db, idAdministrador, administrador);
      await sincronizar(db, idEmpleado, involucrado);
      const fila = await modelo.insertarInvolucrado(db, { idQueja: id, idEmpleado, idRegistrador: idAdministrador });
      const responsableVigente = await modelo.obtenerResponsableVigente(db, id);
      return {
        id_empleado: idEmpleado,
        nombre_completo: nombreCompleto(involucrado.nombres, involucrado.apellidos),
        registrado_en: fila.registrado_en,
        conflicto_con_responsable: responsableVigente === idEmpleado,
      };
    });
  } catch (error) {
    if (esInvolucradoRepetido(error)) throw new ErrorApp(409, "Ese empleado ya figura como involucrado en la queja.");
    throw error;
  }
}

async function quitarInvolucrado({ idQueja, idEmpleado }) {
  const id = idQuejaValido(idQueja);
  const empleadoId = normalizarUuid(idEmpleado);
  const NO_FIGURA = "Ese empleado no figura como involucrado en la queja.";
  if (!empleadoId) throw new ErrorApp(404, NO_FIGURA);
  await enTransaccion(async (db) => {
    await quejaEditable(db, id);
    const borrado = await modelo.borrarInvolucrado(db, { idQueja: id, idEmpleado: empleadoId });
    if (!borrado) throw new ErrorApp(404, NO_FIGURA);
  });
}

async function avisarResponsable(idAsignacion, idRemitente) {
  let estado = ESTADO_NOTIFICACION.FALLIDO;
  try {
    const datos = await modelo.obtenerDatosAviso(idAsignacion);
    const aviso = armarAviso({
      codigoSeguimiento: datos.codigo_seguimiento,
      categoria: datos.categoria,
      prioridadCodigo: datos.prioridad_codigo,
      prioridadNombre: datos.prioridad_nombre,
      derivadaEn: datos.asignada_en,
    });
    const resultado = await enviarAvisoDerivacion({ idRemitente, idResponsable: datos.id_empleado_responsable, aviso });
    if (resultado.entregado) estado = ESTADO_NOTIFICACION.ENTREGADO;
  } catch (error) {
    console.error("No se pudo preparar el aviso al responsable de la queja:", error.name, error.message);
  }

  try {
    const fila = await modelo.registrarNotificacion(idAsignacion, estado);
    return { estado: CODIGO_NOTIFICACION[estado], notificada_en: fila?.notificada_en ?? null };
  } catch (error) {
    console.error("No se pudo registrar el estado del aviso de la queja:", error.name, error.message);
    return { estado: CODIGO_NOTIFICACION[ESTADO_NOTIFICACION.PENDIENTE], notificada_en: null };
  }
}

function errorConflicto() {
  return new ErrorApp(409, MENSAJE_CONFLICTO, [
    { campo: "id_empleado_responsable", codigo: CONFLICTO_INTERES, mensaje: MENSAJE_CONFLICTO },
  ]);
}

async function derivar({ idQueja, cuerpo = {}, idAdministrador }) {
  const id = idQuejaValido(idQueja);
  const datos = validarDerivacion(cuerpo, await catalogosDeClasificacion());

  const candidatos = await listarResponsables();
  const candidato = candidatos.find((persona) => persona.id_empleado === datos.idResponsable);
  if (!candidato) {
    const mensaje = "La persona elegida no puede atender quejas: debe ser de RRHH o supervisor.";
    throw new ErrorApp(422, mensaje, [{ campo: "id_empleado_responsable", mensaje }]);
  }
  const [responsable, administrador] = await Promise.all([
    consultarEmpleado(datos.idResponsable),
    datosDelAdministrador(idAdministrador),
  ]);

  const derivacion = await enTransaccion(async (db) => {
    const queja = await quejaEditable(db, id);
    if (!datos.idPrioridad && !queja.id_prioridad_queja) {
      const mensaje = "Asigne una prioridad antes de derivar la queja.";
      throw new ErrorApp(422, mensaje, [{ campo: "id_prioridad_queja", mensaje }]);
    }
    const esDenunciante = queja.id_empleado_denunciante === datos.idResponsable;
    if (esDenunciante || (await modelo.esInvolucrado(db, id, datos.idResponsable))) throw errorConflicto();
    if ((await modelo.obtenerResponsableVigente(db, id)) === datos.idResponsable) {
      throw new ErrorApp(409, "El caso ya está derivado a esa persona.");
    }

    await sincronizar(db, idAdministrador, administrador);
    await sincronizar(db, datos.idResponsable, responsable);
    const idEstadoNuevo = queja.id_estado_queja === ESTADO_QUEJA.REGISTRADA ? ESTADO_QUEJA.ASIGNADA : null;
    const actualizada = await modelo.actualizarQueja(db, {
      idQueja: id,
      idCategoria: datos.idCategoria,
      idPrioridad: datos.idPrioridad,
      idEstado: idEstadoNuevo,
    });
    const asignacion = await modelo.insertarAsignacion(db, {
      idQueja: id,
      idResponsable: datos.idResponsable,
      idAsignador: idAdministrador,
      comentario: datos.comentario,
    });
    if (idEstadoNuevo) {
      await modelo.insertarHistorial(db, {
        idQueja: id,
        idEstadoAnterior: queja.id_estado_queja,
        idEstado: idEstadoNuevo,
        idEmpleado: idAdministrador,
      });
    }
    return { ...asignacion, idEstado: actualizada.id_estado_queja };
  });

  const [notificacion, estado] = await Promise.all([
    avisarResponsable(derivacion.id_asignacion, idAdministrador),
    quejasModelo.obtenerEstado(derivacion.idEstado),
  ]);
  return {
    id_asignacion: derivacion.id_asignacion,
    asignada_en: derivacion.asignada_en,
    responsable: {
      id_empleado: datos.idResponsable,
      nombre_completo: nombreCompleto(responsable.nombres, responsable.apellidos) ?? candidato.nombre_completo,
    },
    estado: { codigo: estado.codigo, nombre: estado.nombre },
    notificacion,
  };
}

async function reintentarAviso({ idQueja, idAdministrador }) {
  const id = idQuejaValido(idQueja);
  const asignacion = await modelo.obtenerUltimaAsignacion(id);
  if (!asignacion) throw new ErrorApp(404, "La queja todavía no se derivó a un responsable.");
  if (asignacion.id_estado_notificacion === ESTADO_NOTIFICACION.ENTREGADO) {
    throw new ErrorApp(409, "El responsable ya recibió el aviso de esta derivación.");
  }
  return avisarResponsable(asignacion.id_asignacion, idAdministrador);
}

module.exports = {
  listarCatalogos,
  listarCasos,
  obtenerCaso,
  listarResponsables,
  clasificar,
  registrarInvolucrado,
  quitarInvolucrado,
  derivar,
  reintentarAviso,
};

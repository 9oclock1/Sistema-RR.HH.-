const { randomUUID } = require("node:crypto");
const modelo = require("../models/finiquitosModel");
const finiquitoPdf = require("./finiquitoPdf");
const integracion = require("./integracionFiniquitosService");
const empleadosCliente = require("../clients/empleados.cliente");
const { topicoPropio } = require("./eventos.service");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { DESTINOS } = require("../utils/integraciones");
const { validarAdmin, validarConsulta, identidadRegistro, ESTADOS_ABIERTOS } = require("../utils/desvinculaciones");
const {
  aCentavos,
  simulacionFiniquitoActiva,
  validarFiltroEstadoFiniquito,
  consolidarFiniquito,
  finiquitoCoincide,
  armarMensajeOrdenPagoFiniquito,
  armarMensajeAsientoFiniquito,
  armarRespuestaSimulada,
  validarDestinoFiniquito,
  validarSimulacionEscenario,
  validarCaidaBroker,
} = require("../utils/finiquitos");

const noEncontrado = () => new ErrorApp(404, "Proceso de desvinculación no encontrado.");
const procesoNoAbierto = () =>
  new ErrorApp(
    409,
    "Solo se puede emitir el finiquito de un proceso de liquidación abierto (iniciado o en curso).",
    undefined,
    "PROCESO_NO_ABIERTO"
  );

function normalizarIdProceso(idProceso) {
  if (!UUID_RE.test(idProceso ?? "")) throw noEncontrado();
  return idProceso.toLowerCase();
}

async function nombreEmpleadoSeguro(idEmpleado) {
  if (!idEmpleado) return null;
  try {
    const emp = await empleadosCliente.obtenerEmpleado(idEmpleado);
    if (!emp) return null;
    return emp.nombre_completo || [emp.nombres, emp.apellidos].filter(Boolean).join(" ") || null;
  } catch {
    return null;
  }
}

function construirRequisitos({ promedio, beneficios, saldos }) {
  const promedioCents = promedio ? aCentavos(promedio.promedio) : null;
  return {
    promedio: {
      calculado: Boolean(promedio),
      monto: promedio ? Number(promedio.promedio) : null,
    },
    beneficios: {
      calculado: Boolean(beneficios),
      total: beneficios ? Number(beneficios.total) : null,
      desactualizado: Boolean(beneficios && (promedioCents === null || aCentavos(beneficios.promedio_base) !== promedioCents)),
    },
    saldos: {
      calculado: Boolean(saldos),
      total: saldos ? Number(saldos.total) : null,
      desactualizado: Boolean(saldos && (promedioCents === null || aCentavos(saldos.promedio) !== promedioCents)),
    },
  };
}

function resumirEnvio(evento) {
  if (!evento) return null;
  return {
    estado: evento.estado,
    intentos: Number(evento.intentos),
    ultimo_error: evento.ultimo_error,
    proximo_intento_en: evento.proximo_intento_en,
    entregado_en: evento.entregado_en,
  };
}

function construirIntegraciones(finiquito, envios = {}) {
  const crearBloque = (destino, prefijo) => ({
    grupo: DESTINOS[destino].grupo,
    modulo: DESTINOS[destino].modulo,
    envio: resumirEnvio(envios[destino]),
    respuesta: {
      estado: finiquito ? finiquito[`estado_${prefijo}`] : "PENDIENTE",
      referencia: finiquito ? finiquito[`referencia_${prefijo}`] : null,
      motivo: finiquito ? finiquito[`motivo_${prefijo}`] : null,
      respondida_en: finiquito ? finiquito[`respondida_${prefijo}_en`] : null,
    },
  });

  return {
    PAGOS: crearBloque("PAGOS", "pagos"),
    CONTABILIDAD: crearBloque("CONTABILIDAD", "contabilidad"),
  };
}

async function listar(filtros = {}, identidad) {
  validarConsulta(identidad);
  const estadoFiniquito = validarFiltroEstadoFiniquito(filtros.estado_finiquito);
  return modelo.listarProcesos({ estado_finiquito: estadoFiniquito });
}

async function obtener(idProceso, identidad) {
  validarConsulta(identidad);
  const id = normalizarIdProceso(idProceso);
  const proceso = await modelo.obtenerProcesoDetalle(id);
  if (!proceso) throw noEncontrado();

  const [insumos, finiquito] = await Promise.all([
    modelo.obtenerInsumos(id, proceso.id_empleado),
    modelo.obtenerPorProceso(id),
  ]);
  const envios = finiquito ? await modelo.ultimosEnviosPorDestino(finiquito.id_finiquito) : {};

  return {
    proceso: {
      id_proceso: proceso.id_proceso,
      id_empleado: proceso.id_empleado,
      nombre_empleado: proceso.nombre_empleado,
      fecha_ingreso: proceso.fecha_ingreso,
      fecha_retiro: proceso.fecha_retiro,
      causal: { codigo: proceso.codigo_causal, nombre: proceso.causal_nombre },
      corresponde_desahucio: proceso.corresponde_desahucio,
      estado: proceso.estado,
      observaciones: proceso.observaciones,
    },
    requisitos: construirRequisitos(insumos),
    finiquito,
    integraciones: construirIntegraciones(finiquito, envios),
    simulacion_activa: simulacionFiniquitoActiva(),
    caida_simulada_hasta: integracion.obtenerCaidaBroker(),
  };
}

// AC1: consolida beneficios sociales, saldos proporcionales y préstamos activos en estado BORRADOR.
async function generar(idProceso, identidad) {
  validarAdmin(identidad);
  const id = normalizarIdProceso(idProceso);
  const registro = identidadRegistro(identidad);

  await enTransaccion(async (cliente) => {
    const proceso = await modelo.bloquearProceso(cliente, id);
    if (!proceso) throw noEncontrado();
    if (!ESTADOS_ABIERTOS.includes(proceso.estado)) throw procesoNoAbierto();

    const existente = await modelo.obtenerPorProceso(id, cliente, { bloquear: true });
    if (existente && existente.estado !== "BORRADOR") {
      throw new ErrorApp(
        409,
        "El finiquito ya fue aprobado y no puede volver a generarse.",
        undefined,
        "FINIQUITO_APROBADO"
      );
    }

    const insumos = await modelo.obtenerInsumos(id, proceso.id_empleado, cliente);
    const consolidado = consolidarFiniquito({ proceso, ...insumos });

    await modelo.guardarBorrador(cliente, {
      id_finiquito: existente?.id_finiquito ?? null,
      id_proceso: id,
      fecha_retiro: proceso.fecha_retiro,
      codigo_causal: proceso.codigo_causal,
      promedio_base: insumos.beneficios.promedio_base,
      anios_servicio: insumos.beneficios.anios_servicio,
      meses_servicio: insumos.beneficios.meses_servicio,
      dias_fraccion: insumos.beneficios.dias_fraccion,
      total_ingresos: consolidado.total_ingresos,
      total_descuentos: consolidado.total_descuentos,
      liquido_pagable: consolidado.liquido_pagable,
      generado_por: registro.registrado_por,
      renglones: consolidado.renglones,
    });
  });

  return obtener(id, identidad);
}

// AC2, AC3: aprueba el borrador, genera el PDF y encola en la misma transacción los eventos hacia Pagos y Contabilidad.
async function aprobar(idProceso, identidad) {
  validarAdmin(identidad);
  const id = normalizarIdProceso(idProceso);
  const registro = identidadRegistro(identidad);
  const aprobadorNombre = await nombreEmpleadoSeguro(registro.registrado_por);

  await enTransaccion(async (cliente) => {
    const proceso = await modelo.bloquearProceso(cliente, id);
    if (!proceso) throw noEncontrado();

    const actual = await modelo.obtenerPorProceso(id, cliente, { bloquear: true });
    if (!actual) {
      throw new ErrorApp(
        404,
        "Aún no se generó el borrador del finiquito para este proceso.",
        undefined,
        "FINIQUITO_NO_GENERADO"
      );
    }
    if (actual.estado !== "BORRADOR") {
      throw new ErrorApp(
        409,
        "El finiquito ya fue aprobado.",
        undefined,
        "FINIQUITO_APROBADO"
      );
    }

    const insumos = await modelo.obtenerInsumos(id, proceso.id_empleado, cliente);
    const consolidado = consolidarFiniquito({ proceso, ...insumos });
    if (!finiquitoCoincide(actual, consolidado, proceso, insumos.beneficios)) {
      throw new ErrorApp(
        409,
        "Los cálculos cambiaron después de generar el borrador: vuelva a generarlo antes de aprobar.",
        undefined,
        "BORRADOR_DESACTUALIZADO"
      );
    }

    const numeroDocumento = await modelo.siguienteNumeroDocumento(cliente);
    const aprobado = await modelo.marcarAprobado(cliente, actual.id_finiquito, {
      numero_documento: numeroDocumento,
      aprobado_por: registro.registrado_por,
      aprobado_por_rol: registro.registrado_por_rol,
    });

    const finiquitoAprobado = {
      ...actual,
      estado: "APROBADO",
      numero_documento: numeroDocumento,
      aprobado_por: registro.registrado_por,
      aprobado_por_rol: registro.registrado_por_rol,
      aprobado_en: aprobado.aprobado_en,
    };

    const pdf = await finiquitoPdf.aPdf({
      proceso,
      finiquito: finiquitoAprobado,
      aprobadorNombre,
    });
    await modelo.guardarDocumento(cliente, actual.id_finiquito, pdf);

    const topico = topicoPropio();
    const fechaEvento = new Date().toISOString();

    const idMsgPagos = randomUUID();
    const cargaPagos = armarMensajeOrdenPagoFiniquito({
      idMensaje: idMsgPagos,
      fecha: fechaEvento,
      proceso,
      finiquito: finiquitoAprobado,
      aprobadoPorNombre: aprobadorNombre,
    });
    await modelo.registrarEvento(cliente, {
      idMensaje: idMsgPagos,
      idFiniquito: actual.id_finiquito,
      sentido: "SALIENTE",
      destino: "PAGOS",
      tipoEvento: cargaPagos.encabezado.tipo,
      topico,
      carga: cargaPagos,
    });

    const idMsgContabilidad = randomUUID();
    const cargaContabilidad = armarMensajeAsientoFiniquito({
      idMensaje: idMsgContabilidad,
      fecha: fechaEvento,
      proceso,
      finiquito: finiquitoAprobado,
    });
    await modelo.registrarEvento(cliente, {
      idMensaje: idMsgContabilidad,
      idFiniquito: actual.id_finiquito,
      sentido: "SALIENTE",
      destino: "CONTABILIDAD",
      tipoEvento: cargaContabilidad.encabezado.tipo,
      topico,
      carga: cargaContabilidad,
    });
  });

  return obtener(id, identidad);
}

async function reenviar(idProceso, datos, identidad) {
  validarAdmin(identidad);
  const id = normalizarIdProceso(idProceso);
  const destino = validarDestinoFiniquito(datos?.destino);

  await enTransaccion(async (cliente) => {
    const proceso = await modelo.bloquearProceso(cliente, id);
    if (!proceso) throw noEncontrado();

    const finiquito = await modelo.obtenerPorProceso(id, cliente, { bloquear: true });
    if (!finiquito) {
      throw new ErrorApp(404, "Aún no se generó el finiquito para este proceso.", undefined, "FINIQUITO_NO_GENERADO");
    }
    if (finiquito.estado !== "APROBADO") {
      throw new ErrorApp(
        409,
        "Solo se puede reenviar una integración de un finiquito aprobado.",
        undefined,
        "FINIQUITO_NO_APROBADO"
      );
    }

    const envios = await modelo.ultimosEnviosPorDestino(finiquito.id_finiquito, cliente);
    const ultimoEnvio = envios[destino];
    const estadoRespuesta = destino === "PAGOS" ? finiquito.estado_pagos : finiquito.estado_contabilidad;
    if (estadoRespuesta !== "RECHAZADA" && ultimoEnvio?.estado !== "FALLIDO") {
      throw new ErrorApp(
        409,
        `Solo puede reenviar a ${DESTINOS[destino].modulo} cuando la integración fue rechazada o el envío falló.`,
        undefined,
        "REENVIO_NO_PERMITIDO"
      );
    }

    const aprobadorNombre = await nombreEmpleadoSeguro(finiquito.aprobado_por);
    await modelo.limpiarRespuestaParaReenvio(cliente, finiquito.id_finiquito, destino);

    const idMensaje = randomUUID();
    const fechaEvento = new Date().toISOString();
    const carga =
      destino === "PAGOS"
        ? armarMensajeOrdenPagoFiniquito({
            idMensaje,
            fecha: fechaEvento,
            proceso,
            finiquito,
            aprobadoPorNombre: aprobadorNombre,
          })
        : armarMensajeAsientoFiniquito({
            idMensaje,
            fecha: fechaEvento,
            proceso,
            finiquito,
          });

    await modelo.registrarEvento(cliente, {
      idMensaje,
      idFiniquito: finiquito.id_finiquito,
      sentido: "SALIENTE",
      destino,
      tipoEvento: carga.encabezado.tipo,
      topico: topicoPropio(),
      carga,
    });
  });

  return obtener(id, identidad);
}

async function simularRespuesta(idProceso, datos, identidad) {
  validarAdmin(identidad);
  if (!simulacionFiniquitoActiva()) {
    throw new ErrorApp(403, "La simulación de respuestas de finiquito está desactivada.");
  }

  const id = normalizarIdProceso(idProceso);
  const { destino, escenario, referencia, motivo } = validarSimulacionEscenario(datos);

  const proceso = await modelo.obtenerProcesoDetalle(id);
  if (!proceso) throw noEncontrado();

  const finiquito = await modelo.obtenerPorProceso(id);
  if (!finiquito) {
    throw new ErrorApp(404, "Aún no se generó el finiquito para este proceso.", undefined, "FINIQUITO_NO_GENERADO");
  }
  if (finiquito.estado === "BORRADOR") {
    throw new ErrorApp(409, "Apruebe el finiquito antes de simular respuestas externas.", undefined, "FINIQUITO_NO_APROBADO");
  }
  if (finiquito.estado === "PAGADO" && !["DUPLICADO", "INVALIDO"].includes(escenario)) {
    throw new ErrorApp(
      409,
      "El finiquito ya está pagado: solo puede simular duplicados o mensajes inválidos.",
      undefined,
      "FINIQUITO_PAGADO"
    );
  }

  const topico = topicoPropio();
  let carga;
  let idMensaje;

  if (escenario === "DUPLICADO") {
    const ultima = await modelo.obtenerUltimaRespuestaEntrante(finiquito.id_finiquito, destino);
    if (!ultima) {
      throw new ErrorApp(
        409,
        `Todavía no hay una respuesta recibida de ${DESTINOS[destino].modulo} para duplicar.`,
        undefined,
        "SIN_RESPUESTA_PREVIA"
      );
    }
    try {
      carga = JSON.parse(ultima.carga);
    } catch {
      throw new ErrorApp(409, "La última respuesta registrada no es un JSON reutilizable.", undefined, "RESPUESTA_NO_REUTILIZABLE");
    }
    idMensaje = carga.encabezado?.id_mensaje || ultima.id_mensaje;
  } else {
    const envios = await modelo.ultimosEnviosPorDestino(finiquito.id_finiquito);
    const ultimoEnvio = envios[destino];
    if (!ultimoEnvio && escenario !== "INVALIDO") {
      throw new ErrorApp(409, `Aún no existe un envío saliente hacia ${DESTINOS[destino].modulo}.`, undefined, "SIN_ENVIO_SALIENTE");
    }
    idMensaje = randomUUID();
    const prefijo = destino === "PAGOS" ? "OP" : "AS";
    const refDefecto = `${prefijo}-${finiquito.numero_documento}`;

    carga = armarRespuestaSimulada({
      idMensaje,
      destino,
      idFiniquito: finiquito.id_finiquito,
      idMensajeOrigen: ultimoEnvio?.id_mensaje ?? randomUUID(),
      resultado: escenario === "INVALIDO" ? "DESCONOCIDO" : escenario,
      referencia: escenario === "CONFIRMADA" ? referencia || refDefecto : null,
      motivo: escenario === "RECHAZADA" ? motivo : null,
    });
  }

  const idEvento = await modelo.registrarEvento(require("../config/db"), {
    idMensaje,
    idFiniquito: finiquito.id_finiquito,
    sentido: "RESPUESTA_SIMULADA",
    destino,
    tipoEvento: carga.encabezado.tipo,
    topico,
    carga,
  });

  return {
    id_evento: idEvento,
    id_mensaje: idMensaje,
    destino,
    escenario,
    topico,
  };
}

async function simularCaidaBroker(datos, identidad) {
  validarAdmin(identidad);
  if (!simulacionFiniquitoActiva()) {
    throw new ErrorApp(403, "La simulación está desactivada.");
  }
  const segundos = validarCaidaBroker(datos);
  return integracion.activarCaidaBroker(segundos);
}

async function descargarPdf(idProceso, identidad) {
  validarConsulta(identidad);
  const id = normalizarIdProceso(idProceso);
  const proceso = await modelo.obtenerProcesoDetalle(id);
  if (!proceso) throw noEncontrado();

  const finiquito = await modelo.obtenerPorProceso(id);
  if (!finiquito) {
    throw new ErrorApp(404, "Aún no se generó el finiquito para este proceso.", undefined, "FINIQUITO_NO_GENERADO");
  }
  if (finiquito.estado === "BORRADOR") {
    throw new ErrorApp(
      409,
      "Solo se puede descargar el documento oficial cuando el finiquito está aprobado o pagado.",
      undefined,
      "FINIQUITO_NO_APROBADO"
    );
  }

  const existente = await modelo.obtenerDocumento(finiquito.id_finiquito);
  if (existente) {
    return { nombre_archivo: existente.nombre_archivo, contenido: existente.contenido };
  }

  const aprobadorNombre = await nombreEmpleadoSeguro(finiquito.aprobado_por);
  const generado = await finiquitoPdf.aPdf({ proceso, finiquito, aprobadorNombre });
  await modelo.guardarDocumento(require("../config/db"), finiquito.id_finiquito, generado);
  return generado;
}

module.exports = {
  listar,
  obtener,
  generar,
  aprobar,
  reenviar,
  simularRespuesta,
  simularCaidaBroker,
  descargarPdf,
};

const { randomUUID } = require("node:crypto");
const modelo = require("../models/cierresModel");
const empleadosCliente = require("../clients/empleados.cliente");
const authCliente = require("../clients/authCliente");
const integracion = require("./integracionCierresService");
const { topicoPropio } = require("./eventos.service");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { validarAdmin, validarConsulta, identidadRegistro, ESTADOS_ABIERTOS } = require("../utils/desvinculaciones");
const {
  CLAVES_DESTINO,
  DESTINOS_CIERRE,
  simulacionCierreActiva,
  validarFiltroEstadoCierre,
  validarDestinoCierre,
  validarSimulacionEscenarioCierre,
  validarSinRespuesta,
  resumirEstadoCierre,
  evaluarRequisitosCierre,
  armarMensajeDesvinculado,
  armarRespuestaSimuladaCierre,
} = require("../utils/cierres");

const URL_EMPLEADOS = () => process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const TIEMPO_ESPERA_MS = Number(process.env.EMPLOYEE_SERVICE_TIMEOUT_MS) || 5000;

const noEncontrado = () => new ErrorApp(404, "Proceso de desvinculación no encontrado.");

function normalizarIdProceso(idProceso) {
  if (!UUID_RE.test(idProceso ?? "")) throw noEncontrado();
  return idProceso.toLowerCase();
}

async function obtenerFichaEmpleado(idEmpleado) {
  let respuesta;
  try {
    respuesta = await fetch(`${URL_EMPLEADOS()}/empleados/${encodeURIComponent(idEmpleado)}/ficha`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
  } catch {
    throw new ErrorApp(503, "No se pudo consultar la ficha del colaborador en EmployeeService. Intente nuevamente.");
  }
  if (!respuesta.ok) {
    throw new ErrorApp(503, "No se pudo consultar la ficha del colaborador en EmployeeService. Intente nuevamente.");
  }
  const ficha = await respuesta.json().catch(() => null);
  if (!ficha?.numero_documento) {
    throw new ErrorApp(503, "No se pudo obtener el código de empleado desde EmployeeService. Intente nuevamente.");
  }
  return ficha;
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

function construirRevocaciones(revocaciones = [], envios = {}) {
  const porDestino = new Map(revocaciones.map((r) => [r.destino, r]));
  const ahora = Date.now();
  return CLAVES_DESTINO.map((destino) => {
    const cfg = DESTINOS_CIERRE[destino];
    const fila = porDestino.get(destino);
    const envio = resumirEnvio(envios[destino]);
    const venceMs = fila?.plazo_vence_en ? Date.parse(fila.plazo_vence_en) : null;
    const plazoRestante =
      fila?.estado === "ENVIADA" && Number.isFinite(venceMs)
        ? Math.max(0, Math.ceil((venceMs - ahora) / 1000))
        : null;

    return {
      destino,
      grupo: cfg.grupo,
      modulo: cfg.modulo,
      accesos_a_revocar: cfg.accesos,
      estado: fila?.estado ?? "PENDIENTE",
      plazo_vence_en: fila?.plazo_vence_en ?? null,
      plazo_restante_segundos: plazoRestante,
      reenvios_por_plazo: fila ? Number(fila.reenvios_por_plazo) : 0,
      recursos_revocados: fila?.recursos_revocados ?? null,
      referencia: fila?.referencia ?? null,
      motivo: fila?.motivo ?? null,
      respondida_en: fila?.respondida_en ?? null,
      envio,
    };
  });
}

async function listar(filtros = {}, identidad) {
  validarConsulta(identidad);
  const estado = validarFiltroEstadoCierre(filtros?.estado);
  return modelo.listarProcesosParaCierre({ estado });
}

async function obtener(idProceso, identidad) {
  validarConsulta(identidad);
  const id = normalizarIdProceso(idProceso);

  const proceso = await modelo.obtenerProcesoParaCierre(id);
  if (!proceso) throw noEncontrado();

  const [finiquito, cierre, empleado, acceso] = await Promise.all([
    modelo.obtenerFiniquitoDeProceso(id),
    modelo.obtenerCierrePorProceso(id),
    empleadosCliente.obtenerEmpleado(proceso.id_empleado).catch(() => null),
    authCliente.consultarAcceso(proceso.id_empleado),
  ]);

  let revocaciones = [];
  if (cierre) {
    const [filasRev, envios] = await Promise.all([
      modelo.listarRevocacionesCierre(cierre.id_cierre),
      modelo.ultimosEnviosPorDestino(cierre.id_cierre),
    ]);
    revocaciones = construirRevocaciones(filasRev, envios);
  }

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
    finiquito: finiquito
      ? {
          id_finiquito: finiquito.id_finiquito,
          numero_documento: finiquito.numero_documento,
          estado: finiquito.estado,
          liquido_pagable: Number(finiquito.liquido_pagable),
          aprobado_en: finiquito.aprobado_en,
          pagado_en: finiquito.pagado_en,
        }
      : null,
    empleado: empleado
      ? {
          id_empleado: empleado.id_empleado,
          nombres: empleado.nombres,
          apellidos: empleado.apellidos,
          activo: Boolean(empleado.activo),
        }
      : null,
    acceso,
    cierre,
    revocaciones,
    requisitos: evaluarRequisitosCierre({ proceso, finiquito, cierre, estadosAbiertos: ESTADOS_ABIERTOS }),
    simulacion_activa: simulacionCierreActiva(),
    destinos_sin_respuesta: integracion.obtenerDestinosSinRespuesta(),
  };
}

function validarCondicionesCierre({ proceso, finiquito, cierre }) {
  if (!proceso) throw noEncontrado();
  const req = evaluarRequisitosCierre({ proceso, finiquito, cierre, estadosAbiertos: ESTADOS_ABIERTOS });
  if (!req.puede_cerrar) {
    throw new ErrorApp(409, req.motivo, undefined, req.codigo);
  }
}

function datosEmpleadoDesdeFicha(ficha, proceso) {
  return {
    id_empleado: proceso.id_empleado,
    codigo_empleado: ficha.numero_documento,
    nombre_completo: ficha.nombre_completo || proceso.nombre_empleado,
    cargo: ficha.asignacion_actual?.cargo?.nombre ?? null,
    sucursal: ficha.asignacion_actual?.sucursal?.nombre ?? null,
  };
}

// AC1, AC2: inactiva al colaborador, revoca cuenta y tokens, cierra el proceso y encola los 4 envíos SALIENTE.
async function cerrar(idProceso, identidad) {
  validarAdmin(identidad);
  const id = normalizarIdProceso(idProceso);
  const registro = identidadRegistro(identidad);

  const [procPrevio, finPrevio, cierrePrevio] = await Promise.all([
    modelo.obtenerProcesoParaCierre(id),
    modelo.obtenerFiniquitoDeProceso(id),
    modelo.obtenerCierrePorProceso(id),
  ]);
  validarCondicionesCierre({ proceso: procPrevio, finiquito: finPrevio, cierre: cierrePrevio });

  const ficha = await obtenerFichaEmpleado(procPrevio.id_empleado);

  await enTransaccion(async (cliente) => {
    const proceso = await modelo.obtenerProcesoParaCierre(id, cliente, { bloquear: true });
    const finiquito = await modelo.obtenerFiniquitoDeProceso(id, cliente, { bloquear: true });
    const cierreExistente = await modelo.obtenerCierrePorProceso(id, cliente, { bloquear: true });
    validarCondicionesCierre({ proceso, finiquito, cierre: cierreExistente });

    await empleadosCliente.darDeBaja(proceso.id_empleado);
    const empleadoInactivadoEn = new Date().toISOString();

    const resultadoAuth = await authCliente.revocarAcceso(proceso.id_empleado, {
      idProceso: id,
      solicitadoPor: registro.registrado_por,
    });

    const cierre = await modelo.crearCierre(cliente, {
      id_proceso: id,
      id_finiquito: finiquito.id_finiquito,
      id_empleado: proceso.id_empleado,
      estado_finiquito_al_cerrar: finiquito.estado,
      empleado_inactivado_en: empleadoInactivadoEn,
      cuenta_estado: resultadoAuth.cuenta_estado,
      cuenta_revocada_en: resultadoAuth.revocado_en ?? null,
      cerrado_por: registro.registrado_por,
      cerrado_por_rol: registro.registrado_por_rol,
    });

    await modelo.crearRevocacionesIniciales(cliente, cierre.id_cierre, CLAVES_DESTINO);

    const topico = topicoPropio();
    const fechaEvento = new Date().toISOString();
    const empleado = datosEmpleadoDesdeFicha(ficha, proceso);

    for (const destino of CLAVES_DESTINO) {
      const idMensaje = randomUUID();
      const carga = armarMensajeDesvinculado({
        idMensaje,
        destino,
        idCierre: cierre.id_cierre,
        empleado,
        fechaRetiro: proceso.fecha_retiro,
        causal: proceso.codigo_causal,
        cerradoEn: cierre.cerrado_en,
        fecha: fechaEvento,
      });
      await modelo.registrarEvento(cliente, {
        idMensaje,
        idCierre: cierre.id_cierre,
        sentido: "SALIENTE",
        destino,
        tipoEvento: carga.encabezado.tipo,
        topico,
        carga,
      });
    }

    await modelo.cerrarProcesoDesvinculacion(cliente, id);
  });

  return obtener(id, identidad);
}

async function reenviar(idProceso, datos, identidad) {
  validarAdmin(identidad);
  const id = normalizarIdProceso(idProceso);
  const destino = validarDestinoCierre(datos?.destino);

  const procPrevio = await modelo.obtenerProcesoParaCierre(id);
  if (!procPrevio) throw noEncontrado();
  const cierrePrevio = await modelo.obtenerCierrePorProceso(id);
  if (!cierrePrevio) {
    throw new ErrorApp(409, "Aún no se cerró definitivamente este proceso.", undefined, "CIERRE_NO_INICIADO");
  }

  const ficha = await obtenerFichaEmpleado(procPrevio.id_empleado);

  await enTransaccion(async (cliente) => {
    const proceso = await modelo.obtenerProcesoParaCierre(id, cliente, { bloquear: true });
    if (!proceso) throw noEncontrado();
    const cierre = await modelo.obtenerCierrePorProceso(id, cliente, { bloquear: true });
    if (!cierre) {
      throw new ErrorApp(409, "Aún no se cerró definitivamente este proceso.", undefined, "CIERRE_NO_INICIADO");
    }

    const revocaciones = await modelo.bloquearRevocacionesCierre(cliente, cierre.id_cierre);
    const revocacion = revocaciones.find((r) => r.destino === destino);
    const envios = await modelo.ultimosEnviosPorDestino(cierre.id_cierre, cliente);
    const ultimoEnvio = envios[destino];

    const permitida =
      revocacion?.estado === "RECHAZADA" ||
      revocacion?.estado === "VENCIDA" ||
      ultimoEnvio?.estado === "FALLIDO";
    if (!permitida) {
      throw new ErrorApp(
        409,
        `Solo puede reenviar a ${DESTINOS_CIERRE[destino].modulo} cuando la revocación fue rechazada, venció o el envío falló.`,
        undefined,
        "REENVIO_NO_PERMITIDO"
      );
    }

    await modelo.prepararReenvioRevocacion(cliente, cierre.id_cierre, destino);
    const actualizadas = revocaciones.map((r) => (r.destino === destino ? { ...r, estado: "PENDIENTE" } : r));
    await modelo.actualizarEstadoCierre(cliente, cierre.id_cierre, resumirEstadoCierre(actualizadas));

    const idMensaje = randomUUID();
    const carga = armarMensajeDesvinculado({
      idMensaje,
      destino,
      idCierre: cierre.id_cierre,
      empleado: datosEmpleadoDesdeFicha(ficha, proceso),
      fechaRetiro: proceso.fecha_retiro,
      causal: proceso.codigo_causal,
      cerradoEn: cierre.cerrado_en,
    });
    await modelo.registrarEvento(cliente, {
      idMensaje,
      idCierre: cierre.id_cierre,
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
  if (!simulacionCierreActiva()) {
    throw new ErrorApp(403, "La simulación de respuestas de cierre está desactivada.");
  }

  const id = normalizarIdProceso(idProceso);
  const { destino, escenario, referencia, motivo } = validarSimulacionEscenarioCierre(datos);

  const proceso = await modelo.obtenerProcesoParaCierre(id);
  if (!proceso) throw noEncontrado();
  const cierre = await modelo.obtenerCierrePorProceso(id);
  if (!cierre) {
    throw new ErrorApp(409, "Ejecute el cierre definitivo antes de simular respuestas externas.", undefined, "CIERRE_NO_INICIADO");
  }

  const topico = topicoPropio();
  let carga;
  let idMensaje;

  if (escenario === "DUPLICADO") {
    const ultima = await modelo.obtenerUltimaRespuestaEntrante(cierre.id_cierre, destino);
    if (!ultima) {
      throw new ErrorApp(
        409,
        `Todavía no hay una respuesta recibida de ${DESTINOS_CIERRE[destino].modulo} para duplicar.`,
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
    const envios = await modelo.ultimosEnviosPorDestino(cierre.id_cierre);
    const ultimoEnvio = envios[destino];
    if (!ultimoEnvio && escenario !== "INVALIDO") {
      throw new ErrorApp(
        409,
        `Aún no existe un envío saliente hacia ${DESTINOS_CIERRE[destino].modulo}.`,
        undefined,
        "SIN_ENVIO_SALIENTE"
      );
    }
    idMensaje = randomUUID();
    const datosEnvio = ultimoEnvio?.carga?.datos ?? {};
    carga = armarRespuestaSimuladaCierre({
      idMensaje,
      destino,
      idCierre: cierre.id_cierre,
      idMensajeOrigen: ultimoEnvio?.id_mensaje ?? randomUUID(),
      resultado: escenario === "INVALIDO" ? "DESCONOCIDO" : escenario,
      accesosARevocar: datosEnvio.accesos_a_revocar ?? DESTINOS_CIERRE[destino].accesos,
      codigoEmpleado: datosEnvio.empleado?.codigo_empleado ?? "",
      referencia: escenario === "CONFIRMADA" ? referencia : null,
      motivo: escenario === "RECHAZADA" ? motivo : null,
    });
  }

  const idEvento = await modelo.registrarEvento(require("../config/db"), {
    idMensaje,
    idCierre: cierre.id_cierre,
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

async function configurarSinRespuesta(datos, identidad) {
  validarAdmin(identidad);
  if (!simulacionCierreActiva()) {
    throw new ErrorApp(403, "La simulación de respuestas de cierre está desactivada.");
  }
  const { destino, activo } = validarSinRespuesta(datos);
  const destinos = integracion.establecerSinRespuesta(destino, activo);
  return { destinos_sin_respuesta: destinos };
}

module.exports = {
  listar,
  obtener,
  cerrar,
  reenviar,
  simularRespuesta,
  configurarSinRespuesta,
  obtenerFichaEmpleado,
};

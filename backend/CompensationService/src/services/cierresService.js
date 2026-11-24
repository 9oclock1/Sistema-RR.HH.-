const modelo = require("../models/cierresModel");
const empleadosCliente = require("../clients/empleados.cliente");
const authCliente = require("../clients/authCliente");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { validarAdmin, validarConsulta, identidadRegistro, ESTADOS_ABIERTOS } = require("../utils/desvinculaciones");
const {
  CLAVES_DESTINO,
  DESTINOS_CIERRE,
  validarFiltroEstadoCierre,
  evaluarRequisitosCierre,
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
  };
}

function validarCondicionesCierre({ proceso, finiquito, cierre }) {
  if (!proceso) throw noEncontrado();
  const req = evaluarRequisitosCierre({ proceso, finiquito, cierre, estadosAbiertos: ESTADOS_ABIERTOS });
  if (!req.puede_cerrar) {
    throw new ErrorApp(409, req.motivo, undefined, req.codigo);
  }
}

// AC1: inactiva al colaborador en EmployeeService, revoca su cuenta y sesiones en AuthService y cierra el proceso.
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

  await obtenerFichaEmpleado(procPrevio.id_empleado);

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
    await modelo.cerrarProcesoDesvinculacion(cliente, id);
  });

  return obtener(id, identidad);
}

module.exports = { listar, obtener, cerrar, obtenerFichaEmpleado };

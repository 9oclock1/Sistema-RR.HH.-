const modelo = require("../models/finiquitosModel");
const finiquitoPdf = require("./finiquitoPdf");
const empleadosCliente = require("../clients/empleados.cliente");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { validarAdmin, validarConsulta, identidadRegistro, ESTADOS_ABIERTOS } = require("../utils/desvinculaciones");
const {
  aCentavos,
  validarFiltroEstadoFiniquito,
  consolidarFiniquito,
  finiquitoCoincide,
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

// AC2: aprueba el borrador, asigna número oficial y genera el PDF para firma.
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
  });

  return obtener(id, identidad);
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
  descargarPdf,
};

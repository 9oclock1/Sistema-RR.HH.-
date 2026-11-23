const pool = require("../config/db");
const { enTransaccion } = require("../config/transaccion");
const modelo = require("../models/planillasTributarias.model");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { validarResponsable } = require("../utils/planillas");
const {
  ORIGEN_SALDO,
  calcularRetencion,
  finDePeriodo,
  periodoAnterior,
  resolverParametros,
  resumirRetenciones,
} = require("../utils/tributario");
const { construirTxt, construirXlsx } = require("../utils/archivos");
const {
  FORMATOS,
  cargarPlanilla,
  cargarPlanillaCerrada,
  elegirFormato,
  exigirResponsable,
  nombreDelResponsable,
  nombreMes,
  sinGenerar,
} = require("../utils/planillasFiscales");

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTO_RE = /^\d{1,10}(\.\d{1,2})?$/;

const COLUMNAS_ARCHIVO = [
  { clave: "numero_documento", titulo: "Documento", ancho: 14 },
  { clave: "nombre_empleado", titulo: "Nombre", ancho: 30 },
  { clave: "total_ganado", titulo: "Total ganado", ancho: 15, monto: true },
  { clave: "aportes_laborales", titulo: "Aportes laborales", ancho: 17, monto: true },
  { clave: "sueldo_neto", titulo: "Sueldo neto", ancho: 15, monto: true },
  { clave: "minimo_no_imponible", titulo: "Minimo no imponible", ancho: 19, monto: true },
  { clave: "base_imponible", titulo: "Base imponible", ancho: 16, monto: true },
  { clave: "impuesto_determinado", titulo: "Impuesto determinado", ancho: 20, monto: true },
  { clave: "computo_salarios_minimos", titulo: "Computo 13% de 2 SMN", ancho: 20, monto: true },
  { clave: "credito_fiscal_facturas", titulo: "Credito de facturas", ancho: 19, monto: true },
  { clave: "saldo_mes_anterior", titulo: "Saldo del mes anterior", ancho: 21, monto: true },
  { clave: "actualizacion_ufv", titulo: "Actualizacion UFV", ancho: 18, monto: true },
  { clave: "saldo_anterior_favor", titulo: "Saldo anterior actualizado", ancho: 25, monto: true },
  { clave: "credito_aplicado", titulo: "Credito aplicado", ancho: 17, monto: true },
  { clave: "impuesto_retenido", titulo: "Impuesto retenido", ancho: 17, monto: true },
  { clave: "saldo_favor_siguiente", titulo: "Saldo a favor siguiente", ancho: 22, monto: true },
];

function formatear({ cabecera, retenciones }) {
  return {
    id_planilla_tributaria: cabecera.id_planilla_tributaria,
    id_planilla: cabecera.id_planilla,
    periodo: cabecera.periodo,
    parametros: {
      salario_minimo: cabecera.salario_minimo,
      multiplo_minimo_no_imponible: cabecera.multiplo_minimo_no_imponible,
      minimo_no_imponible: cabecera.minimo_no_imponible,
      alicuota_rciva: cabecera.alicuota_rciva,
      alicuota_credito_fiscal: cabecera.alicuota_credito_fiscal,
      computo_salarios_minimos: cabecera.computo_salarios_minimos,
    },
    saldo_anterior: {
      periodo: cabecera.periodo_saldo_anterior,
      ufv_inicial: cabecera.ufv_inicial,
      ufv_final: cabecera.ufv_final,
    },
    totales: {
      cantidad_dependientes: cabecera.cantidad_dependientes,
      dependientes_con_retencion: retenciones.filter((r) => r.impuesto_retenido > 0).length,
      total_sueldo_neto: cabecera.total_sueldo_neto,
      total_base_imponible: cabecera.total_base_imponible,
      total_impuesto_determinado: cabecera.total_impuesto_determinado,
      total_computo_salarios_minimos: cabecera.total_computo_salarios_minimos,
      total_credito_aplicado: cabecera.total_credito_aplicado,
      total_impuesto_retenido: cabecera.total_impuesto_retenido,
      total_actualizacion_ufv: cabecera.total_actualizacion_ufv,
    },
    advertencias: cabecera.advertencias,
    generada_por: cabecera.generada_por,
    generada_por_nombre: cabecera.generada_por_nombre,
    generada_en: cabecera.generada_en,
    retenciones,
  };
}

function periodoSiguiente(periodo) {
  const [anio, mes] = periodo.split("-").map(Number);
  return mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, "0")}`;
}

async function resolverSaldoAnterior(periodo, previo) {
  const advertencias = [];
  const [hayTributariaPrevia, hayPlanillaPrevia, haySiguiente] = await Promise.all([
    modelo.existeTributaria(pool, previo),
    modelo.existePlanilla(pool, previo),
    modelo.existeTributaria(pool, periodoSiguiente(periodo)),
  ]);
  if (haySiguiente) {
    advertencias.push(
      `La planilla tributaria de ${nombreMes(periodoSiguiente(periodo))} ya se generó con el saldo de este mes: vuelva a generarla para que tome los cambios.`
    );
  }
  if (!hayTributariaPrevia) {
    if (hayPlanillaPrevia) {
      advertencias.push(
        `Todavía no se generó la planilla tributaria de ${nombreMes(previo)}: el saldo a favor se toma del saldo inicial declarado. Genere primero la de ${nombreMes(previo)} para arrastrar su saldo.`
      );
    }
    return { origen: ORIGEN_SALDO.SALDO_INICIAL, ufv: null, advertencias };
  }

  const fechaInicial = finDePeriodo(previo);
  const fechaFinal = finDePeriodo(periodo);
  const [inicial, final] = await Promise.all([modelo.valorUfv(pool, fechaInicial), modelo.valorUfv(pool, fechaFinal)]);
  if (inicial === null || final === null) {
    const faltante = inicial === null ? fechaInicial : fechaFinal;
    advertencias.push(`Falta el valor de la UFV al ${faltante}: el saldo a favor de ${nombreMes(previo)} pasa sin actualizar.`);
    return { origen: ORIGEN_SALDO.MES_ANTERIOR, ufv: null, advertencias };
  }
  return { origen: ORIGEN_SALDO.MES_ANTERIOR, ufv: { inicial, final }, advertencias };
}

async function generar(idPlanilla, identidad) {
  const idResponsable = validarResponsable(identidad);
  const planilla = await cargarPlanillaCerrada(pool, idPlanilla);

  const parametros = resolverParametros(await modelo.parametrosVigentes(pool, planilla.fecha_fin));
  if (parametros.faltantes.length > 0) {
    throw new ErrorApp(
      409,
      `No hay parámetros tributarios vigentes al cierre de ${nombreMes(planilla.periodo)}: faltan ${parametros.faltantes.join(", ")}.`,
      undefined,
      "SIN_PARAMETROS_TRIBUTARIOS"
    );
  }

  const previo = periodoAnterior(planilla.periodo);
  const [bases, sinEntidad, saldoAnterior] = await Promise.all([
    modelo.listarBasesRciva(pool, planilla.id_planilla, planilla.periodo, previo),
    modelo.conceptosDeLeySinEntidad(pool, planilla.id_planilla),
    resolverSaldoAnterior(planilla.periodo, previo),
  ]);
  if (bases.length === 0) throw new ErrorApp(409, "La planilla no tiene colaboradores: no hay RC-IVA que calcular.");

  const arrastra = saldoAnterior.origen === ORIGEN_SALDO.MES_ANTERIOR;
  const retenciones = bases.map((base) => ({
    id_empleado: base.id_empleado,
    nombre_empleado: base.nombre_empleado,
    numero_documento: base.numero_documento,
    origen_saldo: saldoAnterior.origen,
    ...calcularRetencion(
      {
        totalGanado: base.total_ganado,
        aportesLaborales: base.aportes_laborales,
        montoFacturas: base.monto_facturas,
        saldoMesAnterior: arrastra ? base.saldo_mes_anterior : base.saldo_inicial_favor,
        ufv: arrastra ? saldoAnterior.ufv : null,
      },
      parametros
    ),
  }));
  const advertencias = [
    ...saldoAnterior.advertencias,
    ...sinEntidad.map(
      (concepto) =>
        `El concepto ${concepto.codigo} (${concepto.nombre}) no está asociado a una entidad de aporte: no se descontó del sueldo neto para el RC-IVA.`
    ),
  ];
  const responsable = { id: idResponsable, nombre: await nombreDelResponsable(idResponsable) };

  await enTransaccion((cliente) =>
    modelo.reemplazar(cliente, {
      planilla,
      parametros,
      saldoAnterior: { periodo: arrastra ? previo : null, ufv: arrastra ? saldoAnterior.ufv : null },
      totales: resumirRetenciones(retenciones),
      advertencias,
      responsable,
      retenciones,
    })
  );
  return formatear(await modelo.obtenerGuardada(pool, planilla.id_planilla));
}

async function obtener(idPlanilla, identidad) {
  exigirResponsable(identidad);
  const planilla = await cargarPlanilla(pool, idPlanilla);
  const guardada = await modelo.obtenerGuardada(pool, planilla.id_planilla);
  if (!guardada) throw sinGenerar("la planilla tributaria", planilla.periodo);
  return formatear(guardada);
}

async function exportar(idPlanilla, identidad, formatoPedido) {
  const formato = elegirFormato(formatoPedido, "xlsx");
  const planilla = await obtener(idPlanilla, identidad);
  const filas = planilla.retenciones.map((retencion) => ({ ...retencion, minimo_no_imponible: planilla.parametros.minimo_no_imponible }));
  const pie = {
    numero_documento: "",
    nombre_empleado: "TOTAL",
    sueldo_neto: planilla.totales.total_sueldo_neto,
    base_imponible: planilla.totales.total_base_imponible,
    impuesto_determinado: planilla.totales.total_impuesto_determinado,
    computo_salarios_minimos: planilla.totales.total_computo_salarios_minimos,
    actualizacion_ufv: planilla.totales.total_actualizacion_ufv,
    credito_aplicado: planilla.totales.total_credito_aplicado,
    impuesto_retenido: planilla.totales.total_impuesto_retenido,
  };
  const contenido =
    formato === "xlsx"
      ? construirXlsx({ hoja: `RC-IVA ${planilla.periodo}`, columnas: COLUMNAS_ARCHIVO, filas, pie })
      : construirTxt({ columnas: COLUMNAS_ARCHIVO, filas, pie });
  return {
    nombreArchivo: `planilla-tributaria-${planilla.periodo}.${FORMATOS[formato].extension}`,
    tipo: FORMATOS[formato].tipo,
    contenido,
  };
}

function validarCredito(cuerpo = {}) {
  const errores = [];
  const idEmpleado = typeof cuerpo.id_empleado === "string" && UUID_RE.test(cuerpo.id_empleado) ? cuerpo.id_empleado.toLowerCase() : null;
  if (!idEmpleado) errores.push({ campo: "id_empleado", mensaje: "Debe ser un identificador válido." });
  if (typeof cuerpo.periodo !== "string" || !PERIODO_RE.test(cuerpo.periodo)) {
    errores.push({ campo: "periodo", mensaje: "Use el formato AAAA-MM." });
  }
  const monto = (campo, valor) => {
    const texto = valor === undefined || valor === null || valor === "" ? "0" : String(valor);
    if (!MONTO_RE.test(texto)) {
      errores.push({ campo, mensaje: "Debe ser un monto de 0 en adelante con hasta 2 decimales." });
      return 0;
    }
    return Number(texto);
  };
  const montoFacturas = monto("monto_facturas", cuerpo.monto_facturas);
  const saldoInicialFavor = monto("saldo_inicial_favor", cuerpo.saldo_inicial_favor);
  if (errores.length > 0) throw new ErrorApp(400, "Revise los datos del crédito fiscal.", errores);
  return { idEmpleado, periodo: cuerpo.periodo, montoFacturas, saldoInicialFavor };
}

async function registrarCredito(cuerpo, identidad) {
  exigirResponsable(identidad);
  return modelo.guardarCredito(pool, validarCredito(cuerpo));
}

async function listarCreditos(periodo, identidad) {
  exigirResponsable(identidad);
  if (typeof periodo !== "string" || !PERIODO_RE.test(periodo)) {
    throw new ErrorApp(400, "Indique el periodo con el formato AAAA-MM.", [{ campo: "periodo", mensaje: "Use el formato AAAA-MM." }]);
  }
  return { periodo, creditos: await modelo.listarCreditos(pool, periodo) };
}

async function listarParametros(identidad) {
  exigirResponsable(identidad);
  return { parametros: await modelo.listarParametros(pool) };
}

module.exports = { generar, obtener, exportar, registrarCredito, listarCreditos, listarParametros, COLUMNAS_ARCHIVO };

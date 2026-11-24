const { ErrorApp } = require("./errores");
const { ORIGEN, DESTINOS } = require("./integraciones");

const ESTADOS_FINIQUITO = ["BORRADOR", "APROBADO", "PAGADO"];
const FILTROS_ESTADO_FINIQUITO = ["SIN_GENERAR", ...ESTADOS_FINIQUITO];
const DESTINOS_FINIQUITO = ["PAGOS", "CONTABILIDAD"];
const ESCENARIOS_SIMULACION = ["CONFIRMADA", "RECHAZADA", "DUPLICADO", "INVALIDO"];

const TIPO_FINIQUITO_ORDEN_PAGO = "FINIQUITO_APROBADO_ORDEN_PAGO";
const TIPO_FINIQUITO_ASIENTO = "FINIQUITO_APROBADO_ASIENTO";
const TIPO_CONFIRMACION_FINIQUITO_PAGOS = "CONFIRMACION_ORDEN_PAGO_FINIQUITO";
const TIPO_CONFIRMACION_FINIQUITO_CONTABILIDAD = "CONFIRMACION_ASIENTO_FINIQUITO";
const VERSION_ESQUEMA = 1;

// Cuentas contables referenciales para la desafectación de provisiones del finiquito: ajustar al plan de cuentas de Contabilidad.
const CUENTAS_FINIQUITO = {
  PREVISION_INDEMNIZACIONES: { codigo: "2.1.5.01", nombre: "Previsión para indemnizaciones" },
  PROVISION_AGUINALDOS: { codigo: "2.1.5.02", nombre: "Provisión para aguinaldos" },
  PROVISION_VACACIONES: { codigo: "2.1.5.03", nombre: "Provisión para vacaciones" },
  PRESTAMOS_AL_PERSONAL: { codigo: "1.1.4.01", nombre: "Préstamos y anticipos al personal" },
  FINIQUITOS_POR_PAGAR: { codigo: "2.1.2.02", nombre: "Finiquitos por pagar" },
};

const simulacionFiniquitoActiva = () => process.env.SIMULAR_RESPUESTAS_FINIQUITO !== "false";

const demoraSimulacionFiniquitoMs = () => {
  const texto = process.env.SIMULAR_RESPUESTAS_FINIQUITO_DEMORA_MS;
  if (texto === undefined || texto.trim() === "") return 3000;
  const n = Number(texto);
  return Number.isFinite(n) && n >= 0 ? n : 3000;
};

const aCentavos = (monto) => Math.round((Number(monto) + Number.EPSILON) * 100);
const deCentavos = (centavos) => centavos / 100;

const plural = (n, singular, varios) => `${n} ${n === 1 ? singular : varios}`;

const formatoBs = (valor) =>
  `Bs ${Number(valor).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatearFechaCorta = (fecha) => {
  if (!fecha) return "";
  const texto = fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha).slice(0, 10);
  const [anio, mes, dia] = texto.split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : texto;
};

function validarFiltroEstadoFiniquito(estado) {
  if (estado === undefined || estado === null || estado === "") return null;
  const normalizado = String(estado).trim().toUpperCase();
  if (!FILTROS_ESTADO_FINIQUITO.includes(normalizado)) {
    throw new ErrorApp(400, "Filtros inválidos", [
      { campo: "estado_finiquito", mensaje: `Use uno de: ${FILTROS_ESTADO_FINIQUITO.join(", ")}.` },
    ]);
  }
  return normalizado;
}

function formatearNumeroDocumento(secuencia, anio = new Date().getFullYear()) {
  return `FIN-${anio}-${String(secuencia).padStart(6, "0")}`;
}

function textoTiempoServicio(anios = 0, meses = 0, dias = 0) {
  return `${plural(Number(anios), "año", "años")}, ${plural(Number(meses), "mes", "meses")} y ${plural(Number(dias), "día", "días")}`;
}

function ordenarPrestamosAntiguos(prestamos = []) {
  return [...prestamos]
    .map((p, indice) => ({ p, indice }))
    .sort((a, b) => {
      const fechaA = a.p.creado_en ? new Date(a.p.creado_en).getTime() : 0;
      const fechaB = b.p.creado_en ? new Date(b.p.creado_en).getTime() : 0;
      if (fechaA !== fechaB) return fechaA - fechaB;
      const mesA = a.p.mes_inicio ? String(a.p.mes_inicio).slice(0, 10) : "";
      const mesB = b.p.mes_inicio ? String(b.p.mes_inicio).slice(0, 10) : "";
      if (mesA !== mesB) return mesA.localeCompare(mesB);
      return a.indice - b.indice;
    })
    .map(({ p }) => p);
}

// AC1: consolida sueldo promedio, beneficios sociales, saldos proporcionales y préstamos activos.
function consolidarFiniquito({ proceso, promedio, beneficios, saldos, prestamos = [] }) {
  const faltantes = [];
  if (!promedio) faltantes.push({ campo: "promedio", mensaje: "Falta calcular el sueldo promedio indemnizable." });
  if (!beneficios) faltantes.push({ campo: "beneficios", mensaje: "Falta calcular la indemnización y el desahucio." });
  if (!saldos) faltantes.push({ campo: "saldos", mensaje: "Falta calcular las duodécimas de aguinaldo y vacaciones truncas." });
  if (faltantes.length > 0) {
    throw new ErrorApp(
      409,
      "Complete todos los cálculos previos del proceso antes de generar el finiquito.",
      faltantes,
      "CALCULOS_INCOMPLETOS"
    );
  }

  const promedioCents = aCentavos(promedio.promedio);
  const desactualizados = [];
  if (aCentavos(beneficios.promedio_base) !== promedioCents) {
    desactualizados.push({
      campo: "beneficios",
      mensaje: "La indemnización y el desahucio están desactualizados respecto al sueldo promedio actual.",
    });
  }
  if (aCentavos(saldos.promedio) !== promedioCents) {
    desactualizados.push({
      campo: "saldos",
      mensaje: "Las duodécimas de aguinaldo y vacaciones truncas están desactualizadas respecto al sueldo promedio actual.",
    });
  }
  if (desactualizados.length > 0) {
    throw new ErrorApp(
      409,
      "Existen cálculos desactualizados respecto al sueldo promedio indemnizable: recálculelos antes de continuar.",
      desactualizados,
      "CALCULOS_DESACTUALIZADOS"
    );
  }

  const renglones = [];
  const agregarIngreso = (codigo, concepto, monto, detalle = null) => {
    const cents = aCentavos(monto ?? 0);
    if (cents <= 0) return;
    renglones.push({
      tipo: "INGRESO",
      codigo,
      concepto,
      detalle,
      monto: deCentavos(cents),
      id_prestamo: null,
      saldo_prestamo: null,
    });
  };

  agregarIngreso(
    "INDEMNIZACION",
    "Indemnización por tiempo de servicio",
    beneficios.monto_indemnizacion,
    textoTiempoServicio(beneficios.anios_servicio, beneficios.meses_servicio, beneficios.dias_fraccion)
  );
  agregarIngreso(
    "DESAHUCIO",
    "Desahucio",
    beneficios.monto_desahucio,
    "Tres sueldos promedio"
  );

  const aguinaldoMeses = saldos.aguinaldo_meses ?? saldos.aguinaldo?.meses ?? 0;
  const aguinaldoDias = saldos.aguinaldo_dias ?? saldos.aguinaldo?.dias ?? 0;
  const gestionAguinaldo = saldos.gestion_aguinaldo ?? saldos.aguinaldo?.gestion;
  const montoAguinaldo = saldos.monto_aguinaldo ?? saldos.aguinaldo?.monto ?? 0;
  agregarIngreso(
    "AGUINALDO_DUODECIMAS",
    "Aguinaldo (duodécimas)",
    montoAguinaldo,
    `${gestionAguinaldo ? `Gestión ${gestionAguinaldo}: ` : ""}${plural(Number(aguinaldoMeses), "mes", "meses")} y ${plural(Number(aguinaldoDias), "día", "días")}`
  );

  const diasPendientes = saldos.dias_pendientes ?? saldos.vacaciones?.dias_pendientes ?? 0;
  const montoVacPend = saldos.monto_vacaciones_pendientes ?? saldos.vacaciones?.monto_pendientes ?? 0;
  agregarIngreso(
    "VACACIONES_PENDIENTES",
    "Vacaciones no gozadas",
    montoVacPend,
    plural(Number(diasPendientes), "día pendiente", "días pendientes")
  );

  const vacMeses = saldos.anio_en_curso_meses ?? saldos.vacaciones?.anio_en_curso?.meses ?? 0;
  const vacDias = saldos.anio_en_curso_dias ?? saldos.vacaciones?.anio_en_curso?.dias ?? 0;
  const montoVacDuo = saldos.monto_duodecima_vacaciones ?? saldos.vacaciones?.monto_duodecima ?? 0;
  agregarIngreso(
    "VACACIONES_DUODECIMAS",
    "Vacaciones (duodécimas del año en curso)",
    montoVacDuo,
    `${plural(Number(vacMeses), "mes", "meses")} y ${plural(Number(vacDias), "día", "días")}`
  );

  const totalIngresosCents = renglones.reduce((suma, r) => suma + aCentavos(r.monto), 0);
  let disponibleCents = totalIngresosCents;
  let totalDescuentosCents = 0;

  const activos = ordenarPrestamosAntiguos(prestamos).filter(
    (p) => (!p.estado || p.estado === "ACTIVO") && aCentavos(p.saldo_pendiente) > 0
  );

  for (const p of activos) {
    if (disponibleCents <= 0) break;
    const saldoCents = aCentavos(p.saldo_pendiente);
    const descuentoCents = Math.min(saldoCents, disponibleCents);
    disponibleCents -= descuentoCents;
    totalDescuentosCents += descuentoCents;

    const esAnticipo = p.tipo === "ANTICIPO";
    const codigo = esAnticipo ? "ANTICIPO" : "PRESTAMO";
    const concepto = esAnticipo ? "Saldo de anticipo" : "Saldo de préstamo";
    const fechaTxt = formatearFechaCorta(p.creado_en || p.mes_inicio);
    const montoOriginalTxt = p.monto !== undefined && p.monto !== null ? formatoBs(p.monto) : null;

    let detalle;
    if (descuentoCents < saldoCents) {
      const restante = deCentavos(saldoCents - descuentoCents);
      detalle = `Descuento parcial: queda un saldo de ${formatoBs(restante)}`;
      if (montoOriginalTxt) detalle += ` (monto original: ${montoOriginalTxt})`;
    } else {
      detalle = [fechaTxt && `Fecha: ${fechaTxt}`, montoOriginalTxt && `Monto original: ${montoOriginalTxt}`]
        .filter(Boolean)
        .join(" · ") || null;
    }

    renglones.push({
      tipo: "DESCUENTO",
      codigo,
      concepto,
      detalle,
      monto: deCentavos(descuentoCents),
      id_prestamo: p.id_prestamo,
      saldo_prestamo: deCentavos(saldoCents),
    });
  }

  const ordenados = renglones.map((r, idx) => ({ orden: idx + 1, ...r }));
  return {
    renglones: ordenados,
    total_ingresos: deCentavos(totalIngresosCents),
    total_descuentos: deCentavos(totalDescuentosCents),
    liquido_pagable: deCentavos(totalIngresosCents - totalDescuentosCents),
  };
}

function finiquitoCoincide(actual, consolidado, proceso, beneficios) {
  if (!actual || !consolidado) return false;
  const fechaActual = actual.fecha_retiro instanceof Date
    ? actual.fecha_retiro.toISOString().slice(0, 10)
    : String(actual.fecha_retiro).slice(0, 10);
  const fechaProceso = proceso.fecha_retiro instanceof Date
    ? proceso.fecha_retiro.toISOString().slice(0, 10)
    : String(proceso.fecha_retiro).slice(0, 10);

  if (fechaActual !== fechaProceso) return false;
  if (actual.codigo_causal !== proceso.codigo_causal) return false;
  if (aCentavos(actual.promedio_base) !== aCentavos(beneficios.promedio_base)) return false;
  if (Number(actual.anios_servicio) !== Number(beneficios.anios_servicio)) return false;
  if (Number(actual.meses_servicio) !== Number(beneficios.meses_servicio)) return false;
  if (Number(actual.dias_fraccion) !== Number(beneficios.dias_fraccion)) return false;
  if (aCentavos(actual.total_ingresos) !== aCentavos(consolidado.total_ingresos)) return false;
  if (aCentavos(actual.total_descuentos) !== aCentavos(consolidado.total_descuentos)) return false;
  if (aCentavos(actual.liquido_pagable) !== aCentavos(consolidado.liquido_pagable)) return false;

  const rActual = actual.renglones ?? [];
  const rNuevo = consolidado.renglones ?? [];
  if (rActual.length !== rNuevo.length) return false;

  for (let i = 0; i < rNuevo.length; i += 1) {
    const a = rActual[i];
    const b = rNuevo[i];
    if (a.tipo !== b.tipo || a.codigo !== b.codigo) return false;
    if (aCentavos(a.monto) !== aCentavos(b.monto)) return false;
    if ((a.id_prestamo ?? null) !== (b.id_prestamo ?? null)) return false;
    if (a.saldo_prestamo !== null && b.saldo_prestamo !== null) {
      if (aCentavos(a.saldo_prestamo) !== aCentavos(b.saldo_prestamo)) return false;
    } else if ((a.saldo_prestamo ?? null) !== (b.saldo_prestamo ?? null)) {
      return false;
    }
  }
  return true;
}

const UNIDADES = [
  "", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiún", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const DECENAS = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function convertirMenorMil(n) {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 30) {
      partes.push(UNIDADES[resto]);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`);
    }
  }
  return partes.join(" ");
}

function enteroEnLetras(n) {
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes = [];

  if (millones === 1) partes.push("un millón");
  else if (millones > 1) partes.push(`${convertirMenorMil(millones)} millones`);

  if (miles === 1) partes.push("mil");
  else if (miles > 1) partes.push(`${convertirMenorMil(miles)} mil`);

  if (resto > 0) partes.push(convertirMenorMil(resto));
  return partes.join(" ");
}

function montoEnLetras(monto) {
  const cents = Math.max(0, aCentavos(monto ?? 0));
  const entero = Math.floor(cents / 100);
  const dec = String(cents % 100).padStart(2, "0");
  const letras = enteroEnLetras(entero);
  const capitalizada = letras.charAt(0).toUpperCase() + letras.slice(1);
  return `${capitalizada} ${dec}/100 bolivianos`;
}

function armarSobreFiniquito({ idMensaje, origen, destino, tipo, fecha, datos }) {
  return {
    encabezado: {
      id_mensaje: idMensaje,
      origen,
      destino,
      tipo,
      fecha,
      version_esquema: VERSION_ESQUEMA,
    },
    datos,
  };
}

// AC3: orden de pago urgente para Pagos y Facturación (grupo A).
function armarMensajeOrdenPagoFiniquito({ idMensaje, fecha = new Date().toISOString(), proceso, finiquito, aprobadoPorNombre = null }) {
  const ingresos = (finiquito.renglones ?? []).filter((r) => r.tipo === "INGRESO");
  const descuentos = (finiquito.renglones ?? []).filter((r) => r.tipo === "DESCUENTO");
  const destinoA = { grupo: DESTINOS.PAGOS.grupo, modulo: DESTINOS.PAGOS.modulo };
  return armarSobreFiniquito({
    idMensaje,
    origen: ORIGEN,
    destino: destinoA,
    tipo: TIPO_FINIQUITO_ORDEN_PAGO,
    fecha,
    datos: {
      id_finiquito: finiquito.id_finiquito,
      numero_documento: finiquito.numero_documento,
      id_proceso: proceso.id_proceso,
      prioridad: "URGENTE",
      moneda: "BOB",
      colaborador: {
        id_empleado: proceso.id_empleado,
        nombre_completo: proceso.nombre_empleado,
      },
      fecha_retiro: finiquito.fecha_retiro,
      causal: {
        codigo: proceso.codigo_causal,
        nombre: proceso.causal_nombre ?? proceso.causal?.nombre ?? proceso.codigo_causal,
      },
      conceptos: ingresos.map((r) => ({ codigo: r.codigo, concepto: r.concepto, monto: Number(r.monto) })),
      descuentos: descuentos.map((r) => ({ codigo: r.codigo, concepto: r.concepto, monto: Number(r.monto) })),
      total_ingresos: Number(finiquito.total_ingresos),
      total_descuentos: Number(finiquito.total_descuentos),
      liquido_pagable: Number(finiquito.liquido_pagable),
      aprobado: {
        por: { id_empleado: finiquito.aprobado_por, nombre_completo: aprobadoPorNombre },
        en: new Date(finiquito.aprobado_en).toISOString(),
      },
    },
  });
}

// AC3: asiento de liquidación y desafectación de provisiones para Contabilidad (grupo D).
function armarAsientoFiniquito(finiquito) {
  const sumaCodigos = (codigos) =>
    (finiquito.renglones ?? [])
      .filter((r) => codigos.includes(r.codigo))
      .reduce((total, r) => total + aCentavos(r.monto), 0);

  const indemnizacionCents = sumaCodigos(["INDEMNIZACION", "DESAHUCIO"]);
  const aguinaldoCents = sumaCodigos(["AGUINALDO_DUODECIMAS"]);
  const vacacionesCents = sumaCodigos(["VACACIONES_PENDIENTES", "VACACIONES_DUODECIMAS"]);
  const descuentosCents = aCentavos(finiquito.total_descuentos);
  const liquidoCents = aCentavos(finiquito.liquido_pagable);

  const renglones = [];
  const agregar = (cuenta, lado, cents, concepto) => {
    if (cents <= 0) return;
    renglones.push({
      cuenta,
      debe: lado === "debe" ? deCentavos(cents) : 0,
      haber: lado === "haber" ? deCentavos(cents) : 0,
      concepto,
    });
  };

  agregar(CUENTAS_FINIQUITO.PREVISION_INDEMNIZACIONES, "debe", indemnizacionCents, "Desafectación de previsión para indemnizaciones y desahucio");
  agregar(CUENTAS_FINIQUITO.PROVISION_AGUINALDOS, "debe", aguinaldoCents, "Desafectación de provisión para aguinaldos");
  agregar(CUENTAS_FINIQUITO.PROVISION_VACACIONES, "debe", vacacionesCents, "Desafectación de provisión para vacaciones");
  agregar(CUENTAS_FINIQUITO.PRESTAMOS_AL_PERSONAL, "haber", descuentosCents, "Descuento de préstamos y anticipos al personal");
  agregar(CUENTAS_FINIQUITO.FINIQUITOS_POR_PAGAR, "haber", liquidoCents, "Finiquitos por pagar");

  const totalDebeCents = renglones.reduce((t, r) => t + aCentavos(r.debe), 0);
  const totalHaberCents = renglones.reduce((t, r) => t + aCentavos(r.haber), 0);

  return {
    renglones,
    total_debe: deCentavos(totalDebeCents),
    total_haber: deCentavos(totalHaberCents),
  };
}

function armarMensajeAsientoFiniquito({ idMensaje, fecha = new Date().toISOString(), proceso, finiquito }) {
  const destinoD = { grupo: DESTINOS.CONTABILIDAD.grupo, modulo: DESTINOS.CONTABILIDAD.modulo };
  return armarSobreFiniquito({
    idMensaje,
    origen: ORIGEN,
    destino: destinoD,
    tipo: TIPO_FINIQUITO_ASIENTO,
    fecha,
    datos: {
      id_finiquito: finiquito.id_finiquito,
      numero_documento: finiquito.numero_documento,
      id_proceso: proceso.id_proceso,
      colaborador: {
        id_empleado: proceso.id_empleado,
        nombre_completo: proceso.nombre_empleado,
      },
      fecha: finiquito.fecha_retiro,
      glosa: `Liquidación final de ${proceso.nombre_empleado} según finiquito ${finiquito.numero_documento}`,
      asiento: armarAsientoFiniquito(finiquito),
    },
  });
}

function armarRespuestaSimulada({
  idMensaje,
  destino,
  idFiniquito,
  idMensajeOrigen,
  resultado = "CONFIRMADA",
  referencia = null,
  motivo = null,
  fecha = new Date().toISOString(),
}) {
  const cfg = DESTINOS[destino];
  const tipo = destino === "PAGOS" ? TIPO_CONFIRMACION_FINIQUITO_PAGOS : TIPO_CONFIRMACION_FINIQUITO_CONTABILIDAD;
  return armarSobreFiniquito({
    idMensaje,
    origen: { grupo: cfg.grupo, modulo: cfg.modulo },
    destino: ORIGEN,
    tipo,
    fecha,
    datos: {
      id_finiquito: idFiniquito,
      id_mensaje_origen: idMensajeOrigen,
      resultado,
      referencia,
      motivo,
    },
  });
}

function validarDestinoFiniquito(destino) {
  const normalizado = typeof destino === "string" ? destino.trim().toUpperCase() : "";
  if (!DESTINOS_FINIQUITO.includes(normalizado)) {
    throw new ErrorApp(400, "Destino inválido", [
      { campo: "destino", mensaje: `Use uno de: ${DESTINOS_FINIQUITO.join(", ")}.` },
    ]);
  }
  return normalizado;
}

function validarSimulacionEscenario(datos = {}) {
  const errores = [];
  const destino = typeof datos?.destino === "string" ? datos.destino.trim().toUpperCase() : "";
  const escenario = typeof datos?.escenario === "string" ? datos.escenario.trim().toUpperCase() : "";

  if (!DESTINOS_FINIQUITO.includes(destino)) {
    errores.push({ campo: "destino", mensaje: `Use uno de: ${DESTINOS_FINIQUITO.join(", ")}.` });
  }
  if (!ESCENARIOS_SIMULACION.includes(escenario)) {
    errores.push({ campo: "escenario", mensaje: `Use uno de: ${ESCENARIOS_SIMULACION.join(", ")}.` });
  }
  const motivo = typeof datos?.motivo === "string" ? datos.motivo.trim() : "";
  if (escenario === "RECHAZADA" && !motivo) {
    errores.push({ campo: "motivo", mensaje: "Indique el motivo del rechazo." });
  }
  if (errores.length > 0) {
    throw new ErrorApp(400, "Datos de simulación inválidos", errores);
  }
  const referencia = typeof datos?.referencia === "string" ? datos.referencia.trim().slice(0, 60) : "";
  return {
    destino,
    escenario,
    referencia: referencia || null,
    motivo: escenario === "RECHAZADA" ? motivo.slice(0, 255) : null,
  };
}

function validarCaidaBroker(datos = {}) {
  const segundos = Number(datos?.segundos);
  if (!Number.isFinite(segundos) || !Number.isInteger(segundos) || segundos < 10 || segundos > 120) {
    throw new ErrorApp(400, "Duración inválida", [
      { campo: "segundos", mensaje: "Indique un tiempo entre 10 y 120 segundos." },
    ]);
  }
  return segundos;
}

module.exports = {
  ESTADOS_FINIQUITO,
  FILTROS_ESTADO_FINIQUITO,
  DESTINOS_FINIQUITO,
  ESCENARIOS_SIMULACION,
  TIPO_FINIQUITO_ORDEN_PAGO,
  TIPO_FINIQUITO_ASIENTO,
  TIPO_CONFIRMACION_FINIQUITO_PAGOS,
  TIPO_CONFIRMACION_FINIQUITO_CONTABILIDAD,
  CUENTAS_FINIQUITO,
  simulacionFiniquitoActiva,
  demoraSimulacionFiniquitoMs,
  aCentavos,
  deCentavos,
  validarFiltroEstadoFiniquito,
  formatearNumeroDocumento,
  textoTiempoServicio,
  consolidarFiniquito,
  finiquitoCoincide,
  montoEnLetras,
  armarMensajeOrdenPagoFiniquito,
  armarAsientoFiniquito,
  armarMensajeAsientoFiniquito,
  armarRespuestaSimulada,
  validarDestinoFiniquito,
  validarSimulacionEscenario,
  validarCaidaBroker,
};

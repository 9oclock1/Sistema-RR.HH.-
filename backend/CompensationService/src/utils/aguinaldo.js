// Planilla de aguinaldos (RF-47, KAN-67): duodécimas del promedio de los tres últimos sueldos, por los
// meses y días (mes comercial de 30 días, igual que la planilla mensual) trabajados en la gestión.
const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { sumarDias, sumarMeses } = require("./fechas");
const { DIAS_MES_COMERCIAL } = require("./planillas");
const { CUENTAS, validarSimulacionConfirmacion } = require("./integraciones");

const GESTION_MINIMA = 2000;
const GESTION_MAXIMA = 2100;
// Criterio 2: menos de tres meses de servicio en la gestión queda excluido.
const MESES_MINIMOS = 3;

const redondear = (valor) => Math.round((valor + Number.EPSILON) * 100) / 100;

function validarGestion(gestion) {
  const anio = Number(gestion);
  if (!Number.isInteger(anio) || anio < GESTION_MINIMA || anio > GESTION_MAXIMA) {
    throw new ErrorApp(400, "Gestión inválida", [
      { campo: "gestion", mensaje: "Use el año de cierre de la gestión (por ejemplo 2026)." },
    ]);
  }
  return anio;
}

// La gestión del aguinaldo va del 1 de diciembre del año anterior al 30 de noviembre de `gestion`.
function rangoGestion(gestion) {
  return { desde: `${gestion - 1}-12-01`, hasta: `${gestion}-11-30` };
}

// Meses calendario completos (por aniversario de día del mes, igual que aniosDeServicio) que el colaborador
// trabajó dentro de la gestión, más los días sueltos del mes incompleto. `fechaFinEfectiva` es el último día
// contemplado: hoy, el fin de la gestión, o cuando dejó la empresa, lo que sea antes. null si ningún día de
// la relación laboral cae dentro de la gestión. Trabajar toda la gestión (1.º de diciembre a 30 de
// noviembre) da exactamente 12 meses y 0 días: se compara contra el día SIGUIENTE al último trabajado, así
// el 30 de noviembre cuenta como el día completo que es.
function mesesYDias(fechaIngreso, fechaFinEfectiva, rango) {
  const inicio = fechaIngreso > rango.desde ? fechaIngreso : rango.desde;
  const fin = fechaFinEfectiva < rango.hasta ? fechaFinEfectiva : rango.hasta;
  if (fin < inicio) return null;

  const finSiguiente = sumarDias(fin, 1);
  const [anioIni, mesIni, diaIni] = inicio.split("-").map(Number);
  const [anioFin, mesFin, diaFin] = finSiguiente.split("-").map(Number);
  let meses = (anioFin - anioIni) * 12 + (mesFin - mesIni);
  let dias = diaFin - diaIni;
  if (dias < 0) {
    meses -= 1;
    // Días del mes calendario que termina justo antes de finSiguiente (28 a 31, el real, no 30 fijo).
    dias += new Date(Date.UTC(anioFin, mesFin - 1, 0)).getUTCDate();
  }
  return { meses, dias_resto: dias };
}

// Haber vigente en `fecha` según el historial de versiones de contrato de un colaborador (mismas versiones
// que arma planillas.service: vigente_desde/vigente_hasta, haber_mensual_pactado).
function haberEnFecha(versiones, fecha) {
  const version = versiones.find((v) => v.vigente_desde <= fecha && (!v.vigente_hasta || v.vigente_hasta >= fecha));
  return version ? Number(version.haber_mensual_pactado) : null;
}

// Estados de planilla mensual cuyos montos ya no cambian: aprobada (enviada a Contabilidad y Pagos) o cerrada.
const ESTADOS_PLANILLA_SUELDO = ["APROBADA", "CERRADA"];

// RF-47, criterio 1: promedio de los tres últimos sueldos REALES, es decir, el total ganado (haber, bono de
// antigüedad, horas extra, dominicales, bonos) de las tres últimas planillas mensuales del colaborador
// hasta su último mes trabajado. Con menos de tres planillas se promedia con las que haya.
// `planillas`: [{ periodo: "AAAA-MM", total_ganado }] del colaborador. null si no tiene ninguna.
function promedioDePlanillas(planillas, fechaReferencia) {
  const limite = String(fechaReferencia).slice(0, 7);
  const ultimas = (planillas ?? [])
    .filter((p) => p.periodo <= limite)
    .sort((a, b) => b.periodo.localeCompare(a.periodo))
    .slice(0, 3);
  if (ultimas.length === 0) return null;
  const suma = ultimas.reduce((total, p) => total + Math.round(Number(p.total_ganado) * 100), 0);
  return {
    promedio: Math.round(suma / ultimas.length) / 100,
    meses: ultimas.length,
    periodos: ultimas.map((p) => p.periodo).reverse(),
  };
}

// Respaldo cuando el colaborador no tiene ninguna planilla mensual (por ejemplo, si el sistema empezó a
// emitir planillas después): el haber pactado en el contrato en el último mes trabajado y los dos
// anteriores, promediando con los que existan, nunca con menos de uno.
function promedioUltimosSueldos(versiones, fechaReferencia) {
  const fechas = [fechaReferencia, sumarMeses(fechaReferencia, -1), sumarMeses(fechaReferencia, -2)];
  const valores = fechas.map((f) => haberEnFecha(versiones, f)).filter((v) => v !== null);
  if (valores.length === 0) return null;
  return redondear(valores.reduce((a, b) => a + b, 0) / valores.length);
}

// Duodécimas: 12 meses completos de servicio equivalen al promedio completo; un mes o día de menos se
// descuenta en la misma proporción.
function calcularMonto(promedioSueldo, meses, diasResto) {
  return redondear((promedioSueldo * (meses + diasResto / DIAS_MES_COMERCIAL)) / 12);
}

// De dónde sale el promedio: las planillas mensuales (lo normal) o, sin ninguna, el contrato.
function promedioDeSueldos(planillas, versionesContrato, fechaFinEfectiva) {
  const dePlanillas = promedioDePlanillas(planillas, fechaFinEfectiva);
  if (dePlanillas) return { promedio: dePlanillas.promedio, origen: "PLANILLAS", meses: dePlanillas.meses };
  const deContrato = promedioUltimosSueldos(versionesContrato, fechaFinEfectiva);
  if (deContrato !== null) return { promedio: deContrato, origen: "CONTRATO", meses: null };
  return null;
}

// Último día que se cuenta para el colaborador en la gestión (criterio 1: se genera con la gestión abierta).
// - Con desvinculación registrada (fecha_retiro, último día trabajado) dentro de la gestión: hasta ese día.
// - Activo: hasta el 30 de noviembre. Mientras la gestión sigue abierta, la planilla proyecta el año completo
//   de quien sigue trabajando; así el monto no cambia día a día y el borrador generado antes del cierre ya es
//   el que se paga. Si alguien se retira antes del cierre, se vuelve a generar el borrador.
// - Inactivo sin desvinculación registrada: el fin de su último contrato si fue antes; si no, hoy (no se le
//   proyecta un tiempo que ya no va a trabajar).
function fechaFinEfectiva({ activo, fechaRetiro, versiones = [] }, rango, hoy) {
  if (fechaRetiro) return fechaRetiro < rango.hasta ? fechaRetiro : rango.hasta;
  if (activo !== false) return rango.hasta;
  const limite = hoy < rango.hasta ? hoy : rango.hasta;
  const finesDeContrato = versiones.map((v) => v.vigente_hasta).filter(Boolean);
  const ultimaSalida = finesDeContrato.length > 0 ? finesDeContrato.reduce((max, f) => (f > max ? f : max)) : null;
  return ultimaSalida && ultimaSalida < limite ? ultimaSalida : limite;
}

const plural = (n, singular, pluralTexto) => `${n} ${n === 1 ? singular : pluralTexto}`;

// Resultado completo para un colaborador: null si no corresponde calcularlo (sin ningún día en la gestión).
// Excluido (criterio 2) con menos de 3 meses en la gestión; también, sin ningún sueldo registrado (ni
// planillas ni contrato), para no aprobar un aguinaldo en cero como si fuera el monto correcto.
function calcularAguinaldo({ fechaIngreso, fechaFinEfectiva, versionesContrato = [], planillas = [] }, rango) {
  const tiempo = mesesYDias(fechaIngreso, fechaFinEfectiva, rango);
  if (!tiempo) return null;
  const sueldos = promedioDeSueldos(planillas, versionesContrato, fechaFinEfectiva);
  const promedioSueldo = sueldos?.promedio ?? 0;
  let motivo = null;
  if (tiempo.meses < MESES_MINIMOS) {
    motivo = `Menos de ${MESES_MINIMOS} meses de servicio en la gestión (trabajó ${plural(tiempo.meses, "mes", "meses")} y ${plural(tiempo.dias_resto, "día", "días")}).`;
  } else if (!sueldos) {
    motivo = "Sin sueldo registrado: no tiene planillas mensuales aprobadas ni un contrato vigente en sus tres últimos meses.";
  }
  const excluido = motivo !== null;
  return {
    meses_trabajados: tiempo.meses,
    dias_trabajados: tiempo.dias_resto,
    promedio_sueldo: promedioSueldo,
    origen_promedio: sueldos?.origen ?? null,
    meses_promedio: sueldos?.meses ?? null,
    monto: excluido ? 0 : calcularMonto(promedioSueldo, tiempo.meses, tiempo.dias_resto),
    excluido,
    motivo_exclusion: motivo,
  };
}

const UUID_O_NULO = (valor) => (UUID_RE.test(valor ?? "") ? valor.toLowerCase() : null);

// ---- Mensajes para Contabilidad y Pagos (RF-47, criterio 3) ----
// Mismo sobre común del equipo que utils/integraciones.js, pero con el tipo propio del aguinaldo: se
// arman aparte para no tocar DESTINOS/armarMensaje de la planilla mensual (ver aclaracion.md).
const ORIGEN = { grupo: "F", modulo: "RRHH" };
const VERSION_ESQUEMA = 1;
const DESTINOS_AGUINALDO = {
  CONTABILIDAD: { grupo: "D", modulo: "Contabilidad", tipo: "AGUINALDO_APROBADO_ASIENTO" },
  PAGOS: { grupo: "A", modulo: "Pagos y Facturación", tipo: "AGUINALDO_APROBADO_ORDEN_PAGO" },
};
// Cuenta de gasto referencial: ajustar al plan de cuentas de Contabilidad (igual que las de integraciones.js).
const CUENTA_AGUINALDO = { codigo: "5.1.1.06", nombre: "Aguinaldos" };
const MONEDA = "BOB";

function armarMensajeAguinaldo({ idMensaje, destino, fecha, datos }) {
  const { grupo, modulo, tipo } = DESTINOS_AGUINALDO[destino];
  return {
    encabezado: { id_mensaje: idMensaje, origen: ORIGEN, destino: { grupo, modulo }, tipo, fecha, version_esquema: VERSION_ESQUEMA },
    datos,
  };
}

const centavos = (valor) => Math.round(Number(valor) * 100);
const bs = (cents) => cents / 100;

const cabeceraAguinaldo = (a) => ({
  id_aguinaldo: a.id_aguinaldo,
  gestion: a.gestion,
  aprobada: {
    por: { id_empleado: a.aprobada_por, nombre_completo: a.aprobada_por_nombre },
    en: new Date(a.aprobada_en).toISOString(),
  },
});

// Asiento simple: el aguinaldo es un gasto que se debe íntegro a los colaboradores (sin descuentos en este
// alcance). Debe = gasto de aguinaldos; haber = sueldos y salarios por pagar. Siempre cuadra.
function armarAsientoAguinaldo({ aguinaldo, empleados, glosa }) {
  const totalCents = empleados.reduce((total, e) => total + centavos(e.monto), 0);
  return {
    ...cabeceraAguinaldo(aguinaldo),
    fecha_contable: aguinaldo.fecha_fin,
    glosa,
    moneda: MONEDA,
    renglones: [
      { cuenta: CUENTA_AGUINALDO, debe: bs(totalCents), haber: 0 },
      { cuenta: CUENTAS.SUELDOS_POR_PAGAR, debe: 0, haber: bs(totalCents) },
    ],
    total_debe: bs(totalCents),
    total_haber: bs(totalCents),
    resumen: { colaboradores: empleados.length, total_aguinaldo: bs(totalCents) },
  };
}

// Orden de dispersión: el monto de aguinaldo de cada colaborador no excluido y con monto mayor a cero.
function armarOrdenPagoAguinaldo({ aguinaldo, empleados, concepto }) {
  const beneficiarios = empleados
    .filter((e) => centavos(e.monto) > 0)
    .map((e) => ({
      id_empleado: e.id_empleado,
      nombre_completo: e.nombre_empleado,
      numero_documento: e.numero_documento,
      monto: bs(centavos(e.monto)),
    }))
    .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, "es"));
  return {
    ...cabeceraAguinaldo(aguinaldo),
    concepto,
    moneda: MONEDA,
    cantidad_beneficiarios: beneficiarios.length,
    total: bs(beneficiarios.reduce((t, b) => t + centavos(b.monto), 0)),
    beneficiarios,
  };
}

// ---- Simulación de la confirmación de Contabilidad o Pagos ----
// Contabilidad y Pagos no existen en este sistema: en vez de esperar su respuesta de verdad, el
// Administrador la simula desde la pantalla. Se arma el mismo mensaje que esos sistemas enviarían y
// aguinaldo.service lo PUBLICA en el tópico real de ese destino, para que la suscripción real lo reciba y
// lo aplique igual que si hubiera llegado de verdad (misma validación, mismo registro en EVENTOS_ENTRANTES).
const TIPO_CONFIRMACION_AGUINALDO = {
  CONTABILIDAD: "CONFIRMACION_ASIENTO_AGUINALDO",
  PAGOS: "CONFIRMACION_ORDEN_PAGO_AGUINALDO",
};

// Reporte contable consolidado por centro de costo (RF-49, KAN-69, criterio 1): el aguinaldo no tiene
// descuentos ni aportes (es un monto neto), así que el asiento por centro es siempre el mismo par de
// renglones que armarAsientoAguinaldo, solo que uno por centro en vez de un único total. El centro de costo
// es el par (sucursal, área) del colaborador, igual que en la planilla mensual (utils/integraciones.js).
// `filasPorCentro` viene de montosPorCentroDeCosto: [{ sucursal, area, monto, colaboradores }].
function agruparAguinaldoPorCentroDeCosto(filasPorCentro) {
  return filasPorCentro
    .map((f) => {
      const cents = centavos(f.monto);
      const sucursal = f.sucursal || "(sin sucursal)";
      const area = f.area || "(sin área)";
      return {
        centro_costo: `${sucursal} · ${area}`,
        sucursal,
        area,
        renglones: [
          { cuenta: CUENTA_AGUINALDO, debe: bs(cents), haber: 0 },
          { cuenta: CUENTAS.SUELDOS_POR_PAGAR, debe: 0, haber: bs(cents) },
        ],
        total_debe: bs(cents),
        total_haber: bs(cents),
      };
    })
    .sort((a, b) => a.centro_costo.localeCompare(b.centro_costo, "es"));
}

function armarConfirmacionSimulada({ idMensaje, idAguinaldo, idMensajeOrigen, destino, resultado, referencia, motivo }) {
  const { grupo, modulo } = DESTINOS_AGUINALDO[destino];
  return {
    encabezado: {
      id_mensaje: idMensaje,
      origen: { grupo, modulo },
      destino: ORIGEN,
      tipo: TIPO_CONFIRMACION_AGUINALDO[destino],
      fecha: new Date().toISOString(),
      version_esquema: VERSION_ESQUEMA,
    },
    datos: { id_aguinaldo: idAguinaldo, id_mensaje_origen: idMensajeOrigen, resultado, referencia, motivo },
  };
}

module.exports = {
  GESTION_MINIMA,
  GESTION_MAXIMA,
  MESES_MINIMOS,
  validarGestion,
  rangoGestion,
  mesesYDias,
  haberEnFecha,
  ESTADOS_PLANILLA_SUELDO,
  promedioDePlanillas,
  promedioUltimosSueldos,
  calcularMonto,
  calcularAguinaldo,
  fechaFinEfectiva,
  UUID_O_NULO,
  DESTINOS_AGUINALDO,
  armarMensajeAguinaldo,
  armarAsientoAguinaldo,
  armarOrdenPagoAguinaldo,
  agruparAguinaldoPorCentroDeCosto,
  CUENTA_AGUINALDO,
  validarSimulacionConfirmacion,
  armarConfirmacionSimulada,
};

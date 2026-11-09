// Mensajes de la planilla aprobada para Contabilidad (grupo D) y Pagos (grupo A), con el sobre común del equipo:
// `encabezado` (quién lo envía, para quién, tipo y fecha) y `datos`. El formato está en db/aclaracion.md.

const { CUOTA } = require("./calculo");

const ORIGEN = { grupo: "F", modulo: "RRHH" };
const VERSION_ESQUEMA = 1;

const DESTINOS = {
  CONTABILIDAD: { grupo: "D", modulo: "Contabilidad", tipo: "PLANILLA_APROBADA_ASIENTO" },
  PAGOS: { grupo: "A", modulo: "Pagos y Facturación", tipo: "PLANILLA_APROBADA_ORDEN_PAGO" },
};

// Cuentas del asiento que no salen de un concepto. Referenciales: ajustar al plan de cuentas de Contabilidad.
const CUENTAS = {
  SUELDOS_POR_PAGAR: { codigo: "2.1.2.01", nombre: "Sueldos y salarios por pagar" },
  APORTES_PATRONALES_POR_PAGAR: { codigo: "2.1.3.02", nombre: "Aportes patronales por pagar" },
  PRESTAMOS_AL_PERSONAL: { codigo: "1.1.4.01", nombre: "Préstamos y anticipos al personal" },
};
const CUENTA_SIN_CONCEPTO = { [CUOTA]: CUENTAS.PRESTAMOS_AL_PERSONAL };
const cuentaDe = (c) =>
  c.cuenta_codigo ? { codigo: c.cuenta_codigo, nombre: c.cuenta_nombre } : CUENTA_SIN_CONCEPTO[c.codigo] ?? null;

const MONEDA = "BOB";

// Reintentos del envío: 30 s, 1 min, 2 min… hasta 1 h entre intentos, sin límite (solo un error permanente lo detiene).
const ESPERA_BASE_MS = 30 * 1000;
const ESPERA_MAXIMA_MS = 60 * 60 * 1000;
const esperaReintento = (intentos) => Math.min(ESPERA_BASE_MS * 2 ** Math.max(intentos - 1, 0), ESPERA_MAXIMA_MS);

function armarMensaje({ idMensaje, destino, fecha, datos }) {
  const { grupo, modulo, tipo } = DESTINOS[destino];
  return {
    encabezado: {
      id_mensaje: idMensaje,
      origen: ORIGEN,
      destino: { grupo, modulo },
      tipo,
      fecha,
      version_esquema: VERSION_ESQUEMA,
    },
    datos,
  };
}

// El mismo encabezado como atributos de Pub/Sub, para filtrar sin leer el cuerpo.
const atributosDe = ({ encabezado }) => ({
  id_mensaje: encabezado.id_mensaje,
  origen: encabezado.origen.grupo,
  origen_modulo: encabezado.origen.modulo,
  destino: encabezado.destino.grupo,
  destino_modulo: encabezado.destino.modulo,
  tipo: encabezado.tipo,
  version_esquema: String(encabezado.version_esquema),
});

// Un tópico inexistente o un mensaje inválido no se arreglan reintentando; la red o las credenciales, sí.
function errorDePublicacion(error, topico) {
  switch (error?.code) {
    case 5:
      return { mensaje: `El tópico ${topico} no existe en Pub/Sub`, permanente: true };
    case 3:
      return { mensaje: "Pub/Sub rechazó el mensaje", permanente: true };
    case 7:
    case 16:
      return { mensaje: "Pub/Sub rechazó las credenciales", permanente: false };
    case "ENOENT":
      return { mensaje: "No se encontró la llave de la cuenta de servicio", permanente: false };
    default:
      return { mensaje: error?.message || "No se pudo conectar con Pub/Sub", permanente: false };
  }
}

// Sumas en centavos para no acumular errores de redondeo.
const centavos = (valor) => Math.round(Number(valor) * 100);
const bs = (cents) => cents / 100;

// Conceptos usados en la planilla (montos mayores a cero) que no tienen cuenta contable.
const sinCuenta = (conceptos) =>
  [...new Set(conceptos.filter((c) => centavos(c.monto) > 0 && !cuentaDe(c)).map((c) => c.codigo))].sort();

const cabeceraPlanilla = (planilla) => ({
  id_planilla: planilla.id_planilla,
  periodo: planilla.periodo,
  aprobada: {
    por: { id_empleado: planilla.aprobada_por, nombre_completo: planilla.aprobada_por_nombre },
    en: new Date(planilla.aprobada_en).toISOString(),
  },
});

// Asiento de la planilla, agrupado por cuenta:
//   debe  = haberes (gasto de sueldos) + aportes patronales (gasto de cargas sociales)
//   haber = descuentos (aportes laborales por pagar) + aportes patronales por pagar + líquido (sueldos por pagar)
// Cuadra porque, por colaborador, líquido = total ganado - descuentos.
function armarAsiento({ planilla, conceptos, empleados, glosa }) {
  const renglones = new Map();
  const sumarA = (cuenta, lado, cents, codigo) => {
    if (cents <= 0) return;
    const clave = `${lado}|${cuenta.codigo}`;
    const renglon = renglones.get(clave) ?? { cuenta, lado, cents: 0, conceptos: new Set() };
    renglon.cents += cents;
    if (codigo) renglon.conceptos.add(codigo);
    renglones.set(clave, renglon);
  };

  let aportes = 0;
  for (const c of conceptos) {
    const cents = centavos(c.monto);
    const cuenta = cuentaDe(c);
    if (c.tipo === "INGRESO") sumarA(cuenta, "debe", cents, c.codigo);
    if (c.tipo === "DESCUENTO") sumarA(cuenta, "haber", cents, c.codigo);
    if (c.tipo === "APORTE") {
      sumarA(cuenta, "debe", cents, c.codigo);
      aportes += cents;
    }
  }
  sumarA(CUENTAS.APORTES_PATRONALES_POR_PAGAR, "haber", aportes, null);
  const liquido = empleados.reduce((total, e) => total + centavos(e.liquido_pagable), 0);
  sumarA(CUENTAS.SUELDOS_POR_PAGAR, "haber", liquido, null);

  const lista = [...renglones.values()]
    .sort((a, b) => (a.lado === b.lado ? a.cuenta.codigo.localeCompare(b.cuenta.codigo) : a.lado === "debe" ? -1 : 1))
    .map((r) => ({
      cuenta: r.cuenta,
      debe: r.lado === "debe" ? bs(r.cents) : 0,
      haber: r.lado === "haber" ? bs(r.cents) : 0,
      conceptos: [...r.conceptos].sort(),
    }));
  const total = (lado) => bs([...renglones.values()].filter((r) => r.lado === lado).reduce((t, r) => t + r.cents, 0));
  const sumaEmpleados = (campo) => bs(empleados.reduce((t, e) => t + centavos(e[campo]), 0));

  return {
    ...cabeceraPlanilla(planilla),
    fecha_contable: planilla.fecha_fin,
    glosa,
    moneda: MONEDA,
    renglones: lista,
    total_debe: total("debe"),
    total_haber: total("haber"),
    resumen: {
      colaboradores: empleados.length,
      total_ganado: sumaEmpleados("total_ganado"),
      total_descuentos: sumaEmpleados("total_descuentos"),
      liquido_pagable: sumaEmpleados("liquido_pagable"),
      total_aportes: sumaEmpleados("total_aportes"),
    },
  };
}

// Orden de dispersión: el líquido de cada colaborador. Sin cuenta bancaria (no la guarda ningún servicio de RRHH):
// Pagos identifica al colaborador por id y documento. Quien tiene líquido cero no entra.
function armarOrdenPago({ planilla, empleados, concepto }) {
  const beneficiarios = empleados
    .filter((e) => centavos(e.liquido_pagable) > 0)
    .map((e) => ({
      id_empleado: e.id_empleado,
      nombre_completo: e.nombre_empleado,
      numero_documento: e.numero_documento,
      monto: bs(centavos(e.liquido_pagable)),
    }))
    .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, "es"));
  return {
    ...cabeceraPlanilla(planilla),
    concepto,
    moneda: MONEDA,
    cantidad_beneficiarios: beneficiarios.length,
    total: bs(beneficiarios.reduce((t, b) => t + centavos(b.monto), 0)),
    beneficiarios,
  };
}

// Respuestas de Contabilidad y Pagos (KAN-347). Cada tipo lo envía solo el grupo del destino.
const TIPOS_CONFIRMACION = {
  CONFIRMACION_ASIENTO_PLANILLA: "CONTABILIDAD",
  CONFIRMACION_ORDEN_PAGO_PLANILLA: "PAGOS",
};
const RESULTADOS = ["CONFIRMADA", "RECHAZADA"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Una confirmación que se procesa mal se reintenta así: 2 s, 4 s, 8 s… (máx. 1 min); tras 5 intentos queda FALLIDA.
const MAXIMO_INTENTOS_ENTRADA = 5;
const esperaNuevaEntrega = (intentos) => Math.min(1000 * 2 ** intentos, 60 * 1000);

// Los tópicos que se leen traen mensajes para otros grupos: solo interesan las confirmaciones dirigidas a RRHH.
function esConfirmacion(cuerpo) {
  const encabezado = cuerpo?.encabezado;
  return Boolean(
    encabezado && encabezado.destino?.grupo === ORIGEN.grupo && Object.hasOwn(TIPOS_CONFIRMACION, encabezado.tipo ?? "")
  );
}

const texto = (valor, maximo) => (typeof valor === "string" && valor.trim() ? valor.trim().slice(0, maximo) : null);

// Devuelve { errores } si el mensaje no se puede aplicar, o la confirmación lista para aplicar.
function leerConfirmacion(cuerpo) {
  const { encabezado, datos } = cuerpo;
  const destino = TIPOS_CONFIRMACION[encabezado.tipo];
  const grupo = DESTINOS[destino].grupo;
  const errores = [];
  if (encabezado.origen?.grupo !== grupo) errores.push(`El tipo ${encabezado.tipo} solo lo envía el grupo ${grupo}.`);
  if (!datos || typeof datos !== "object") {
    errores.push("Falta el bloque datos.");
    return { errores };
  }
  if (!UUID_RE.test(datos.id_planilla ?? "")) errores.push("datos.id_planilla debe ser un UUID.");
  if (!UUID_RE.test(datos.id_mensaje_origen ?? "")) errores.push("datos.id_mensaje_origen debe ser el id_mensaje enviado por RRHH.");
  if (!RESULTADOS.includes(datos.resultado)) errores.push("datos.resultado debe ser CONFIRMADA o RECHAZADA.");
  const motivo = texto(datos.motivo, 255);
  if (datos.resultado === "RECHAZADA" && !motivo) errores.push("Una respuesta RECHAZADA necesita datos.motivo.");
  if (errores.length > 0) return { errores };
  const confirmada = datos.resultado === "CONFIRMADA";
  return {
    destino,
    idPlanilla: datos.id_planilla.toLowerCase(),
    idMensajeOrigen: datos.id_mensaje_origen.toLowerCase(),
    resultado: datos.resultado,
    referencia: confirmada ? texto(datos.referencia, 60) : null,
    motivo: confirmada ? null : motivo,
  };
}

module.exports = {
  ORIGEN,
  DESTINOS,
  CUENTAS,
  TIPOS_CONFIRMACION,
  MAXIMO_INTENTOS_ENTRADA,
  esperaNuevaEntrega,
  esConfirmacion,
  leerConfirmacion,
  esperaReintento,
  armarMensaje,
  atributosDe,
  errorDePublicacion,
  sinCuenta,
  armarAsiento,
  armarOrdenPago,
};

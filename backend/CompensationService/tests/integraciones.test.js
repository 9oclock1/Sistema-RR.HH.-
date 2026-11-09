const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  CUENTAS,
  armarMensaje,
  atributosDe,
  armarAsiento,
  armarOrdenPago,
  sinCuenta,
  esConfirmacion,
  leerConfirmacion,
  esperaReintento,
  esperaNuevaEntrega,
  errorDePublicacion,
} = require("../src/utils/integraciones");

const ID_PLANILLA = "6f1d2c3b-4a59-4e68-9d7c-8b9a0f1e2d3c";
const ID_ENVIO = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

const PLANILLA = {
  id_planilla: ID_PLANILLA,
  periodo: "2026-10",
  fecha_fin: "2026-10-31",
  aprobada_por: "4192f252-acf0-4522-a109-e051cad9a50b",
  aprobada_por_nombre: "Ana Pérez",
  aprobada_en: new Date("2026-11-02T14:05:00Z"),
};

const concepto = (tipo, codigo, monto, cuenta = ["9.9.9.99", "Cuenta"]) => ({
  tipo,
  codigo,
  monto,
  cuenta_codigo: cuenta?.[0] ?? null,
  cuenta_nombre: cuenta?.[1] ?? null,
});

const empleado = (nombre, ganado, descuentos, aportes, extra = {}) => ({
  id_empleado: `id-${nombre}`,
  nombre_empleado: nombre,
  numero_documento: `CI-${nombre}`,
  total_ganado: ganado,
  total_descuentos: descuentos,
  liquido_pagable: Math.round((ganado - descuentos) * 100) / 100,
  total_aportes: aportes,
  ...extra,
});

// Dos colaboradores con montos que no son redondos: 3333,33 y 1000,01 de total ganado.
const EMPLEADOS = [empleado("Zoe", 3333.33, 423.67, 557.0), empleado("Ana", 1000.01, 127.11, 167.1)];
const CONCEPTOS = [
  concepto("INGRESO", "HABER-BASICO", 4200.0, ["5.1.1.01", "Sueldos y salarios"]),
  concepto("INGRESO", "HORAS-EXTRA", 133.34, ["5.1.1.02", "Horas extraordinarias"]),
  concepto("DESCUENTO", "SIP-VEJEZ", 433.33, ["2.1.3.01", "Aportes laborales por pagar"]),
  concepto("DESCUENTO", "SIP-RIESGO", 117.45, ["2.1.3.01", "Aportes laborales por pagar"]),
  concepto("APORTE", "CNS-SALUD", 433.34, ["5.1.2.01", "Cargas sociales patronales"]),
  concepto("APORTE", "PRO-VIVIENDA", 290.76, ["5.1.2.01", "Cargas sociales patronales"]),
];

const asiento = () => armarAsiento({ planilla: PLANILLA, conceptos: CONCEPTOS, empleados: EMPLEADOS, glosa: "Planilla" });
const renglon = (a, codigo) => a.renglones.find((r) => r.cuenta.codigo === codigo);

test("sobre: encabezado del equipo con origen F y destino D o A, y los mismos datos como atributos", () => {
  const mensaje = armarMensaje({ idMensaje: ID_ENVIO, destino: "CONTABILIDAD", fecha: "2026-11-02T14:05:00.000Z", datos: { x: 1 } });
  assert.deepEqual(mensaje.encabezado, {
    id_mensaje: ID_ENVIO,
    origen: { grupo: "F", modulo: "RRHH" },
    destino: { grupo: "D", modulo: "Contabilidad" },
    tipo: "PLANILLA_APROBADA_ASIENTO",
    fecha: "2026-11-02T14:05:00.000Z",
    version_esquema: 1,
  });
  assert.deepEqual(atributosDe(mensaje), {
    id_mensaje: ID_ENVIO,
    origen: "F",
    origen_modulo: "RRHH",
    destino: "D",
    destino_modulo: "Contabilidad",
    tipo: "PLANILLA_APROBADA_ASIENTO",
    version_esquema: "1",
  });
  const pago = armarMensaje({ idMensaje: ID_ENVIO, destino: "PAGOS", fecha: "x", datos: {} });
  assert.equal(pago.encabezado.destino.grupo, "A");
  assert.equal(pago.encabezado.tipo, "PLANILLA_APROBADA_ORDEN_PAGO");
});

test("asiento: cuadra, agrupa por cuenta y lleva aportes y líquido por pagar", () => {
  const a = asiento();
  assert.equal(a.total_debe, a.total_haber);
  // Debe: haberes por concepto + aportes patronales (misma cuenta, sumados).
  assert.equal(renglon(a, "5.1.1.01").debe, 4200);
  assert.equal(renglon(a, "5.1.2.01").debe, 724.1);
  assert.deepEqual(renglon(a, "5.1.2.01").conceptos, ["CNS-SALUD", "PRO-VIVIENDA"]);
  // Haber: descuentos agrupados, aportes por pagar y sueldos por pagar.
  assert.equal(renglon(a, "2.1.3.01").haber, 550.78);
  assert.equal(renglon(a, CUENTAS.APORTES_PATRONALES_POR_PAGAR.codigo).haber, 724.1);
  assert.equal(renglon(a, CUENTAS.SUELDOS_POR_PAGAR.codigo).haber, 3782.56);
  assert.equal(a.total_debe, 5057.44);
  // Primero el debe, después el haber, cada lado por código de cuenta.
  assert.deepEqual(
    a.renglones.map((r) => r.cuenta.codigo),
    ["5.1.1.01", "5.1.1.02", "5.1.2.01", "2.1.2.01", "2.1.3.01", "2.1.3.02"]
  );
  assert.ok(a.renglones.every((r) => (r.debe === 0) !== (r.haber === 0)));
});

test("asiento: cabecera, fecha contable al cierre del mes y resumen con los totales de los colaboradores", () => {
  const a = asiento();
  assert.equal(a.id_planilla, ID_PLANILLA);
  assert.equal(a.periodo, "2026-10");
  assert.equal(a.fecha_contable, "2026-10-31");
  assert.equal(a.moneda, "BOB");
  assert.deepEqual(a.aprobada, {
    por: { id_empleado: PLANILLA.aprobada_por, nombre_completo: "Ana Pérez" },
    en: "2026-11-02T14:05:00.000Z",
  });
  assert.deepEqual(a.resumen, {
    colaboradores: 2,
    total_ganado: 4333.34,
    total_descuentos: 550.78,
    liquido_pagable: 3782.56,
    total_aportes: 724.1,
  });
});

test("asiento: sumas en centavos sin errores de punto flotante y sin renglones en cero", () => {
  const conceptos = Array.from({ length: 10 }, (_, i) => concepto("INGRESO", `C${i}`, 0.1, ["5.1.1.01", "Sueldos"]));
  const empleados = [empleado("Uno", 1, 0, 0)];
  const a = armarAsiento({ planilla: PLANILLA, conceptos: [...conceptos, concepto("APORTE", "X", 0)], empleados, glosa: "g" });
  assert.equal(renglon(a, "5.1.1.01").debe, 1);
  assert.equal(a.total_debe, 1);
  assert.equal(a.total_haber, 1);
  assert.equal(renglon(a, CUENTAS.APORTES_PATRONALES_POR_PAGAR.codigo), undefined);
});

test("cuentas: los conceptos con monto y sin cuenta impiden el asiento; los de monto cero no", () => {
  const conceptos = [
    concepto("INGRESO", "TRANSPORTE", 150, null),
    concepto("DESCUENTO", "SINDICATO", 25, null),
    concepto("INGRESO", "HABER-BASICO", 0, null),
    concepto("INGRESO", "TRANSPORTE", 10, null),
    ...CONCEPTOS,
  ];
  assert.deepEqual(sinCuenta(conceptos), ["SINDICATO", "TRANSPORTE"]);
  assert.deepEqual(sinCuenta(CONCEPTOS), []);
});

test("orden de pago: un beneficiario por líquido mayor a cero, ordenado por nombre, y el total", () => {
  const empleados = [...EMPLEADOS, empleado("Beto", 0, 0, 0)];
  const orden = armarOrdenPago({ planilla: PLANILLA, empleados, concepto: "Pago de sueldos de octubre de 2026" });
  assert.equal(orden.cantidad_beneficiarios, 2);
  assert.deepEqual(
    orden.beneficiarios.map((b) => b.nombre_completo),
    ["Ana", "Zoe"]
  );
  assert.deepEqual(orden.beneficiarios[0], { id_empleado: "id-Ana", nombre_completo: "Ana", numero_documento: "CI-Ana", monto: 872.9 });
  assert.equal(orden.total, 3782.56);
  assert.equal(orden.moneda, "BOB");
  assert.equal(orden.concepto, "Pago de sueldos de octubre de 2026");
  // El total de la orden es el líquido del asiento (sueldos por pagar).
  assert.equal(orden.total, renglon(asiento(), CUENTAS.SUELDOS_POR_PAGAR.codigo).haber);
});

const confirmacion = (encabezado = {}, datos = {}) => ({
  encabezado: {
    id_mensaje: "D-123",
    origen: { grupo: "D", modulo: "Contabilidad" },
    destino: { grupo: "F", modulo: "RRHH" },
    tipo: "CONFIRMACION_ASIENTO_PLANILLA",
    fecha: "2026-11-02T14:06:00Z",
    version_esquema: 1,
    ...encabezado,
  },
  datos: { id_planilla: ID_PLANILLA, id_mensaje_origen: ID_ENVIO, resultado: "CONFIRMADA", referencia: " AS-458 ", ...datos },
});

test("confirmaciones: solo se toman las dirigidas a RRHH con un tipo conocido", () => {
  assert.equal(esConfirmacion(confirmacion()), true);
  assert.equal(esConfirmacion(confirmacion({ tipo: "CONFIRMACION_ORDEN_PAGO_PLANILLA" })), true);
  assert.equal(esConfirmacion(confirmacion({ destino: { grupo: "C" } })), false);
  assert.equal(esConfirmacion(confirmacion({ tipo: "ASIENTO_VENTA" })), false);
  assert.equal(esConfirmacion(confirmacion({ tipo: "toString" })), false);
  assert.equal(esConfirmacion({ texto: "hola" }), false);
  assert.equal(esConfirmacion(null), false);
});

test("confirmaciones: confirmada con referencia recortada; rechazada con motivo", () => {
  assert.deepEqual(leerConfirmacion(confirmacion()), {
    destino: "CONTABILIDAD",
    idPlanilla: ID_PLANILLA,
    idMensajeOrigen: ID_ENVIO,
    resultado: "CONFIRMADA",
    referencia: "AS-458",
    motivo: null,
  });
  const rechazo = leerConfirmacion(
    confirmacion(
      { tipo: "CONFIRMACION_ORDEN_PAGO_PLANILLA", origen: { grupo: "A" } },
      { resultado: "RECHAZADA", motivo: "Falta la cuenta bancaria de 2 colaboradores", referencia: "X" }
    )
  );
  assert.equal(rechazo.destino, "PAGOS");
  assert.equal(rechazo.referencia, null);
  assert.equal(rechazo.motivo, "Falta la cuenta bancaria de 2 colaboradores");
  assert.equal(leerConfirmacion(confirmacion({}, { referencia: undefined })).referencia, null);
});

test("confirmaciones: errores que no se arreglan reintentando", () => {
  const errores = (c) => leerConfirmacion(c).errores?.join(" ") ?? "";
  assert.match(errores(confirmacion({ origen: { grupo: "A" } })), /solo lo envía el grupo D/);
  assert.match(errores(confirmacion({}, { id_planilla: "abc" })), /id_planilla debe ser un UUID/);
  assert.match(errores(confirmacion({}, { id_mensaje_origen: null })), /id_mensaje_origen/);
  assert.match(errores(confirmacion({}, { resultado: "OK" })), /CONFIRMADA o RECHAZADA/);
  assert.match(errores(confirmacion({}, { resultado: "RECHAZADA", motivo: "  " })), /necesita datos.motivo/);
  assert.match(errores({ ...confirmacion(), datos: null }), /Falta el bloque datos/);
  assert.equal(leerConfirmacion(confirmacion({}, { motivo: "x".repeat(300), resultado: "RECHAZADA" })).motivo.length, 255);
});

test("reintentos: el envío espera 30 s, 1 min, 2 min… hasta 1 h; una entrega fallida 2 s, 4 s… hasta 1 min", () => {
  assert.deepEqual([1, 2, 3].map(esperaReintento), [30000, 60000, 120000]);
  assert.equal(esperaReintento(20), 3600000);
  assert.deepEqual([1, 2, 3].map(esperaNuevaEntrega), [2000, 4000, 8000]);
  assert.equal(esperaNuevaEntrega(10), 60000);
});

test("errores de publicación: tópico inexistente o mensaje inválido son permanentes; la red y credenciales no", () => {
  assert.deepEqual(errorDePublicacion({ code: 5 }, "ucb-sis323-sub-f"), {
    mensaje: "El tópico ucb-sis323-sub-f no existe en Pub/Sub",
    permanente: true,
  });
  assert.equal(errorDePublicacion({ code: 3 }).permanente, true);
  assert.equal(errorDePublicacion({ code: 16 }).permanente, false);
  assert.equal(errorDePublicacion({ code: 14, message: "UNAVAILABLE" }).permanente, false);
  assert.equal(errorDePublicacion(new Error("Pub/Sub no respondió a tiempo")).mensaje, "Pub/Sub no respondió a tiempo");
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validarGestion,
  rangoGestion,
  mesesYDias,
  haberEnFecha,
  promedioUltimosSueldos,
  calcularMonto,
  calcularAguinaldo,
  promedioDePlanillas,
  fechaFinEfectiva,
  MESES_MINIMOS,
  DESTINOS_AGUINALDO,
  armarMensajeAguinaldo,
  armarAsientoAguinaldo,
  armarOrdenPagoAguinaldo,
  validarSimulacionConfirmacion,
  armarConfirmacionSimulada,
} = require("../src/utils/aguinaldo");

const campos = (fn) => {
  try {
    fn();
    return [];
  } catch (error) {
    return error.detalles.map((d) => d.campo);
  }
};

// ---- validarGestion / rangoGestion ----

test("validarGestion acepta un año razonable y rechaza lo demás", () => {
  assert.equal(validarGestion(2026), 2026);
  assert.equal(validarGestion("2026"), 2026);
  assert.deepEqual(campos(() => validarGestion(2026.5)), ["gestion"]);
  assert.deepEqual(campos(() => validarGestion("no-es-un-año")), ["gestion"]);
  assert.deepEqual(campos(() => validarGestion(1500)), ["gestion"]);
});

test("rangoGestion: del 1 de diciembre del año anterior al 30 de noviembre de la gestión", () => {
  assert.deepEqual(rangoGestion(2026), { desde: "2025-12-01", hasta: "2026-11-30" });
});

// ---- mesesYDias ----

test("mesesYDias: un colaborador con toda la gestión trabajada completa 12 meses", () => {
  const rango = rangoGestion(2026);
  const resultado = mesesYDias("2020-01-01", rango.hasta, rango);
  assert.equal(resultado.meses, 12);
  assert.equal(resultado.dias_resto, 0);
});

test("mesesYDias: quien ingresó a mitad de la gestión solo cuenta desde su ingreso", () => {
  const rango = rangoGestion(2026);
  // Ingresa el 2026-09-01 y trabaja hasta el fin de la gestión: septiembre, octubre y noviembre completos.
  const resultado = mesesYDias("2026-09-01", rango.hasta, rango);
  assert.equal(resultado.meses, 3);
  assert.equal(resultado.dias_resto, 0);
});

test("mesesYDias: un mes incompleto suma los días reales del mes, no 30 fijos", () => {
  const rango = rangoGestion(2026);
  // Ingresa el 2026-10-15: un mes completo (15 de octubre a 15 de noviembre) más 16 días reales de noviembre.
  const resultado = mesesYDias("2026-10-15", rango.hasta, rango);
  assert.equal(resultado.meses, 1);
  assert.equal(resultado.dias_resto, 16);
});

test("mesesYDias: ingreso posterior al fin de la gestión no cuenta ningún día", () => {
  const rango = rangoGestion(2026);
  assert.equal(mesesYDias("2027-01-01", rango.hasta, rango), null);
});

test("mesesYDias: quien se retiró antes de que termine la gestión cuenta hasta su salida", () => {
  const rango = rangoGestion(2026);
  const resultado = mesesYDias("2020-01-01", "2026-06-30", rango);
  // Diciembre a junio son 7 meses completos (1.º de diciembre a 1.º de julio), 0 días sueltos.
  assert.equal(resultado.meses, 7);
  assert.equal(resultado.dias_resto, 0);
});

// ---- haberEnFecha / promedioUltimosSueldos ----

const version = (desde, hasta, haber) => ({ vigente_desde: desde, vigente_hasta: hasta, haber_mensual_pactado: haber });

test("haberEnFecha encuentra la versión de contrato vigente en esa fecha", () => {
  const versiones = [version("2026-06-01", null, 6000), version("2020-01-01", "2026-05-31", 5000)];
  assert.equal(haberEnFecha(versiones, "2026-07-01"), 6000);
  assert.equal(haberEnFecha(versiones, "2026-01-01"), 5000);
  assert.equal(haberEnFecha(versiones, "2010-01-01"), null);
});

test("promedioUltimosSueldos: promedia los últimos tres meses, con un ajuste salarial en el medio", () => {
  const versiones = [version("2026-10-01", null, 6000), version("2020-01-01", "2026-09-30", 5000)];
  // Referencia 2026-11-30: ese mes y octubre (6000 vigente desde oct), y septiembre (5000) -> (6000+6000+5000)/3.
  const promedio = promedioUltimosSueldos(versiones, "2026-11-30");
  assert.equal(promedio, Math.round(((6000 + 6000 + 5000) / 3) * 100) / 100);
});

test("promedioUltimosSueldos: con menos de tres meses de contrato, promedia con los que haya", () => {
  const versiones = [version("2026-10-15", null, 4500)];
  const promedio = promedioUltimosSueldos(versiones, "2026-11-30");
  assert.equal(promedio, 4500);
});

test("promedioUltimosSueldos: sin ninguna versión que cubra esas fechas, devuelve null", () => {
  assert.equal(promedioUltimosSueldos([], "2026-11-30"), null);
});

// ---- calcularMonto / calcularAguinaldo ----

test("calcularMonto: doce meses completos pagan el promedio íntegro", () => {
  assert.equal(calcularMonto(6000, 12, 0), 6000);
});

test("calcularMonto: duodécimas por meses y días parciales", () => {
  // 3 meses y 1 día de un promedio de 4500: 4500 * (3 + 1/30) / 12.
  assert.equal(calcularMonto(4500, 3, 1), Math.round(((4500 * (3 + 1 / 30)) / 12) * 100) / 100);
});

test("calcularAguinaldo: criterio 2, menos de tres meses queda excluido con el motivo y monto cero", () => {
  const rango = rangoGestion(2026);
  const resultado = calcularAguinaldo(
    { fechaIngreso: "2026-10-15", fechaFinEfectiva: rango.hasta, versionesContrato: [version("2026-10-15", null, 5000)] },
    rango
  );
  assert.equal(resultado.excluido, true);
  assert.equal(resultado.monto, 0);
  assert.match(resultado.motivo_exclusion, new RegExp(`${MESES_MINIMOS}`));
});

test("calcularAguinaldo: con tres meses o más, calcula el monto y no queda excluido", () => {
  const rango = rangoGestion(2026);
  const resultado = calcularAguinaldo(
    { fechaIngreso: "2020-01-01", fechaFinEfectiva: rango.hasta, versionesContrato: [version("2020-01-01", null, 6000)] },
    rango
  );
  assert.equal(resultado.excluido, false);
  assert.equal(resultado.monto, 6000);
  assert.equal(resultado.motivo_exclusion, null);
});

test("calcularAguinaldo: sin ningún día en la gestión, devuelve null (no corresponde calcularlo)", () => {
  const rango = rangoGestion(2026);
  assert.equal(
    calcularAguinaldo({ fechaIngreso: "2027-01-01", fechaFinEfectiva: rango.hasta, versionesContrato: [] }, rango),
    null
  );
});

// ---- promedio con las planillas reales y gestión abierta ----

const planilla = (periodo, total_ganado) => ({ periodo, total_ganado });

test("promedioDePlanillas: promedia el total ganado de las tres últimas planillas hasta el último mes trabajado", () => {
  const planillas = [planilla("2026-06", 6138.33), planilla("2026-07", 6090), planilla("2026-08", 6032), planilla("2026-09", 6380)];
  const resultado = promedioDePlanillas(planillas, "2026-08-20");
  assert.deepEqual(resultado, { promedio: 6086.78, meses: 3, periodos: ["2026-06", "2026-07", "2026-08"] });
});

test("promedioDePlanillas: con menos de tres planillas promedia las que hay; sin ninguna devuelve null", () => {
  assert.deepEqual(promedioDePlanillas([planilla("2026-10", 3000), planilla("2026-11", 3500)], "2026-11-30"), {
    promedio: 3250,
    meses: 2,
    periodos: ["2026-10", "2026-11"],
  });
  assert.equal(promedioDePlanillas([planilla("2026-12", 3000)], "2026-11-30"), null);
  assert.equal(promedioDePlanillas([], "2026-11-30"), null);
});

test("calcularAguinaldo: usa las planillas antes que el contrato e informa el origen", () => {
  const rango = rangoGestion(2026);
  const resultado = calcularAguinaldo(
    {
      fechaIngreso: "2020-01-01",
      fechaFinEfectiva: rango.hasta,
      versionesContrato: [version("2020-01-01", null, 5000)],
      planillas: [planilla("2026-09", 6000), planilla("2026-10", 6300), planilla("2026-11", 6600)],
    },
    rango
  );
  assert.equal(resultado.promedio_sueldo, 6300);
  assert.equal(resultado.origen_promedio, "PLANILLAS");
  assert.equal(resultado.meses_promedio, 3);
  assert.equal(resultado.monto, 6300);
});

test("calcularAguinaldo: sin planillas usa el haber del contrato", () => {
  const rango = rangoGestion(2026);
  const resultado = calcularAguinaldo(
    { fechaIngreso: "2020-01-01", fechaFinEfectiva: rango.hasta, versionesContrato: [version("2020-01-01", null, 5000)] },
    rango
  );
  assert.equal(resultado.origen_promedio, "CONTRATO");
  assert.equal(resultado.meses_promedio, null);
  assert.equal(resultado.monto, 5000);
});

test("calcularAguinaldo: sin planillas ni contrato queda excluido con el motivo, no aprobado en cero", () => {
  const rango = rangoGestion(2026);
  const resultado = calcularAguinaldo({ fechaIngreso: "2020-01-01", fechaFinEfectiva: rango.hasta }, rango);
  assert.equal(resultado.excluido, true);
  assert.equal(resultado.monto, 0);
  assert.equal(resultado.origen_promedio, null);
  assert.match(resultado.motivo_exclusion, /Sin sueldo registrado/);
});

test("fechaFinEfectiva: con la gestión abierta, a quien sigue activo se le cuenta hasta el 30 de noviembre", () => {
  const rango = rangoGestion(2026);
  assert.equal(fechaFinEfectiva({ activo: true }, rango, "2026-11-22"), "2026-11-30");
});

test("fechaFinEfectiva: con desvinculación registrada se cuenta hasta su fecha de retiro", () => {
  const rango = rangoGestion(2026);
  assert.equal(fechaFinEfectiva({ activo: false, fechaRetiro: "2026-08-20" }, rango, "2026-11-22"), "2026-08-20");
  assert.equal(fechaFinEfectiva({ activo: false, fechaRetiro: "2027-01-10" }, rango, "2026-11-22"), "2026-11-30");
});

test("fechaFinEfectiva: inactivo sin desvinculación, hasta el fin de su contrato o hasta hoy", () => {
  const rango = rangoGestion(2026);
  assert.equal(fechaFinEfectiva({ activo: false, versiones: [version("2020-01-01", "2026-05-31", 5000)] }, rango, "2026-11-22"), "2026-05-31");
  assert.equal(fechaFinEfectiva({ activo: false, versiones: [] }, rango, "2026-11-22"), "2026-11-22");
});

// ---- mensajes para Contabilidad y Pagos ----

test("armarMensajeAguinaldo: mismo sobre común, con el tipo propio del aguinaldo", () => {
  const mensaje = armarMensajeAguinaldo({ idMensaje: "m-1", destino: "CONTABILIDAD", fecha: "2026-12-01T00:00:00Z", datos: { x: 1 } });
  assert.equal(mensaje.encabezado.tipo, DESTINOS_AGUINALDO.CONTABILIDAD.tipo);
  assert.deepEqual(mensaje.encabezado.destino, { grupo: "D", modulo: "Contabilidad" });
  assert.deepEqual(mensaje.encabezado.origen, { grupo: "F", modulo: "RRHH" });
});

test("armarAsientoAguinaldo: el debe de aguinaldos cuadra con el haber de sueldos por pagar", () => {
  const aguinaldo = { id_aguinaldo: "a-1", gestion: 2026, fecha_fin: "2026-11-30", aprobada_por: "e-1", aprobada_por_nombre: "Ana", aprobada_en: "2026-12-01T00:00:00Z" };
  const asiento = armarAsientoAguinaldo({
    aguinaldo,
    empleados: [{ monto: 6000 }, { monto: 3000.5 }],
    glosa: "Aguinaldo",
  });
  assert.equal(asiento.total_debe, asiento.total_haber);
  assert.equal(asiento.total_debe, 9000.5);
  assert.equal(asiento.resumen.colaboradores, 2);
});

test("armarOrdenPagoAguinaldo: un beneficiario por monto mayor a cero, ordenado por nombre", () => {
  const aguinaldo = { id_aguinaldo: "a-1", gestion: 2026, aprobada_por: "e-1", aprobada_por_nombre: "Ana", aprobada_en: "2026-12-01T00:00:00Z" };
  const orden = armarOrdenPagoAguinaldo({
    aguinaldo,
    empleados: [
      { id_empleado: "1", nombre_empleado: "Zoe", numero_documento: "1", monto: 500 },
      { id_empleado: "2", nombre_empleado: "Ana", numero_documento: "2", monto: 0 },
      { id_empleado: "3", nombre_empleado: "Luis", numero_documento: "3", monto: 700 },
    ],
    concepto: "Pago de aguinaldo",
  });
  assert.equal(orden.cantidad_beneficiarios, 2);
  assert.deepEqual(orden.beneficiarios.map((b) => b.nombre_completo), ["Luis", "Zoe"]);
  assert.equal(orden.total, 1200);
});

// ---- Simulación de la confirmación de Contabilidad y Pagos ----

test("validarSimulacionConfirmacion acepta una confirmación sin motivo", () => {
  const resultado = validarSimulacionConfirmacion({ resultado: "CONFIRMADA", referencia: " AS-1 " });
  assert.deepEqual(resultado, { resultado: "CONFIRMADA", referencia: "AS-1", motivo: null });
});

test("validarSimulacionConfirmacion exige motivo para un rechazo", () => {
  assert.deepEqual(campos(() => validarSimulacionConfirmacion({ resultado: "RECHAZADA" })), ["motivo"]);
  const resultado = validarSimulacionConfirmacion({ resultado: "RECHAZADA", motivo: "Falta la cuenta contable" });
  assert.deepEqual(resultado, { resultado: "RECHAZADA", referencia: null, motivo: "Falta la cuenta contable" });
});

test("validarSimulacionConfirmacion rechaza un resultado que no sea CONFIRMADA o RECHAZADA", () => {
  assert.deepEqual(campos(() => validarSimulacionConfirmacion({ resultado: "OK" })), ["resultado"]);
});

test("armarConfirmacionSimulada: mismo sobre que una confirmación real, con el grupo del destino como origen", () => {
  const cuerpo = armarConfirmacionSimulada({
    idMensaje: "sim-1",
    idAguinaldo: "a-1",
    idMensajeOrigen: "env-1",
    destino: "PAGOS",
    resultado: "CONFIRMADA",
    referencia: "OP-1",
    motivo: null,
  });
  assert.equal(cuerpo.encabezado.tipo, "CONFIRMACION_ORDEN_PAGO_AGUINALDO");
  assert.deepEqual(cuerpo.encabezado.origen, { grupo: "A", modulo: "Pagos y Facturación" });
  assert.deepEqual(cuerpo.encabezado.destino, { grupo: "F", modulo: "RRHH" });
  assert.deepEqual(cuerpo.datos, { id_aguinaldo: "a-1", id_mensaje_origen: "env-1", resultado: "CONFIRMADA", referencia: "OP-1", motivo: null });
});

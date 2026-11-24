const { test, describe, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/db");
const modelo = require("../src/models/finiquitosModel");
const empleadosCliente = require("../src/clients/empleados.cliente");
const finiquitoPdf = require("../src/services/finiquitoPdf");
const servicio = require("../src/services/finiquitosService");
const { atributosDe } = require("../src/utils/integraciones");
const {
  consolidarFiniquito,
  armarAsientoFiniquito,
  armarMensajeOrdenPagoFiniquito,
  armarMensajeAsientoFiniquito,
  armarRespuestaSimulada,
  montoEnLetras,
} = require("../src/utils/finiquitos");

const ID_PROCESO = "33333333-3333-3333-3333-333333333333";
const ID_EMPLEADO = "11111111-1111-1111-1111-111111111111";
const ID_ADMIN = "22222222-2222-2222-2222-222222222222";
const ID_FINIQUITO = "44444444-4444-4444-4444-444444444444";
const ID_PRESTAMO_1 = "55555555-5555-4555-8555-555555555551";
const ID_PRESTAMO_2 = "55555555-5555-4555-8555-555555555552";
const ID_PRESTAMO_3 = "55555555-5555-4555-8555-555555555553";

const ADMIN = { idEmpleado: ID_ADMIN, rol: "admin" };
const CONTADOR = { idEmpleado: ID_ADMIN, rol: "contador" };

function crearClienteFalso(respuestas = () => ({ rows: [] })) {
  const comandos = [];
  return {
    comandos,
    async query(sql, params) {
      comandos.push({ sql: String(sql).trim(), params });
      return respuestas(String(sql), params);
    },
    release() {},
  };
}

const PROCESO_BASE = {
  id_proceso: ID_PROCESO,
  id_empleado: ID_EMPLEADO,
  nombre_empleado: "Valeria Nina Quisbert",
  fecha_ingreso: "2024-02-01",
  fecha_retiro: "2026-10-31",
  codigo_causal: "DESAHUCIO",
  causal_nombre: "Desahucio",
  corresponde_desahucio: true,
  estado: "EN_CURSO",
};

const INSUMOS_BASE = {
  promedio: { promedio: 4000 },
  beneficios: {
    promedio_base: 4000,
    anios_servicio: 2,
    meses_servicio: 9,
    dias_fraccion: 0,
    monto_indemnizacion: 11000,
    monto_desahucio: 12000,
    total: 23000,
  },
  saldos: {
    promedio: 4000,
    gestion_aguinaldo: 2026,
    aguinaldo_meses: 10,
    aguinaldo_dias: 0,
    monto_aguinaldo: 3333.33,
    dias_pendientes: 15,
    monto_vacaciones_pendientes: 2000,
    anio_en_curso_meses: 9,
    anio_en_curso_dias: 0,
    monto_duodecima_vacaciones: 1500,
    total: 6833.33,
  },
  prestamos: [],
};

afterEach(() => mock.restoreAll());

describe("consolidarFiniquito", () => {
  test("ordena los ingresos correctamente y omite montos en 0", () => {
    const res = consolidarFiniquito({
      proceso: PROCESO_BASE,
      promedio: INSUMOS_BASE.promedio,
      beneficios: { ...INSUMOS_BASE.beneficios, monto_desahucio: 0 },
      saldos: { ...INSUMOS_BASE.saldos, monto_vacaciones_pendientes: 0 },
      prestamos: [],
    });
    assert.deepEqual(
      res.renglones.map((r) => r.codigo),
      ["INDEMNIZACION", "AGUINALDO_DUODECIMAS", "VACACIONES_DUODECIMAS"]
    );
    assert.equal(res.total_ingresos, 15833.33);
    assert.equal(res.total_descuentos, 0);
    assert.equal(res.liquido_pagable, 15833.33);
  });

  test("descuenta préstamos activos en orden de antigüedad con id_prestamo y saldo_prestamo", () => {
    const res = consolidarFiniquito({
      proceso: PROCESO_BASE,
      ...INSUMOS_BASE,
      prestamos: [
        { id_prestamo: ID_PRESTAMO_2, tipo: "PRESTAMO", monto: 2000, saldo_pendiente: 1200.55, estado: "ACTIVO", creado_en: "2026-08-01T10:00:00Z" },
        { id_prestamo: ID_PRESTAMO_1, tipo: "ANTICIPO", monto: 1000, saldo_pendiente: 500.45, estado: "ACTIVO", creado_en: "2026-05-01T10:00:00Z" },
      ],
    });
    const desc = res.renglones.filter((r) => r.tipo === "DESCUENTO");
    assert.equal(desc.length, 2);
    assert.equal(desc[0].id_prestamo, ID_PRESTAMO_1);
    assert.equal(desc[0].codigo, "ANTICIPO");
    assert.equal(desc[0].saldo_prestamo, 500.45);
    assert.equal(desc[1].id_prestamo, ID_PRESTAMO_2);
    assert.equal(desc[1].codigo, "PRESTAMO");
    assert.equal(desc[1].saldo_prestamo, 1200.55);
    assert.equal(res.total_descuentos, 1701);
    assert.equal(res.liquido_pagable, 28132.33);
  });

  test("aplica descuento parcial si los préstamos superan ingresos: líquido 0 y omite los que no caben", () => {
    const res = consolidarFiniquito({
      proceso: PROCESO_BASE,
      promedio: { promedio: 1000 },
      beneficios: { ...INSUMOS_BASE.beneficios, promedio_base: 1000, monto_indemnizacion: 1000, monto_desahucio: 0 },
      saldos: { ...INSUMOS_BASE.saldos, promedio: 1000, monto_aguinaldo: 0, monto_vacaciones_pendientes: 0, monto_duodecima_vacaciones: 0 },
      prestamos: [
        { id_prestamo: ID_PRESTAMO_1, tipo: "ANTICIPO", monto: 600, saldo_pendiente: 600, estado: "ACTIVO", creado_en: "2026-01-01T00:00:00Z" },
        { id_prestamo: ID_PRESTAMO_2, tipo: "PRESTAMO", monto: 800, saldo_pendiente: 800, estado: "ACTIVO", creado_en: "2026-02-01T00:00:00Z" },
        { id_prestamo: ID_PRESTAMO_3, tipo: "PRESTAMO", monto: 500, saldo_pendiente: 500, estado: "ACTIVO", creado_en: "2026-03-01T00:00:00Z" },
      ],
    });
    const desc = res.renglones.filter((r) => r.tipo === "DESCUENTO");
    assert.equal(desc.length, 2);
    assert.equal(desc[0].monto, 600);
    assert.equal(desc[1].monto, 400);
    assert.equal(desc[1].saldo_prestamo, 800);
    assert.match(desc[1].detalle, /Descuento parcial: queda un saldo de Bs 400,00/);
    assert.equal(res.total_ingresos, 1000);
    assert.equal(res.total_descuentos, 1000);
    assert.equal(res.liquido_pagable, 0);
  });

  test("calcula en centavos sin errores de punto flotante", () => {
    const res = consolidarFiniquito({
      proceso: PROCESO_BASE,
      promedio: { promedio: 3000 },
      beneficios: { ...INSUMOS_BASE.beneficios, promedio_base: 3000, monto_indemnizacion: 0.1, monto_desahucio: 0.2 },
      saldos: { ...INSUMOS_BASE.saldos, promedio: 3000, monto_aguinaldo: 0.3, monto_vacaciones_pendientes: 0, monto_duodecima_vacaciones: 0 },
      prestamos: [{ id_prestamo: ID_PRESTAMO_1, tipo: "ANTICIPO", monto: 0.1, saldo_pendiente: 0.1, estado: "ACTIVO" }],
    });
    assert.equal(res.total_ingresos, 0.6);
    assert.equal(res.total_descuentos, 0.1);
    assert.equal(res.liquido_pagable, 0.5);
  });

  test("lanza 409 CALCULOS_INCOMPLETOS con detalle por cada cálculo faltante", () => {
    assert.throws(
      () => consolidarFiniquito({ proceso: PROCESO_BASE, promedio: null, beneficios: null, saldos: null }),
      (err) => {
        assert.equal(err.estado, 409);
        assert.equal(err.codigo, "CALCULOS_INCOMPLETOS");
        assert.deepEqual(
          err.detalles.map((d) => d.campo),
          ["promedio", "beneficios", "saldos"]
        );
        return true;
      }
    );
  });

  test("lanza 409 CALCULOS_DESACTUALIZADOS cuando promedio_base o promedio difieren", () => {
    assert.throws(
      () =>
        consolidarFiniquito({
          proceso: PROCESO_BASE,
          promedio: { promedio: 4500 },
          beneficios: { ...INSUMOS_BASE.beneficios, promedio_base: 4000 },
          saldos: { ...INSUMOS_BASE.saldos, promedio: 4000 },
        }),
      (err) => {
        assert.equal(err.estado, 409);
        assert.equal(err.codigo, "CALCULOS_DESACTUALIZADOS");
        assert.deepEqual(
          err.detalles.map((d) => d.campo),
          ["beneficios", "saldos"]
        );
        return true;
      }
    );
  });
});

describe("asiento, sobres y montoEnLetras", () => {
  test("el asiento cuadra (debe = haber) y omite cuentas con monto 0", () => {
    const consolidado = consolidarFiniquito({
      proceso: PROCESO_BASE,
      promedio: INSUMOS_BASE.promedio,
      beneficios: INSUMOS_BASE.beneficios,
      saldos: { ...INSUMOS_BASE.saldos, monto_aguinaldo: 0 },
      prestamos: [{ id_prestamo: ID_PRESTAMO_1, tipo: "ANTICIPO", monto: 500, saldo_pendiente: 500, estado: "ACTIVO" }],
    });
    const asiento = armarAsientoFiniquito({
      ...consolidado,
      id_finiquito: ID_FINIQUITO,
    });
    assert.equal(asiento.total_debe, asiento.total_haber);
    assert.equal(asiento.total_debe, consolidado.total_ingresos);
    assert.ok(!asiento.renglones.some((r) => r.cuenta.codigo === "2.1.5.02"));
    assert.ok(asiento.renglones.every((r) => (r.debe > 0) !== (r.haber > 0)));
  });

  test("los encabezados van F -> A / F -> D, las respuestas simuladas al revés y atributosDe incluye origen y destino", () => {
    const consolidado = consolidarFiniquito({ proceso: PROCESO_BASE, ...INSUMOS_BASE });
    const fin = {
      id_finiquito: ID_FINIQUITO,
      numero_documento: "FIN-2026-000001",
      fecha_retiro: PROCESO_BASE.fecha_retiro,
      aprobado_por: ID_ADMIN,
      aprobado_en: "2026-11-01T12:00:00Z",
      ...consolidado,
    };

    const msgPagos = armarMensajeOrdenPagoFiniquito({ idMensaje: "msg-1", proceso: PROCESO_BASE, finiquito: fin });
    assert.deepEqual(msgPagos.encabezado.origen, { grupo: "F", modulo: "RRHH" });
    assert.deepEqual(msgPagos.encabezado.destino, { grupo: "A", modulo: "Pagos y Facturación" });
    assert.equal(msgPagos.encabezado.tipo, "FINIQUITO_APROBADO_ORDEN_PAGO");
    assert.deepEqual(atributosDe(msgPagos), {
      id_mensaje: "msg-1",
      origen: "F",
      origen_modulo: "RRHH",
      destino: "A",
      destino_modulo: "Pagos y Facturación",
      tipo: "FINIQUITO_APROBADO_ORDEN_PAGO",
      version_esquema: "1",
    });

    const msgCont = armarMensajeAsientoFiniquito({ idMensaje: "msg-2", proceso: PROCESO_BASE, finiquito: fin });
    assert.deepEqual(msgCont.encabezado.origen, { grupo: "F", modulo: "RRHH" });
    assert.deepEqual(msgCont.encabezado.destino, { grupo: "D", modulo: "Contabilidad" });
    assert.equal(msgCont.encabezado.tipo, "FINIQUITO_APROBADO_ASIENTO");

    const respPagos = armarRespuestaSimulada({ idMensaje: "r-1", destino: "PAGOS", idFiniquito: ID_FINIQUITO, idMensajeOrigen: "msg-1" });
    assert.equal(respPagos.encabezado.origen.grupo, "A");
    assert.equal(respPagos.encabezado.destino.grupo, "F");
    assert.equal(respPagos.encabezado.tipo, "CONFIRMACION_ORDEN_PAGO_FINIQUITO");

    const respCont = armarRespuestaSimulada({ idMensaje: "r-2", destino: "CONTABILIDAD", idFiniquito: ID_FINIQUITO, idMensajeOrigen: "msg-2" });
    assert.equal(respCont.encabezado.origen.grupo, "D");
    assert.equal(respCont.encabezado.destino.grupo, "F");
    assert.equal(respCont.encabezado.tipo, "CONFIRMACION_ASIENTO_FINIQUITO");
  });

  test("montoEnLetras formatea los montos esperados", () => {
    assert.equal(montoEnLetras(0), "Cero 00/100 bolivianos");
    assert.equal(montoEnLetras(1), "Un 00/100 bolivianos");
    assert.equal(montoEnLetras(15), "Quince 00/100 bolivianos");
    assert.equal(montoEnLetras(100), "Cien 00/100 bolivianos");
    assert.equal(montoEnLetras(1000), "Mil 00/100 bolivianos");
    assert.equal(montoEnLetras(4308.33), "Cuatro mil trescientos ocho 33/100 bolivianos");
    assert.equal(montoEnLetras(1250000.5), "Un millón doscientos cincuenta mil 50/100 bolivianos");
  });
});

describe("finiquitosService y PDF", () => {
  test("generar: reemplaza borrador, rechaza 409 aprobado o proceso no abierto y 403 al contador", async () => {
    await assert.rejects(() => servicio.generar(ID_PROCESO, CONTADOR), (e) => e.estado === 403);

    const cliente = crearClienteFalso();
    mock.method(pool, "connect", async () => cliente);
    mock.method(modelo, "bloquearProceso", async () => ({ ...PROCESO_BASE, estado: "CERRADO" }));
    await assert.rejects(() => servicio.generar(ID_PROCESO, ADMIN), (e) => e.estado === 409 && e.codigo === "PROCESO_NO_ABIERTO");

    mock.method(modelo, "bloquearProceso", async () => PROCESO_BASE);
    mock.method(modelo, "obtenerPorProceso", async () => ({ id_finiquito: ID_FINIQUITO, estado: "APROBADO" }));
    await assert.rejects(() => servicio.generar(ID_PROCESO, ADMIN), (e) => e.estado === 409 && e.codigo === "FINIQUITO_APROBADO");

    mock.method(modelo, "obtenerPorProceso", async (_id, c) => (c ? { id_finiquito: ID_FINIQUITO, estado: "BORRADOR" } : { id_finiquito: ID_FINIQUITO, estado: "BORRADOR", renglones: [] }));
    mock.method(modelo, "obtenerInsumos", async () => INSUMOS_BASE);
    let guardado;
    mock.method(modelo, "guardarBorrador", async (_c, datos) => {
      guardado = datos;
      return ID_FINIQUITO;
    });
    mock.method(modelo, "obtenerProcesoDetalle", async () => PROCESO_BASE);
    mock.method(modelo, "ultimosEnviosPorDestino", async () => ({}));

    const res = await servicio.generar(ID_PROCESO, ADMIN);
    assert.equal(guardado.id_finiquito, ID_FINIQUITO);
    assert.equal(res.finiquito.estado, "BORRADOR");
  });

  test("aprobar: asigna número, genera PDF e inserta 2 eventos SALIENTE en la misma transacción", async () => {
    const cliente = crearClienteFalso();
    mock.method(pool, "connect", async () => cliente);
    mock.method(empleadosCliente, "obtenerEmpleado", async () => ({ nombre_completo: "Andrea Salazar Vega" }));
    mock.method(modelo, "bloquearProceso", async () => PROCESO_BASE);

    const consolidado = consolidarFiniquito({ proceso: PROCESO_BASE, ...INSUMOS_BASE });
    const borrador = {
      id_finiquito: ID_FINIQUITO,
      id_proceso: ID_PROCESO,
      estado: "BORRADOR",
      fecha_retiro: PROCESO_BASE.fecha_retiro,
      codigo_causal: PROCESO_BASE.codigo_causal,
      promedio_base: INSUMOS_BASE.beneficios.promedio_base,
      anios_servicio: INSUMOS_BASE.beneficios.anios_servicio,
      meses_servicio: INSUMOS_BASE.beneficios.meses_servicio,
      dias_fraccion: INSUMOS_BASE.beneficios.dias_fraccion,
      ...consolidado,
    };
    mock.method(modelo, "obtenerPorProceso", async () => borrador);
    mock.method(modelo, "obtenerInsumos", async () => INSUMOS_BASE);
    mock.method(modelo, "siguienteNumeroDocumento", async () => "FIN-2026-000001");
    mock.method(modelo, "marcarAprobado", async () => ({ aprobado_en: "2026-11-01T12:00:00Z" }));
    mock.method(finiquitoPdf, "aPdf", async () => ({ nombre_archivo: "finiquito-FIN-2026-000001.pdf", contenido: Buffer.from("%PDF-1.4") }));
    const guardarDoc = mock.method(modelo, "guardarDocumento", async () => {});
    const eventos = [];
    mock.method(modelo, "registrarEvento", async (_c, ev) => {
      eventos.push(ev);
      return "ev-1";
    });
    mock.method(modelo, "obtenerProcesoDetalle", async () => PROCESO_BASE);
    mock.method(modelo, "ultimosEnviosPorDestino", async () => ({}));

    await servicio.aprobar(ID_PROCESO, ADMIN);

    assert.equal(guardarDoc.mock.callCount(), 1);
    assert.equal(eventos.length, 2);
    assert.deepEqual(eventos.map((e) => e.destino), ["PAGOS", "CONTABILIDAD"]);
    assert.ok(eventos.every((e) => e.sentido === "SALIENTE"));
    assert.ok(cliente.comandos.some((c) => c.sql === "COMMIT"));
  });

  test("aprobar: con BORRADOR_DESACTUALIZADO hace ROLLBACK y sin borrador devuelve 404", async () => {
    const cliente = crearClienteFalso();
    mock.method(pool, "connect", async () => cliente);
    mock.method(empleadosCliente, "obtenerEmpleado", async () => null);
    mock.method(modelo, "bloquearProceso", async () => PROCESO_BASE);
    mock.method(modelo, "obtenerPorProceso", async () => null);
    await assert.rejects(() => servicio.aprobar(ID_PROCESO, ADMIN), (e) => e.estado === 404 && e.codigo === "FINIQUITO_NO_GENERADO");

    const cliente2 = crearClienteFalso();
    mock.method(pool, "connect", async () => cliente2);
    const consolidado = consolidarFiniquito({ proceso: PROCESO_BASE, ...INSUMOS_BASE });
    mock.method(modelo, "obtenerPorProceso", async () => ({
      id_finiquito: ID_FINIQUITO,
      estado: "BORRADOR",
      fecha_retiro: PROCESO_BASE.fecha_retiro,
      codigo_causal: PROCESO_BASE.codigo_causal,
      promedio_base: 3000,
      anios_servicio: 2,
      meses_servicio: 9,
      dias_fraccion: 0,
      ...consolidado,
    }));
    mock.method(modelo, "obtenerInsumos", async () => INSUMOS_BASE);
    const regEv = mock.method(modelo, "registrarEvento", async () => {});
    await assert.rejects(() => servicio.aprobar(ID_PROCESO, ADMIN), (e) => e.estado === 409 && e.codigo === "BORRADOR_DESACTUALIZADO");
    assert.equal(regEv.mock.callCount(), 0);
    assert.ok(cliente2.comandos.some((c) => c.sql === "ROLLBACK"));
  });

  test("asegurarEditable lanza 409 con finiquito aprobado y no lanza con borrador o sin finiquito", async () => {
    await assert.rejects(
      () => modelo.asegurarEditable({ query: async () => ({ rows: [{ estado: "APROBADO" }] }) }, ID_PROCESO),
      (e) => e.estado === 409 && e.codigo === "FINIQUITO_APROBADO"
    );
    await modelo.asegurarEditable({ query: async () => ({ rows: [] }) }, ID_PROCESO);
  });

  test("finiquitoPdf.aPdf genera un Buffer que empieza con %PDF", async () => {
    const consolidado = consolidarFiniquito({ proceso: PROCESO_BASE, ...INSUMOS_BASE });
    const res = await finiquitoPdf.aPdf({
      proceso: PROCESO_BASE,
      finiquito: {
        id_finiquito: ID_FINIQUITO,
        numero_documento: "FIN-2026-000001",
        fecha_retiro: PROCESO_BASE.fecha_retiro,
        codigo_causal: PROCESO_BASE.codigo_causal,
        promedio_base: 4000,
        anios_servicio: 2,
        meses_servicio: 9,
        dias_fraccion: 0,
        aprobado_por: ID_ADMIN,
        aprobado_en: "2026-11-01T12:00:00Z",
        ...consolidado,
      },
      aprobadorNombre: "Andrea Salazar Vega",
    });
    assert.equal(res.nombre_archivo, "finiquito-FIN-2026-000001.pdf");
    assert.ok(Buffer.isBuffer(res.contenido));
    assert.equal(res.contenido.subarray(0, 4).toString("utf8"), "%PDF");
  });
});

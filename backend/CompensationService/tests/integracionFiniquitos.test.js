const { test, describe, before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "secreto-finiquitos-test";
process.env.FINIQUITO_REINTENTO_BASE_MS = "0";
process.env.FINIQUITO_MAXIMO_INTENTOS = "3";

const pool = require("../src/config/db");
const pubsub = require("../src/config/pubsub");
const modelo = require("../src/models/finiquitosModel");
const mensajesPublicados = require("../src/utils/mensajesPublicados");
const notificaciones = require("../src/clients/notificacionesCliente");
const integracion = require("../src/services/integracionFiniquitosService");
const confirmaciones = require("../src/services/confirmacionesFiniquitoService");
const finiquitosService = require("../src/services/finiquitosService");
const finiquitosRoutes = require("../src/routes/finiquitosRoutes");
const manejadorErrores = require("../src/middlewares/manejadorErrores");
const { armarRespuestaSimulada } = require("../src/utils/finiquitos");

const ID_PROCESO = "33333333-3333-4333-8333-333333333333";
const ID_FINIQUITO = "44444444-4444-4444-8444-444444444444";
const ID_EMPLEADO = "11111111-1111-4111-8111-111111111111";
const ID_ADMIN = "22222222-2222-4222-8222-222222222222";
const ID_ENVIO_PAGOS = "66666666-6666-4666-8666-666666666661";
const ID_ENVIO_CONT = "66666666-6666-4666-8666-666666666662";
const ID_PRESTAMO_1 = "77777777-7777-4777-8777-777777777771";
const ID_PRESTAMO_2 = "77777777-7777-4777-8777-777777777772";
const ADMIN = { idEmpleado: ID_ADMIN, rol: "admin" };

function crearClienteFalso() {
  return {
    async query() {
      return { rows: [] };
    },
    release() {},
  };
}

function crearPubSubFalso(fnPublicar = async () => "pubsub-msg-1") {
  const topicosLlamados = [];
  return {
    topicosLlamados,
    topic(nombre) {
      topicosLlamados.push(nombre);
      return { publishMessage: fnPublicar };
    },
  };
}

const eventoSalienteBase = (destino = "PAGOS") => ({
  id_evento: "ev-1",
  id_mensaje: destino === "PAGOS" ? ID_ENVIO_PAGOS : ID_ENVIO_CONT,
  id_finiquito: ID_FINIQUITO,
  sentido: "SALIENTE",
  destino,
  tipo_evento: destino === "PAGOS" ? "FINIQUITO_APROBADO_ORDEN_PAGO" : "FINIQUITO_APROBADO_ASIENTO",
  topico: "ucb-sis323-sub-f",
  intentos: 0,
  carga: {
    encabezado: {
      id_mensaje: destino === "PAGOS" ? ID_ENVIO_PAGOS : ID_ENVIO_CONT,
      origen: { grupo: "F", modulo: "RRHH" },
      destino: { grupo: destino === "PAGOS" ? "A" : "D", modulo: destino === "PAGOS" ? "Pagos y Facturación" : "Contabilidad" },
      tipo: destino === "PAGOS" ? "FINIQUITO_APROBADO_ORDEN_PAGO" : "FINIQUITO_APROBADO_ASIENTO",
      fecha: "2026-11-01T12:00:00Z",
      version_esquema: 1,
    },
    datos: { id_finiquito: ID_FINIQUITO, numero_documento: "FIN-2026-000001" },
  },
});

afterEach(() => mock.restoreAll());

describe("integracionFiniquitosService (despachador y caída)", () => {
  test("publica en tópico F, marca ENTREGADO, registra en consola y encola respuesta simulada", async () => {
    const ps = crearPubSubFalso(async () => "pubsub-101");
    mock.method(pubsub, "obtenerCliente", () => ps);
    mock.method(modelo, "reservarEventosPendientes", async () => [eventoSalienteBase("PAGOS")]);
    const entregado = mock.method(modelo, "marcarEventoEntregado", async () => {});
    const consola = mock.method(mensajesPublicados, "registrar", () => {});
    const encolados = [];
    mock.method(modelo, "registrarEvento", async (_c, ev) => {
      encolados.push(ev);
      return "ev-sim-1";
    });

    const n = await integracion.despacharFiniquitos();
    assert.equal(n, 1);
    assert.deepEqual(ps.topicosLlamados, ["ucb-sis323-sub-f"]);
    assert.equal(entregado.mock.callCount(), 1);
    assert.equal(consola.mock.calls[0].arguments[0].direccion, "publicado");
    assert.equal(encolados.length, 1);
    assert.equal(encolados[0].sentido, "RESPUESTA_SIMULADA");
    assert.equal(encolados[0].topico, "ucb-sis323-sub-f");
  });

  test("error de red deja PENDIENTE con intentos + 1; error permanente marca FALLIDO; sin PubSub no hace nada", async () => {
    mock.method(pubsub, "obtenerCliente", () => null);
    const reservar = mock.method(modelo, "reservarEventosPendientes");
    assert.equal(await integracion.despacharFiniquitos(), 0);
    assert.equal(reservar.mock.callCount(), 0);

    const psRed = crearPubSubFalso(async () => {
      throw Object.assign(new Error("UNAVAILABLE"), { code: 14 });
    });
    mock.method(pubsub, "obtenerCliente", () => psRed);
    mock.method(modelo, "reservarEventosPendientes", async () => [eventoSalienteBase("PAGOS")]);
    const errores = [];
    mock.method(modelo, "marcarEventoError", async (_id, info) => errores.push(info));
    await integracion.despacharFiniquitos();
    assert.equal(errores[0].fallido, false);

    const psPerm = crearPubSubFalso(async () => {
      throw Object.assign(new Error("NOT_FOUND"), { code: 5 });
    });
    mock.method(pubsub, "obtenerCliente", () => psPerm);
    await integracion.despacharFiniquitos();
    assert.equal(errores[1].fallido, true);
  });

  test("con emulador activo, NOT_FOUND recrea el tópico y completa la publicación", async () => {
    const anterior = process.env.PUBSUB_EMULATOR_HOST;
    process.env.PUBSUB_EMULATOR_HOST = "localhost:8085";
    try {
      let llamadasPublish = 0;
      let llamadasAutoCreate = 0;
      const psEmu = {
        topic() {
          return {
            async get(opc) {
              if (opc?.autoCreate) llamadasAutoCreate += 1;
              return {};
            },
            async publishMessage() {
              llamadasPublish += 1;
              if (llamadasPublish === 1) {
                throw Object.assign(new Error("Topic not found"), { code: 5 });
              }
              return "pubsub-emu-ok";
            },
          };
        },
      };
      mock.method(pubsub, "obtenerCliente", () => psEmu);
      mock.method(modelo, "reservarEventosPendientes", async () => [eventoSalienteBase("PAGOS")]);
      const entregado = mock.method(modelo, "marcarEventoEntregado", async () => {});
      mock.method(mensajesPublicados, "registrar", () => {});
      mock.method(modelo, "registrarEvento", async () => "ev-sim-emu");

      await integracion.despacharFiniquitos();
      assert.equal(llamadasAutoCreate, 1);
      assert.equal(llamadasPublish, 2);
      assert.equal(entregado.mock.callCount(), 1);
    } finally {
      if (anterior === undefined) delete process.env.PUBSUB_EMULATOR_HOST;
      else process.env.PUBSUB_EMULATOR_HOST = anterior;
    }
  });

  test("al publicar RESPUESTA_SIMULADA entrega al consumidor recibirMensaje", async () => {
    const ps = crearPubSubFalso(async () => "pubsub-sim-1");
    mock.method(pubsub, "obtenerCliente", () => ps);
    const resp = armarRespuestaSimulada({
      idMensaje: "99999999-9999-4999-8999-999999999999",
      destino: "PAGOS",
      idFiniquito: ID_FINIQUITO,
      idMensajeOrigen: ID_ENVIO_PAGOS,
    });
    mock.method(modelo, "reservarEventosPendientes", async () => [
      { ...eventoSalienteBase("PAGOS"), sentido: "RESPUESTA_SIMULADA", carga: resp },
    ]);
    mock.method(modelo, "marcarEventoEntregado", async () => {});
    const recibido = mock.method(confirmaciones, "recibirMensaje", async () => ({}));

    await integracion.despacharFiniquitos();
    assert.deepEqual(ps.topicosLlamados, ["ucb-sis323-sub-f"]);
    assert.equal(recibido.mock.callCount(), 1);
  });

  test("caída simulada: no llama a publishMessage, reprograma a 5s y al expirar vuelve a publicar", async () => {
    const publish = mock.fn(async () => "pubsub-ok");
    mock.method(pubsub, "obtenerCliente", () => ({ topic: () => ({ publishMessage: publish }) }));
    mock.method(modelo, "reservarEventosPendientes", async () => [eventoSalienteBase("CONTABILIDAD")]);
    const errores = [];
    mock.method(modelo, "marcarEventoError", async (_id, info) => errores.push(info));
    mock.method(modelo, "marcarEventoEntregado", async () => {});
    mock.method(modelo, "registrarEvento", async () => "ev-sim");

    integracion.activarCaidaBroker(10);
    await integracion.despacharFiniquitos();
    assert.equal(publish.mock.callCount(), 0);
    assert.equal(errores[0].esperaMs, 5000);
    assert.match(errores[0].error, /caída simulada/);

    // Expiración simulada
    integracion.activarCaidaBroker(0);
    await integracion.despacharFiniquitos();
    assert.equal(publish.mock.callCount(), 1);
  });
});

describe("confirmacionesFiniquitoService (consumidor, duplicados, préstamos y DLQ)", () => {
  test("éxito: Pagos deja APROBADO y luego Contabilidad deja PAGADO y proceso CERRADO", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());
    const finAprobado = {
      id_finiquito: ID_FINIQUITO,
      id_proceso: ID_PROCESO,
      id_empleado: ID_EMPLEADO,
      nombre_empleado: "Elena Paredes",
      numero_documento: "FIN-2026-000001",
      estado: "APROBADO",
      estado_pagos: "PENDIENTE",
      estado_contabilidad: "PENDIENTE",
      aprobado_por: ID_ADMIN,
      renglones: [],
    };
    mock.method(modelo, "bloquearFiniquitoPorId", async () => finAprobado);
    mock.method(modelo, "ultimosEnviosPorDestino", async () => ({
      PAGOS: { id_mensaje: ID_ENVIO_PAGOS },
      CONTABILIDAD: { id_mensaje: ID_ENVIO_CONT },
    }));
    mock.method(modelo, "marcarMensajeEntranteProcesado", async () => {});
    const pagado = mock.method(modelo, "marcarFiniquitoPagadoYCerrarProceso", async () => {});
    mock.method(modelo, "listarPrestamosEmpleado", async () => []);

    const msgPagos = armarRespuestaSimulada({
      idMensaje: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      destino: "PAGOS",
      idFiniquito: ID_FINIQUITO,
      idMensajeOrigen: ID_ENVIO_PAGOS,
      referencia: "OP-1",
    });
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: "e1", carga: JSON.stringify(msgPagos), estado: "RECIBIDO" }));
    mock.method(modelo, "actualizarRespuestaIntegracion", async () => ({ estado_pagos: "CONFIRMADA", estado_contabilidad: "PENDIENTE" }));

    const r1 = await confirmaciones.aplicar("e1");
    assert.equal(r1.ok, true);
    assert.equal(pagado.mock.callCount(), 0);

    finAprobado.estado_pagos = "CONFIRMADA";
    const msgCont = armarRespuestaSimulada({
      idMensaje: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      destino: "CONTABILIDAD",
      idFiniquito: ID_FINIQUITO,
      idMensajeOrigen: ID_ENVIO_CONT,
      referencia: "AS-1",
    });
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: "e2", carga: JSON.stringify(msgCont), estado: "RECIBIDO" }));
    mock.method(modelo, "actualizarRespuestaIntegracion", async () => ({ estado_pagos: "CONFIRMADA", estado_contabilidad: "CONFIRMADA" }));

    const r2 = await confirmaciones.aplicar("e2");
    assert.equal(r2.ok, true);
    assert.equal(pagado.mock.callCount(), 1);
  });

  test("duplicado: el mismo id_mensaje se descarta y siempre registra consola como recibido", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());
    const consola = mock.method(mensajesPublicados, "registrar", () => {});
    const msg = armarRespuestaSimulada({
      idMensaje: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      destino: "PAGOS",
      idFiniquito: ID_FINIQUITO,
      idMensajeOrigen: ID_ENVIO_PAGOS,
    });
    let veces = 0;
    mock.method(modelo, "registrarMensajeEntrante", async () => {
      veces += 1;
      if (veces === 1) return { fila: { id_entrante: "e1", id_mensaje: msg.encabezado.id_mensaje, estado: "RECIBIDO" }, duplicado: false };
      return { fila: { id_entrante: "e1", id_mensaje: msg.encabezado.id_mensaje, estado: "PROCESADO" }, duplicado: true };
    });
    mock.method(modelo, "bloquearMensajeEntrante", async () => null);

    const p1 = await confirmaciones.recibirMensaje(JSON.stringify(msg));
    await p1.terminado;
    const p2 = await confirmaciones.recibirMensaje(JSON.stringify(msg));
    assert.equal(p1.duplicado, false);
    assert.equal(p2.duplicado, true);
    assert.equal(consola.mock.callCount(), 2);
    assert.ok(consola.mock.calls.every((c) => c.arguments[0].direccion === "recibido"));
  });

  test("préstamos al pagar: saldo cubierto se completa sin aviso; parcial/no incluido notifica; falla de notificación no rompe pago", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());
    mock.method(modelo, "ultimosEnviosPorDestino", async () => ({ CONTABILIDAD: { id_mensaje: ID_ENVIO_CONT } }));
    mock.method(modelo, "actualizarRespuestaIntegracion", async () => ({ estado_pagos: "CONFIRMADA", estado_contabilidad: "CONFIRMADA" }));
    mock.method(modelo, "marcarMensajeEntranteProcesado", async () => {});
    mock.method(modelo, "marcarFiniquitoPagadoYCerrarProceso", async () => {});

    const msg = armarRespuestaSimulada({
      idMensaje: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      destino: "CONTABILIDAD",
      idFiniquito: ID_FINIQUITO,
      idMensajeOrigen: ID_ENVIO_CONT,
    });
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: "e1", carga: JSON.stringify(msg), estado: "RECIBIDO" }));

    // Caso 1: saldado completo -> sin notificación
    mock.method(modelo, "bloquearFiniquitoPorId", async () => ({
      id_finiquito: ID_FINIQUITO,
      id_proceso: ID_PROCESO,
      id_empleado: ID_EMPLEADO,
      nombre_empleado: "Rodrigo Apaza",
      numero_documento: "FIN-2026-000010",
      estado: "APROBADO",
      estado_pagos: "CONFIRMADA",
      estado_contabilidad: "PENDIENTE",
      aprobado_por: ID_ADMIN,
      renglones: [{ tipo: "DESCUENTO", id_prestamo: ID_PRESTAMO_1, monto: 500, saldo_prestamo: 500 }],
    }));
    mock.method(modelo, "listarPrestamosEmpleado", async () => [
      { id_prestamo: ID_PRESTAMO_1, tipo: "ANTICIPO", saldo_pendiente: 500, estado: "ACTIVO" },
    ]);
    const saldar = mock.method(modelo, "saldarPrestamo", async () => {});
    const avisar = mock.method(notificaciones, "enviarAvisoPrioritario", async () => true);

    await confirmaciones.aplicar("e1");
    assert.equal(saldar.mock.callCount(), 1);
    assert.equal(avisar.mock.callCount(), 0);

    // Caso 2: parcial + no incluido + notificación falla -> igual queda PAGADO
    mock.method(modelo, "bloquearFiniquitoPorId", async () => ({
      id_finiquito: ID_FINIQUITO,
      id_proceso: ID_PROCESO,
      id_empleado: ID_EMPLEADO,
      nombre_empleado: "Rodrigo Apaza",
      numero_documento: "FIN-2026-000010",
      estado: "APROBADO",
      estado_pagos: "CONFIRMADA",
      estado_contabilidad: "PENDIENTE",
      aprobado_por: ID_ADMIN,
      renglones: [{ tipo: "DESCUENTO", id_prestamo: ID_PRESTAMO_1, monto: 300, saldo_prestamo: 500 }],
    }));
    mock.method(modelo, "listarPrestamosEmpleado", async () => [
      { id_prestamo: ID_PRESTAMO_1, tipo: "ANTICIPO", saldo_pendiente: 500, estado: "ACTIVO" },
      { id_prestamo: ID_PRESTAMO_2, tipo: "PRESTAMO", saldo_pendiente: 800, estado: "ACTIVO" },
    ]);
    const saldar2 = mock.method(modelo, "saldarPrestamo", async () => {});
    const avisarFail = mock.method(notificaciones, "enviarAvisoPrioritario", async () => {
      throw new Error("NotificationService caído");
    });

    const res = await confirmaciones.aplicar("e1");
    assert.equal(res.ok, true);
    assert.equal(saldar2.mock.callCount(), 0);
    assert.equal(avisarFail.mock.callCount(), 1);
    assert.equal(
      avisarFail.mock.calls[0].arguments[0].asunto,
      "Finiquito FIN-2026-000010 pagado: préstamos sin saldar de Rodrigo Apaza"
    );
  });

  test("errores: JSON inválido y finiquito inexistente van a EN_DLQ; origen inválido falla; envío viejo queda IGNORADO; rechazo deja RECHAZADA", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());

    // JSON inválido -> EN_DLQ tras 3 intentos
    let intentos = 0;
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: "bad-json", carga: "{roto", estado: "RECIBIDO" }));
    mock.method(modelo, "registrarFalloMensajeEntrante", async () => {
      intentos += 1;
      return intentos;
    });
    const dlq = mock.method(modelo, "enviarMensajeEntranteADlq", async () => {});
    const rBad = await confirmaciones.entregar("bad-json");
    assert.equal(rBad.estado, "EN_DLQ");
    assert.equal(dlq.mock.callCount(), 1);

    // Origen inválido para tipo de Pagos (D en lugar de A)
    const origenMalo = armarRespuestaSimulada({
      idMensaje: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
      destino: "PAGOS",
      idFiniquito: ID_FINIQUITO,
      idMensajeOrigen: ID_ENVIO_PAGOS,
    });
    origenMalo.encabezado.origen = { grupo: "D", modulo: "Contabilidad" };
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: "bad-orig", carga: JSON.stringify(origenMalo), estado: "RECIBIDO" }));
    const resOrig = await confirmaciones.aplicar("bad-orig");
    assert.equal(resOrig.ok, false);
    assert.match(resOrig.error, /solo lo envía el grupo A/);

    // Finiquito inexistente -> EN_DLQ
    const noExiste = armarRespuestaSimulada({
      idMensaje: "dddddddd-dddd-4ddd-8ddd-ddddddddddd2",
      destino: "PAGOS",
      idFiniquito: ID_FINIQUITO,
      idMensajeOrigen: ID_ENVIO_PAGOS,
    });
    intentos = 0;
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: "no-fin", carga: JSON.stringify(noExiste), estado: "RECIBIDO" }));
    mock.method(modelo, "bloquearFiniquitoPorId", async () => null);
    const rNoFin = await confirmaciones.entregar("no-fin");
    assert.equal(rNoFin.estado, "EN_DLQ");

    // Envío viejo -> IGNORADO
    mock.method(modelo, "bloquearFiniquitoPorId", async () => ({ id_finiquito: ID_FINIQUITO, estado: "APROBADO" }));
    mock.method(modelo, "ultimosEnviosPorDestino", async () => ({ PAGOS: { id_mensaje: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" } }));
    const ignorado = mock.method(modelo, "marcarMensajeEntranteIgnorado", async () => {});
    const rOld = await confirmaciones.aplicar("no-fin");
    assert.equal(rOld.ignorado, true);
    assert.equal(ignorado.mock.callCount(), 1);

    // Rechazo -> RECHAZADA con motivo y sin pasar a PAGADO
    const rechazo = armarRespuestaSimulada({
      idMensaje: "dddddddd-dddd-4ddd-8ddd-ddddddddddd3",
      destino: "CONTABILIDAD",
      idFiniquito: ID_FINIQUITO,
      idMensajeOrigen: ID_ENVIO_CONT,
      resultado: "RECHAZADA",
      motivo: "Cuenta inválida",
    });
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: "rech-1", carga: JSON.stringify(rechazo), estado: "RECIBIDO" }));
    mock.method(modelo, "ultimosEnviosPorDestino", async () => ({ CONTABILIDAD: { id_mensaje: ID_ENVIO_CONT } }));
    mock.method(modelo, "bloquearFiniquitoPorId", async () => ({ id_finiquito: ID_FINIQUITO, id_proceso: ID_PROCESO, estado: "APROBADO", estado_contabilidad: "PENDIENTE", estado_pagos: "CONFIRMADA" }));
    mock.method(modelo, "actualizarRespuestaIntegracion", async () => ({ estado_pagos: "CONFIRMADA", estado_contabilidad: "RECHAZADA" }));
    mock.method(modelo, "marcarMensajeEntranteProcesado", async () => {});
    const pagado = mock.method(modelo, "marcarFiniquitoPagadoYCerrarProceso", async () => {});
    const rRech = await confirmaciones.aplicar("rech-1");
    assert.equal(rRech.resultado, "RECHAZADA");
    assert.equal(pagado.mock.callCount(), 0);
  });

  test("reprocesar mensaje de la DLQ: éxito lo deja PROCESADO y fallo devuelve 422 y vuelve a EN_DLQ", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());
    mock.method(modelo, "obtenerMensajeEntrante", async () => ({ id_entrante: ID_FINIQUITO, estado: "EN_DLQ" }));
    mock.method(modelo, "reabrirMensajeEntrante", async () => true);
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: ID_FINIQUITO, carga: "{roto", estado: "RECIBIDO" }));
    mock.method(modelo, "registrarFalloMensajeEntrante", async () => 1);
    const aDlq = mock.method(modelo, "enviarMensajeEntranteADlq", async () => {});

    await assert.rejects(() => confirmaciones.reprocesarMensaje(ID_FINIQUITO, ADMIN), (e) => e.estado === 422);
    assert.equal(aDlq.mock.callCount(), 1);

    const valido = armarRespuestaSimulada({
      idMensaje: "ffffffff-ffff-4fff-8fff-fffffffffff1",
      destino: "PAGOS",
      idFiniquito: ID_FINIQUITO,
      idMensajeOrigen: ID_ENVIO_PAGOS,
    });
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: ID_FINIQUITO, carga: JSON.stringify(valido), estado: "RECIBIDO" }));
    mock.method(modelo, "bloquearFiniquitoPorId", async () => ({ id_finiquito: ID_FINIQUITO, id_proceso: ID_PROCESO, estado: "APROBADO", estado_pagos: "PENDIENTE", estado_contabilidad: "PENDIENTE" }));
    mock.method(modelo, "ultimosEnviosPorDestino", async () => ({ PAGOS: { id_mensaje: ID_ENVIO_PAGOS } }));
    mock.method(modelo, "actualizarRespuestaIntegracion", async () => ({ estado_pagos: "CONFIRMADA", estado_contabilidad: "PENDIENTE" }));
    mock.method(modelo, "marcarMensajeEntranteProcesado", async () => {});
    let llamadasObtener = 0;
    mock.method(modelo, "obtenerMensajeEntrante", async () => {
      llamadasObtener += 1;
      return { id_entrante: ID_FINIQUITO, estado: llamadasObtener === 1 ? "EN_DLQ" : "PROCESADO" };
    });

    const ok = await confirmaciones.reprocesarMensaje(ID_FINIQUITO, ADMIN);
    assert.equal(ok.estado, "PROCESADO");
  });

  test("escenarios del simulador: CONFIRMADA, RECHAZADA, DUPLICADO e INVALIDO", async () => {
    mock.method(modelo, "obtenerProcesoDetalle", async () => ({ id_proceso: ID_PROCESO }));
    mock.method(modelo, "obtenerPorProceso", async () => ({
      id_finiquito: ID_FINIQUITO,
      numero_documento: "FIN-2026-000001",
      estado: "APROBADO",
    }));
    mock.method(modelo, "ultimosEnviosPorDestino", async () => ({ PAGOS: { id_mensaje: ID_ENVIO_PAGOS } }));

    await assert.rejects(
      () => finiquitosService.simularRespuesta(ID_PROCESO, { destino: "PAGOS", escenario: "RECHAZADA" }, ADMIN),
      (e) => e.estado === 400
    );

    mock.method(modelo, "obtenerUltimaRespuestaEntrante", async () => null);
    await assert.rejects(
      () => finiquitosService.simularRespuesta(ID_PROCESO, { destino: "PAGOS", escenario: "DUPLICADO" }, ADMIN),
      (e) => e.estado === 409
    );

    const registrados = [];
    mock.method(modelo, "registrarEvento", async (_c, ev) => {
      registrados.push(ev);
      return "ev-sim";
    });
    await finiquitosService.simularRespuesta(ID_PROCESO, { destino: "PAGOS", escenario: "CONFIRMADA" }, ADMIN);
    await finiquitosService.simularRespuesta(ID_PROCESO, { destino: "PAGOS", escenario: "INVALIDO" }, ADMIN);

    const prev = armarRespuestaSimulada({
      idMensaje: "12121212-1212-4121-8121-121212121212",
      destino: "PAGOS",
      idFiniquito: ID_FINIQUITO,
      idMensajeOrigen: ID_ENVIO_PAGOS,
    });
    mock.method(modelo, "obtenerUltimaRespuestaEntrante", async () => ({ id_mensaje: prev.encabezado.id_mensaje, carga: JSON.stringify(prev) }));
    await finiquitosService.simularRespuesta(ID_PROCESO, { destino: "PAGOS", escenario: "DUPLICADO" }, ADMIN);

    assert.equal(registrados.length, 3);
    assert.ok(registrados.every((e) => e.sentido === "RESPUESTA_SIMULADA" && e.topico === "ucb-sis323-sub-f"));
    assert.equal(registrados[1].carga.datos.resultado, "DESCONOCIDO");
    assert.equal(registrados[2].idMensaje, prev.encabezado.id_mensaje);
    assert.equal(registrados[2].carga.encabezado.id_mensaje, prev.encabezado.id_mensaje);
  });
});

describe("autenticación y roles en rutas /finiquitos", () => {
  const app = express();
  app.use(express.json());
  app.use(finiquitosRoutes);
  app.use(manejadorErrores);

  let servidor;
  let base;
  before(async () => {
    servidor = app.listen(0);
    await new Promise((listo) => servidor.once("listening", listo));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });
  after(() => servidor.close());

  const firmar = (rol) => jwt.sign({ rol }, process.env.JWT_SECRET, { subject: ID_ADMIN, expiresIn: 60 });

  test("sin sesión responde 401; contador recibe 403 al generar, aprobar o simular y 200 al listar", async () => {
    const rSin = await fetch(`${base}/finiquitos`, { headers: { "X-Rol": "admin" } });
    assert.equal(rSin.status, 401);

    mock.method(modelo, "listarProcesos", async () => []);
    const tokenContador = firmar("contador");
    const rList = await fetch(`${base}/finiquitos`, { headers: { Cookie: `rrhh_sesion=${tokenContador}` } });
    assert.equal(rList.status, 200);

    for (const ruta of [
      `/finiquitos/${ID_PROCESO}/generar`,
      `/finiquitos/${ID_PROCESO}/aprobar`,
      `/finiquitos/${ID_PROCESO}/simular-respuesta`,
    ]) {
      const r = await fetch(`${base}${ruta}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenContador}` },
        body: JSON.stringify({}),
      });
      assert.equal(r.status, 403, ruta);
    }
  });
});

const { test, describe, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = "secreto-integracion-cierres-test";
process.env.CIERRE_REINTENTO_BASE_MS = "0";
process.env.CIERRE_MAXIMO_INTENTOS = "3";
process.env.REVOCACION_PLAZO_SEGUNDOS = "45";
process.env.REVOCACION_MAXIMO_REENVIOS = "3";

const pool = require("../src/config/db");
const pubsub = require("../src/config/pubsub");
const modelo = require("../src/models/cierresModel");
const mensajesPublicados = require("../src/utils/mensajesPublicados");
const notificaciones = require("../src/clients/notificacionesCliente");
const integracion = require("../src/services/integracionCierresService");
const confirmaciones = require("../src/services/confirmacionesCierreService");
const cierresService = require("../src/services/cierresService");
const { CLAVES_DESTINO, armarRespuestaSimuladaCierre } = require("../src/utils/cierres");

const ID_PROCESO = "33333333-3333-4333-8333-333333333333";
const ID_CIERRE = "55555555-5555-4555-8555-555555555555";
const ID_EMPLEADO = "11111111-1111-4111-8111-111111111111";
const ID_ADMIN = "22222222-2222-4222-8222-222222222222";
const ID_MSG_VENTAS = "66666666-6666-4666-8666-666666666661";
const ID_MSG_CRM = "66666666-6666-4666-8666-666666666664";
const ADMIN = { idEmpleado: ID_ADMIN, rol: "admin" };

function crearClienteFalso() {
  return {
    async query() {
      return { rows: [] };
    },
    release() {},
  };
}

function crearPubSubFalso(fnPublicar = async () => "pubsub-cierre-1") {
  const topicosLlamados = [];
  return {
    topicosLlamados,
    topic(nombre) {
      topicosLlamados.push(nombre);
      return { publishMessage: fnPublicar };
    },
  };
}

const eventoSalienteBase = (destino = "VENTAS", idMensaje = ID_MSG_VENTAS) => ({
  id_evento: "ev-1",
  id_mensaje: idMensaje,
  id_cierre: ID_CIERRE,
  sentido: "SALIENTE",
  destino,
  tipo_evento: "EMPLEADO_DESVINCULADO",
  topico: "ucb-sis323-sub-f",
  intentos: 0,
  carga: {
    encabezado: {
      id_mensaje: idMensaje,
      origen: { grupo: "F", modulo: "RRHH" },
      destino: { grupo: destino === "CRM" ? "B" : "E", modulo: destino === "CRM" ? "CRM" : "Marketplace y Ventas / POS" },
      tipo: "EMPLEADO_DESVINCULADO",
      fecha: "2026-11-17T10:00:00Z",
      version_esquema: 1,
    },
    datos: {
      id_cierre: ID_CIERRE,
      empleado: {
        id_empleado: ID_EMPLEADO,
        codigo_empleado: "7109001",
        nombre_completo: "Patricia Limachi Rojas",
        cargo: "Cajero",
        sucursal: "Sopocachi",
      },
      fecha_retiro: "2026-11-15",
      causal: "RENUNCIA",
      cerrado_en: "2026-11-17T10:00:00Z",
      accesos_a_revocar: ["CREDENCIALES_POS", "CAJAS_REGISTRADORAS", "ROLES_OPERATIVOS"],
    },
  },
});

afterEach(() => {
  integracion.establecerSinRespuesta("CRM", false);
  integracion.establecerSinRespuesta("VENTAS", false);
  mock.restoreAll();
});

describe("integracionCierresService (despachador en tópico F)", () => {
  test("solo publica en ucb-sis323-sub-f, pasa revocación a ENVIADA con plazo y encola respuesta simulada", async () => {
    const ps = crearPubSubFalso(async () => "pubsub-201");
    mock.method(pubsub, "obtenerCliente", () => ps);
    mock.method(modelo, "reservarEventosPendientes", async () => [eventoSalienteBase("VENTAS")]);
    const entregado = mock.method(modelo, "marcarEventoEntregado", async () => {});
    const enviada = mock.method(modelo, "marcarRevocacionEnviada", async () => {});
    const consola = mock.method(mensajesPublicados, "registrar", () => {});
    const encolados = [];
    mock.method(modelo, "registrarEvento", async (_c, ev) => {
      encolados.push(ev);
      return "ev-sim-1";
    });

    const n = await integracion.despacharCierres();
    assert.equal(n, 1);
    assert.deepEqual(ps.topicosLlamados, ["ucb-sis323-sub-f"]);
    assert.equal(entregado.mock.callCount(), 1);
    assert.equal(enviada.mock.callCount(), 1);
    assert.deepEqual(enviada.mock.calls[0].arguments, [ID_CIERRE, "VENTAS", 45]);
    assert.equal(consola.mock.calls[0].arguments[0].direccion, "publicado");
    assert.equal(encolados.length, 1);
    assert.equal(encolados[0].sentido, "RESPUESTA_SIMULADA");
    assert.equal(encolados[0].topico, "ucb-sis323-sub-f");
  });

  test("al publicar RESPUESTA_SIMULADA entrega al consumidor con el idPubSub real", async () => {
    const ps = crearPubSubFalso(async () => "pubsub-sim-99");
    mock.method(pubsub, "obtenerCliente", () => ps);
    const resp = armarRespuestaSimuladaCierre({
      idMensaje: "99999999-9999-4999-8999-999999999991",
      destino: "VENTAS",
      idCierre: ID_CIERRE,
      idMensajeOrigen: ID_MSG_VENTAS,
      codigoEmpleado: "7109001",
    });
    mock.method(modelo, "reservarEventosPendientes", async () => [
      { ...eventoSalienteBase("VENTAS"), sentido: "RESPUESTA_SIMULADA", carga: resp },
    ]);
    mock.method(modelo, "marcarEventoEntregado", async () => {});
    const recibido = mock.method(confirmaciones, "recibirMensaje", async () => ({}));

    await integracion.despacharCierres();
    assert.deepEqual(ps.topicosLlamados, ["ucb-sis323-sub-f"]);
    assert.equal(recibido.mock.callCount(), 1);
    assert.deepEqual(recibido.mock.calls[0].arguments[1], {
      topico: "ucb-sis323-sub-f",
      idPubSub: "pubsub-sim-99",
    });
  });

  test("con un destino en No responder, no encola respuesta simulada", async () => {
    integracion.establecerSinRespuesta("CRM", true);
    const ps = crearPubSubFalso(async () => "pubsub-crm-1");
    mock.method(pubsub, "obtenerCliente", () => ps);
    mock.method(modelo, "reservarEventosPendientes", async () => [eventoSalienteBase("CRM", ID_MSG_CRM)]);
    mock.method(modelo, "marcarEventoEntregado", async () => {});
    mock.method(modelo, "marcarRevocacionEnviada", async () => {});
    mock.method(mensajesPublicados, "registrar", () => {});
    const registrar = mock.method(modelo, "registrarEvento", async () => "no");

    await integracion.despacharCierres();
    assert.equal(registrar.mock.callCount(), 0);
  });
});

describe("confirmacionesCierreService (AC3, duplicados, DLQ, rechazo y AC4)", () => {
  test("AC3: las 4 confirmaciones dejan el cierre COMPLETADO", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());
    const estadoPorDestino = { VENTAS: "ENVIADA", INVENTARIOS: "ENVIADA", ENTREGAS: "ENVIADA", CRM: "ENVIADA" };
    const enviosPorDestino = {
      VENTAS: "66666666-6666-4666-8666-666666666661",
      INVENTARIOS: "66666666-6666-4666-8666-666666666662",
      ENTREGAS: "66666666-6666-4666-8666-666666666663",
      CRM: "66666666-6666-4666-8666-666666666664",
    };

    mock.method(modelo, "bloquearCierrePorId", async () => ({
      id_cierre: ID_CIERRE,
      id_proceso: ID_PROCESO,
      nombre_empleado: "Patricia Limachi",
      cerrado_por: ID_ADMIN,
    }));
    mock.method(modelo, "bloquearRevocacionesCierre", async () =>
      CLAVES_DESTINO.map((d) => ({ destino: d, estado: estadoPorDestino[d] }))
    );
    mock.method(modelo, "marcarMensajeEntranteProcesado", async () => {});
    const estadosCierre = [];
    mock.method(modelo, "actualizarEstadoCierre", async (_c, _id, estado) => estadosCierre.push(estado));
    mock.method(modelo, "actualizarRevocacionConfirmada", async (_c, _id, dest) => {
      estadoPorDestino[dest] = "CONFIRMADA";
    });

    for (const [idx, destino] of CLAVES_DESTINO.entries()) {
      const msg = armarRespuestaSimuladaCierre({
        idMensaje: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${idx + 1}`,
        destino,
        idCierre: ID_CIERRE,
        idMensajeOrigen: enviosPorDestino[destino],
        codigoEmpleado: "7109001",
      });
      mock.method(modelo, "listarEnviosSalientesDestino", async () => [{ id_mensaje: enviosPorDestino[destino] }]);
      mock.method(modelo, "bloquearMensajeEntrante", async () => ({
        id_entrante: `e-${idx + 1}`,
        carga: JSON.stringify(msg),
        estado: "RECIBIDO",
      }));
      const r = await confirmaciones.aplicar(`e-${idx + 1}`);
      assert.equal(r.ok, true);
    }

    assert.deepEqual(estadosCierre, ["EN_PROCESO", "EN_PROCESO", "EN_PROCESO", "COMPLETADO"]);
  });

  test("duplicado descartado y siempre registra en consola como recibido", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());
    const consola = mock.method(mensajesPublicados, "registrar", () => {});
    const msg = armarRespuestaSimuladaCierre({
      idMensaje: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      destino: "VENTAS",
      idCierre: ID_CIERRE,
      idMensajeOrigen: ID_MSG_VENTAS,
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

  test("inválido va a EN_DLQ tras 3 intentos y reprocesar con fallo devuelve 422", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());
    let intentos = 0;
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: ID_CIERRE, carga: "{roto", estado: "RECIBIDO" }));
    mock.method(modelo, "registrarFalloMensajeEntrante", async () => {
      intentos += 1;
      return intentos;
    });
    const dlq = mock.method(modelo, "enviarMensajeEntranteADlq", async () => {});

    const res = await confirmaciones.entregar(ID_CIERRE);
    assert.equal(res.estado, "EN_DLQ");
    assert.equal(dlq.mock.callCount(), 1);

    mock.method(modelo, "obtenerMensajeEntrante", async () => ({ id_entrante: ID_CIERRE, estado: "EN_DLQ" }));
    mock.method(modelo, "reabrirMensajeEntrante", async () => true);
    await assert.rejects(() => confirmaciones.reprocesarMensaje(ID_CIERRE, ADMIN), (e) => e.estado === 422);
  });

  test("rechazo deja RECHAZADA, CON_ALERTAS y avisa al admin; rechazo viejo queda IGNORADO; confirmación tardía sí vale", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());
    mock.method(modelo, "bloquearCierrePorId", async () => ({
      id_cierre: ID_CIERRE,
      id_proceso: ID_PROCESO,
      nombre_empleado: "Patricia Limachi",
      cerrado_por: ID_ADMIN,
    }));
    mock.method(modelo, "bloquearRevocacionesCierre", async () =>
      CLAVES_DESTINO.map((d) => ({ destino: d, estado: d === "CRM" ? "ENVIADA" : "CONFIRMADA" }))
    );

    const envioAntiguo = "66666666-6666-4666-8666-666666666600";
    const envioReciente = ID_MSG_CRM;
    mock.method(modelo, "listarEnviosSalientesDestino", async () => [
      { id_mensaje: envioReciente },
      { id_mensaje: envioAntiguo },
    ]);

    // 1) Rechazo de envío antiguo -> IGNORADO
    const rechazoViejo = armarRespuestaSimuladaCierre({
      idMensaje: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
      destino: "CRM",
      idCierre: ID_CIERRE,
      idMensajeOrigen: envioAntiguo,
      resultado: "RECHAZADA",
      motivo: "Error viejo",
    });
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: "r-viejo", carga: JSON.stringify(rechazoViejo), estado: "RECIBIDO" }));
    const ign = mock.method(modelo, "marcarMensajeEntranteIgnorado", async () => {});
    const rIgn = await confirmaciones.aplicar("r-viejo");
    assert.equal(rIgn.ignorado, true);
    assert.equal(ign.mock.callCount(), 1);

    // 2) Rechazo del último envío -> RECHAZADA, CON_ALERTAS y aviso al admin
    const rechazoActual = armarRespuestaSimuladaCierre({
      idMensaje: "dddddddd-dddd-4ddd-8ddd-ddddddddddd2",
      destino: "CRM",
      idCierre: ID_CIERRE,
      idMensajeOrigen: envioReciente,
      resultado: "RECHAZADA",
      motivo: "Sesión de operador activa",
    });
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: "r-act", carga: JSON.stringify(rechazoActual), estado: "RECIBIDO" }));
    mock.method(modelo, "actualizarRevocacionRechazada", async () => {});
    mock.method(modelo, "marcarMensajeEntranteProcesado", async () => {});
    const estadosCierre = [];
    mock.method(modelo, "actualizarEstadoCierre", async (_c, _id, e) => estadosCierre.push(e));
    const avisar = mock.method(notificaciones, "enviarAvisoPrioritario", async () => true);

    const rRech = await confirmaciones.aplicar("r-act");
    assert.equal(rRech.resultado, "RECHAZADA");
    assert.deepEqual(estadosCierre, ["CON_ALERTAS"]);
    assert.equal(avisar.mock.callCount(), 1);

    // 3) Confirmación tardía de un envío viejo -> SÍ vale y deja COMPLETADO
    const confTardia = armarRespuestaSimuladaCierre({
      idMensaje: "dddddddd-dddd-4ddd-8ddd-ddddddddddd3",
      destino: "CRM",
      idCierre: ID_CIERRE,
      idMensajeOrigen: envioAntiguo,
      resultado: "CONFIRMADA",
      codigoEmpleado: "7109001",
    });
    mock.method(modelo, "bloquearRevocacionesCierre", async () =>
      CLAVES_DESTINO.map((d) => ({ destino: d, estado: d === "CRM" ? "RECHAZADA" : "CONFIRMADA" }))
    );
    mock.method(modelo, "bloquearMensajeEntrante", async () => ({ id_entrante: "c-tardia", carga: JSON.stringify(confTardia), estado: "RECIBIDO" }));
    mock.method(modelo, "actualizarRevocacionConfirmada", async () => {});
    const rTardia = await confirmaciones.aplicar("c-tardia");
    assert.equal(rTardia.resultado, "CONFIRMADA");
    assert.equal(estadosCierre[1], "COMPLETADO");
  });

  test("AC4: vencimiento de plazo reenvía con un aviso y al agotar reenvíos marca VENCIDA y CON_ALERTAS con aviso final", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());
    mock.method(modelo, "ultimosEnviosPorDestino", async () => ({
      CRM: eventoSalienteBase("CRM", ID_MSG_CRM),
    }));

    // Paso 1: reenvíos < 3 -> reenvía y manda 1 aviso
    mock.method(modelo, "reservarRevocacionesVencidas", async () => [
      {
        id_revocacion: "rev-crm",
        id_cierre: ID_CIERRE,
        destino: "CRM",
        estado: "ENVIADA",
        reenvios_por_plazo: 0,
        id_proceso: ID_PROCESO,
        id_empleado: ID_EMPLEADO,
        cerrado_por: ID_ADMIN,
        cerrado_en: "2026-11-17T10:00:00Z",
        nombre_empleado: "Patricia Limachi Rojas",
        fecha_retiro: "2026-11-15",
        codigo_causal: "RENUNCIA",
      },
    ]);
    const reenvioPlazo = mock.method(modelo, "marcarRevocacionReenvioPorPlazo", async () => {});
    const eventos = [];
    mock.method(modelo, "registrarEvento", async (_c, ev) => {
      eventos.push(ev);
      return "ev-reenvio";
    });
    const avisos = [];
    mock.method(notificaciones, "enviarAvisoPrioritario", async (a) => {
      avisos.push(a);
      return true;
    });

    const n1 = await confirmaciones.revisarPlazosVencidos();
    assert.equal(n1, 1);
    assert.equal(reenvioPlazo.mock.callCount(), 1);
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].sentido, "SALIENTE");
    assert.equal(avisos.length, 1);
    assert.match(avisos[0].contenido, /reenvío 1 de 3/i);

    // Paso 2: reenvíos == 3 (agotados) -> VENCIDA + CON_ALERTAS + 1 aviso final
    mock.method(modelo, "reservarRevocacionesVencidas", async () => [
      {
        id_revocacion: "rev-crm",
        id_cierre: ID_CIERRE,
        destino: "CRM",
        estado: "ENVIADA",
        reenvios_por_plazo: 3,
        id_proceso: ID_PROCESO,
        id_empleado: ID_EMPLEADO,
        cerrado_por: ID_ADMIN,
        cerrado_en: "2026-11-17T10:00:00Z",
        nombre_empleado: "Patricia Limachi Rojas",
        fecha_retiro: "2026-11-15",
        codigo_causal: "RENUNCIA",
      },
    ]);
    const vencidaMock = mock.method(modelo, "marcarRevocacionVencida", async () => {});
    mock.method(modelo, "bloquearRevocacionesCierre", async () =>
      CLAVES_DESTINO.map((d) => ({ destino: d, estado: d === "CRM" ? "ENVIADA" : "CONFIRMADA" }))
    );
    const estadosCierre = [];
    mock.method(modelo, "actualizarEstadoCierre", async (_c, _id, e) => estadosCierre.push(e));

    const n2 = await confirmaciones.revisarPlazosVencidos();
    assert.equal(n2, 1);
    assert.equal(vencidaMock.mock.callCount(), 1);
    assert.deepEqual(estadosCierre, ["CON_ALERTAS"]);
    assert.equal(avisos.length, 2);
    assert.match(avisos[1].contenido, /tras 3 reenvíos/i);
  });

  test("Reenviar solo se permite en RECHAZADA, VENCIDA o FALLIDO", async () => {
    mock.method(pool, "connect", async () => crearClienteFalso());
    mock.method(modelo, "obtenerProcesoParaCierre", async () => ({
      id_proceso: ID_PROCESO,
      id_empleado: ID_EMPLEADO,
      nombre_empleado: "Patricia Limachi",
      fecha_retiro: "2026-11-15",
      codigo_causal: "RENUNCIA",
    }));
    mock.method(modelo, "obtenerCierrePorProceso", async () => ({
      id_cierre: ID_CIERRE,
      cerrado_en: "2026-11-17T10:00:00Z",
    }));
    mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ numero_documento: "7109001", nombre_completo: "Patricia Limachi" }), { status: 200 })
    );
    mock.method(modelo, "bloquearRevocacionesCierre", async () => [{ destino: "CRM", estado: "ENVIADA" }]);
    mock.method(modelo, "ultimosEnviosPorDestino", async () => ({ CRM: { estado: "ENTREGADO" } }));

    await assert.rejects(
      () => cierresService.reenviar(ID_PROCESO, { destino: "CRM" }, ADMIN),
      (e) => e.estado === 409 && e.codigo === "REENVIO_NO_PERMITIDO"
    );
  });

  test("escenarios del simulador de cierres: CONFIRMADA, RECHAZADA, DUPLICADO e INVALIDO", async () => {
    mock.method(modelo, "obtenerProcesoParaCierre", async () => ({ id_proceso: ID_PROCESO }));
    mock.method(modelo, "obtenerCierrePorProceso", async () => ({ id_cierre: ID_CIERRE }));
    mock.method(modelo, "ultimosEnviosPorDestino", async () => ({
      CRM: eventoSalienteBase("CRM", ID_MSG_CRM),
    }));

    await assert.rejects(
      () => cierresService.simularRespuesta(ID_PROCESO, { destino: "CRM", escenario: "RECHAZADA" }, ADMIN),
      (e) => e.estado === 400
    );

    mock.method(modelo, "obtenerUltimaRespuestaEntrante", async () => null);
    await assert.rejects(
      () => cierresService.simularRespuesta(ID_PROCESO, { destino: "CRM", escenario: "DUPLICADO" }, ADMIN),
      (e) => e.estado === 409
    );

    const registrados = [];
    mock.method(modelo, "registrarEvento", async (_c, ev) => {
      registrados.push(ev);
      return "ev-sim";
    });
    await cierresService.simularRespuesta(ID_PROCESO, { destino: "CRM", escenario: "CONFIRMADA" }, ADMIN);
    await cierresService.simularRespuesta(ID_PROCESO, { destino: "CRM", escenario: "INVALIDO" }, ADMIN);

    const prev = armarRespuestaSimuladaCierre({
      idMensaje: "12121212-1212-4121-8121-121212121212",
      destino: "CRM",
      idCierre: ID_CIERRE,
      idMensajeOrigen: ID_MSG_CRM,
    });
    mock.method(modelo, "obtenerUltimaRespuestaEntrante", async () => ({
      id_mensaje: prev.encabezado.id_mensaje,
      carga: JSON.stringify(prev),
    }));
    await cierresService.simularRespuesta(ID_PROCESO, { destino: "CRM", escenario: "DUPLICADO" }, ADMIN);

    assert.equal(registrados.length, 3);
    assert.ok(registrados.every((e) => e.sentido === "RESPUESTA_SIMULADA" && e.topico === "ucb-sis323-sub-f"));
    assert.equal(registrados[1].carga.datos.resultado, "DESCONOCIDO");
    assert.equal(registrados[2].idMensaje, prev.encabezado.id_mensaje);
  });
});

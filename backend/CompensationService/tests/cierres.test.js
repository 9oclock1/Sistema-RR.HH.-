const { test, describe, before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "secreto-cierres-test";

const pool = require("../src/config/db");
const modelo = require("../src/models/cierresModel");
const empleadosCliente = require("../src/clients/empleados.cliente");
const authCliente = require("../src/clients/authCliente");
const servicio = require("../src/services/cierresService");
const cierresRoutes = require("../src/routes/cierresRoutes");
const manejadorErrores = require("../src/middlewares/manejadorErrores");
const { ErrorApp } = require("../src/utils/errores");
const {
  DESTINOS_CIERRE,
  validarFiltroEstadoCierre,
  validarDestinoCierre,
  validarSimulacionEscenarioCierre,
  validarSinRespuesta,
  resumirEstadoCierre,
  evaluarRequisitosCierre,
  armarMensajeDesvinculado,
  construirRecursosRevocados,
  armarRespuestaSimuladaCierre,
  identificarMensajeCierre,
  leerConfirmacionCierre,
} = require("../src/utils/cierres");

const ID_PROCESO = "33333333-3333-4333-8333-333333333333";
const ID_FINIQUITO = "44444444-4444-4444-8444-444444444444";
const ID_CIERRE = "55555555-5555-4555-8555-555555555555";
const ID_EMPLEADO = "11111111-1111-4111-8111-111111111111";
const ID_ADMIN = "22222222-2222-4222-8222-222222222222";
const ADMIN = { idEmpleado: ID_ADMIN, rol: "admin" };

const PROCESO_ABIERTO = {
  id_proceso: ID_PROCESO,
  id_empleado: ID_EMPLEADO,
  nombre_empleado: "Patricia Limachi Rojas",
  fecha_ingreso: "2022-04-01",
  fecha_retiro: "2026-11-15",
  codigo_causal: "RENUNCIA",
  causal_nombre: "Renuncia voluntaria",
  corresponde_desahucio: false,
  estado: "EN_CURSO",
  observaciones: null,
};

const FINIQUITO_APROBADO = {
  id_finiquito: ID_FINIQUITO,
  id_proceso: ID_PROCESO,
  numero_documento: "FIN-2026-000901",
  estado: "APROBADO",
  liquido_pagable: 12500.5,
  aprobado_en: "2026-11-16T10:00:00Z",
  pagado_en: null,
};

const FICHA_EMPLEADO = {
  id_empleado: ID_EMPLEADO,
  numero_documento: "7109001",
  nombre_completo: "Patricia Limachi Rojas",
  asignacion_actual: {
    cargo: { nombre: "Cajero" },
    sucursal: { nombre: "Sopocachi" },
  },
};

function crearClienteFalso() {
  const comandos = [];
  return {
    comandos,
    async query(sql) {
      comandos.push(String(sql).trim());
      return { rows: [] };
    },
    release() {},
  };
}

afterEach(() => mock.restoreAll());

describe("utils/cierres (funciones puras)", () => {
  test("validaciones puras de filtros, destinos y simulación", () => {
    assert.equal(validarFiltroEstadoCierre(""), null);
    assert.equal(validarFiltroEstadoCierre("en_proceso"), "EN_PROCESO");
    assert.throws(() => validarFiltroEstadoCierre("INVALIDO"), (e) => e.estado === 400);

    assert.equal(validarDestinoCierre("ventas"), "VENTAS");
    assert.throws(() => validarDestinoCierre("PAGOS"), (e) => e.estado === 400);

    assert.throws(() => validarSimulacionEscenarioCierre({ destino: "CRM", escenario: "RECHAZADA" }), (e) => e.estado === 400);
    const sim = validarSimulacionEscenarioCierre({ destino: "crm", escenario: "rechazada", motivo: "Terminal activa" });
    assert.deepEqual(sim, { destino: "CRM", escenario: "RECHAZADA", referencia: null, motivo: "Terminal activa" });

    assert.throws(() => validarSinRespuesta({ destino: "CRM", activo: "si" }), (e) => e.estado === 400);
    assert.deepEqual(validarSinRespuesta({ destino: "crm", activo: true }), { destino: "CRM", activo: true });
  });

  test("resumirEstadoCierre y evaluarRequisitosCierre", () => {
    assert.equal(
      resumirEstadoCierre([
        { estado: "CONFIRMADA" },
        { estado: "CONFIRMADA" },
        { estado: "CONFIRMADA" },
        { estado: "CONFIRMADA" },
      ]),
      "COMPLETADO"
    );
    assert.equal(resumirEstadoCierre([{ estado: "CONFIRMADA" }, { estado: "RECHAZADA" }]), "CON_ALERTAS");
    assert.equal(resumirEstadoCierre([{ estado: "CONFIRMADA" }, { estado: "VENCIDA" }]), "CON_ALERTAS");
    assert.equal(resumirEstadoCierre([{ estado: "CONFIRMADA" }, { estado: "ENVIADA" }]), "EN_PROCESO");

    assert.equal(evaluarRequisitosCierre({ proceso: PROCESO_ABIERTO, finiquito: FINIQUITO_APROBADO, cierre: null }).puede_cerrar, true);
    assert.equal(evaluarRequisitosCierre({ proceso: PROCESO_ABIERTO, finiquito: { estado: "BORRADOR" }, cierre: null }).codigo, "FINIQUITO_NO_APROBADO");
    assert.equal(evaluarRequisitosCierre({ proceso: PROCESO_ABIERTO, finiquito: FINIQUITO_APROBADO, cierre: { id_cierre: ID_CIERRE } }).codigo, "PROCESO_YA_CERRADO");
  });

  test("armarMensajeDesvinculado, construirRecursosRevocados, armarRespuestaSimuladaCierre y lectura", () => {
    const envio = armarMensajeDesvinculado({
      idMensaje: "66666666-6666-4666-8666-666666666661",
      destino: "VENTAS",
      idCierre: ID_CIERRE,
      empleado: {
        id_empleado: ID_EMPLEADO,
        codigo_empleado: "7109001",
        nombre_completo: "Patricia Limachi Rojas",
        cargo: "Cajero",
        sucursal: "Sopocachi",
      },
      fechaRetiro: "2026-11-15",
      causal: "RENUNCIA",
      cerradoEn: "2026-11-17T10:00:00Z",
    });

    assert.equal(envio.encabezado.origen.grupo, "F");
    assert.equal(envio.encabezado.destino.grupo, "E");
    assert.equal(envio.encabezado.tipo, "EMPLEADO_DESVINCULADO");
    assert.equal(envio.datos.empleado.codigo_empleado, "7109001");
    assert.deepEqual(envio.datos.accesos_a_revocar, DESTINOS_CIERRE.VENTAS.accesos);
    assert.equal("liquido_pagable" in envio.datos, false);
    assert.equal("finiquito" in envio.datos, false);

    const recursos = construirRecursosRevocados(DESTINOS_CIERRE.VENTAS.accesos, "7109001");
    assert.deepEqual(recursos, [
      { tipo: "CREDENCIALES_POS", identificador: "pos.7109001" },
      { tipo: "CAJAS_REGISTRADORAS", identificador: "CAJA-03" },
      { tipo: "ROLES_OPERATIVOS", identificador: "rol.7109001" },
    ]);

    const resp = armarRespuestaSimuladaCierre({
      idMensaje: "77777777-7777-4777-8777-777777777771",
      destino: "VENTAS",
      idCierre: ID_CIERRE,
      idMensajeOrigen: envio.encabezado.id_mensaje,
      codigoEmpleado: "7109001",
    });
    assert.equal(resp.encabezado.origen.grupo, "E");
    assert.equal(resp.encabezado.destino.grupo, "F");
    assert.equal(resp.datos.referencia, `REV-E-${ID_CIERRE.slice(0, 6).toUpperCase()}`);

    const texto = JSON.stringify(resp);
    const info = identificarMensajeCierre(texto);
    assert.equal(info.destino, "VENTAS");
    assert.equal(info.idCierre, ID_CIERRE);

    const leido = leerConfirmacionCierre(texto);
    assert.equal(leido.errores, undefined);
    assert.equal(leido.confirmacion.resultado, "CONFIRMADA");
    assert.equal(leido.confirmacion.recursosRevocados.length, 3);
  });
});

describe("cierresService.cerrar (AC1 y AC2)", () => {
  test("rechaza con 409 si no hay finiquito, si está en borrador o si el proceso ya fue cerrado", async () => {
    mock.method(modelo, "obtenerProcesoParaCierre", async () => PROCESO_ABIERTO);
    mock.method(modelo, "obtenerCierrePorProceso", async () => null);
    mock.method(modelo, "obtenerFiniquitoDeProceso", async () => null);
    await assert.rejects(() => servicio.cerrar(ID_PROCESO, ADMIN), (e) => e.estado === 409 && e.codigo === "FINIQUITO_NO_APROBADO");

    mock.method(modelo, "obtenerFiniquitoDeProceso", async () => ({ ...FINIQUITO_APROBADO, estado: "BORRADOR" }));
    await assert.rejects(() => servicio.cerrar(ID_PROCESO, ADMIN), (e) => e.estado === 409 && e.codigo === "FINIQUITO_NO_APROBADO");

    mock.method(modelo, "obtenerFiniquitoDeProceso", async () => FINIQUITO_APROBADO);
    mock.method(modelo, "obtenerCierrePorProceso", async () => ({ id_cierre: ID_CIERRE }));
    await assert.rejects(() => servicio.cerrar(ID_PROCESO, ADMIN), (e) => e.estado === 409 && e.codigo === "PROCESO_YA_CERRADO");
  });

  test("AC1: si darDeBaja o revocarAcceso fallan con 503, hace ROLLBACK y no cierra ni encola nada", async () => {
    const clienteFalso = crearClienteFalso();
    mock.method(pool, "connect", async () => clienteFalso);
    mock.method(modelo, "obtenerProcesoParaCierre", async () => PROCESO_ABIERTO);
    mock.method(modelo, "obtenerFiniquitoDeProceso", async () => FINIQUITO_APROBADO);
    mock.method(modelo, "obtenerCierrePorProceso", async () => null);
    mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(FICHA_EMPLEADO), { status: 200 }));

    const crearCierreMock = mock.method(modelo, "crearCierre", async () => ({ id_cierre: ID_CIERRE, cerrado_en: "2026-11-17T10:00:00Z" }));
    const registrarEvMock = mock.method(modelo, "registrarEvento", async () => "ev-1");

    // Falla darDeBaja
    mock.method(empleadosCliente, "darDeBaja", async () => {
      throw new ErrorApp(503, "EmployeeService caído");
    });
    const revocarMock = mock.method(authCliente, "revocarAcceso", async () => ({ cuenta_estado: "REVOCADA" }));

    await assert.rejects(() => servicio.cerrar(ID_PROCESO, ADMIN), (e) => e.estado === 503);
    assert.ok(clienteFalso.comandos.includes("ROLLBACK"));
    assert.ok(!clienteFalso.comandos.includes("COMMIT"));
    assert.equal(revocarMock.mock.callCount(), 0);
    assert.equal(crearCierreMock.mock.callCount(), 0);
    assert.equal(registrarEvMock.mock.callCount(), 0);

    // Ahora darDeBaja funciona pero revocarAcceso falla
    clienteFalso.comandos.length = 0;
    mock.method(empleadosCliente, "darDeBaja", async () => ({ id_empleado: ID_EMPLEADO }));
    mock.method(authCliente, "revocarAcceso", async () => {
      throw new ErrorApp(503, "AuthService caído");
    });

    await assert.rejects(() => servicio.cerrar(ID_PROCESO, ADMIN), (e) => e.estado === 503);
    assert.ok(clienteFalso.comandos.includes("ROLLBACK"));
    assert.ok(!clienteFalso.comandos.includes("COMMIT"));
    assert.equal(crearCierreMock.mock.callCount(), 0);
    assert.equal(registrarEvMock.mock.callCount(), 0);
  });

  test("AC1 y AC2: llama darDeBaja y revocarAcceso en orden, cierra el proceso y encola 4 SALIENTE en tópico F sin datos salariales", async () => {
    const clienteFalso = crearClienteFalso();
    const ordenLlamadas = [];
    mock.method(pool, "connect", async () => clienteFalso);

    let cerrado = false;
    mock.method(modelo, "obtenerProcesoParaCierre", async () => ({
      ...PROCESO_ABIERTO,
      estado: cerrado ? "CERRADO" : "EN_CURSO",
    }));
    mock.method(modelo, "obtenerFiniquitoDeProceso", async () => FINIQUITO_APROBADO);
    mock.method(modelo, "obtenerCierrePorProceso", async () =>
      cerrado ? { id_cierre: ID_CIERRE, estado_revocaciones: "EN_PROCESO", cerrado_en: "2026-11-17T10:00:00Z" } : null
    );
    mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(FICHA_EMPLEADO), { status: 200 }));

    mock.method(empleadosCliente, "darDeBaja", async () => {
      ordenLlamadas.push("darDeBaja");
      return { id_empleado: ID_EMPLEADO };
    });
    mock.method(authCliente, "revocarAcceso", async () => {
      ordenLlamadas.push("revocarAcceso");
      return { cuenta_estado: "REVOCADA", revocado_en: "2026-11-17T10:00:00Z" };
    });
    mock.method(modelo, "crearCierre", async () => {
      cerrado = true;
      return { id_cierre: ID_CIERRE, cerrado_en: "2026-11-17T10:00:00Z" };
    });
    mock.method(modelo, "crearRevocacionesIniciales", async () => {});
    const eventosEncolados = [];
    mock.method(modelo, "registrarEvento", async (_c, ev) => {
      eventosEncolados.push(ev);
      return `ev-${eventosEncolados.length}`;
    });
    mock.method(modelo, "cerrarProcesoDesvinculacion", async () => {});

    // Para obtener() final:
    mock.method(empleadosCliente, "obtenerEmpleado", async () => ({ id_empleado: ID_EMPLEADO, activo: false }));
    mock.method(authCliente, "consultarAcceso", async () => ({ tiene_cuenta: true, esta_activo: false, revocado_en: "2026-11-17T10:00:00Z" }));
    mock.method(modelo, "listarRevocacionesCierre", async () => []);
    mock.method(modelo, "ultimosEnviosPorDestino", async () => ({}));

    const detalle = await servicio.cerrar(ID_PROCESO, ADMIN);

    assert.deepEqual(ordenLlamadas, ["darDeBaja", "revocarAcceso"]);
    assert.ok(clienteFalso.comandos.includes("COMMIT"));
    assert.equal(eventosEncolados.length, 4);
    assert.deepEqual(
      eventosEncolados.map((e) => e.destino),
      ["VENTAS", "INVENTARIOS", "ENTREGAS", "CRM"]
    );
    for (const ev of eventosEncolados) {
      assert.equal(ev.sentido, "SALIENTE");
      assert.equal(ev.topico, "ucb-sis323-sub-f");
      assert.equal(ev.tipoEvento, "EMPLEADO_DESVINCULADO");
      assert.equal(ev.carga.encabezado.origen.grupo, "F");
      assert.equal(ev.carga.encabezado.tipo, "EMPLEADO_DESVINCULADO");
      assert.equal(ev.carga.datos.empleado.codigo_empleado, "7109001");
      const textoCarga = JSON.stringify(ev.carga);
      assert.equal(textoCarga.includes("liquido_pagable"), false);
      assert.equal(textoCarga.includes("promedio"), false);
      assert.equal(textoCarga.includes("FIN-2026"), false);
    }
    assert.equal(detalle.proceso.estado, "CERRADO");
  });
});

describe("autenticación y roles en rutas /cierres", () => {
  const app = express();
  app.use(express.json());
  app.use(cierresRoutes);
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

  test("sin sesión responde 401; contador recibe 403 al cerrar/reenviar/simular y 200 al consultar", async () => {
    const rSin = await fetch(`${base}/cierres`, { headers: { "X-Rol": "admin" } });
    assert.equal(rSin.status, 401);

    mock.method(modelo, "listarProcesosParaCierre", async () => []);
    mock.method(modelo, "obtenerProcesoParaCierre", async () => PROCESO_ABIERTO);
    mock.method(modelo, "obtenerFiniquitoDeProceso", async () => FINIQUITO_APROBADO);
    mock.method(modelo, "obtenerCierrePorProceso", async () => null);
    mock.method(empleadosCliente, "obtenerEmpleado", async () => ({ id_empleado: ID_EMPLEADO, activo: true }));
    mock.method(authCliente, "consultarAcceso", async () => ({ tiene_cuenta: true, esta_activo: true, revocado_en: null }));

    const tokenContador = firmar("contador");
    const rList = await fetch(`${base}/cierres`, { headers: { Cookie: `rrhh_sesion=${tokenContador}` } });
    assert.equal(rList.status, 200);

    const rDet = await fetch(`${base}/cierres/${ID_PROCESO}`, { headers: { Authorization: `Bearer ${tokenContador}` } });
    assert.equal(rDet.status, 200);

    for (const ruta of [
      `/cierres/${ID_PROCESO}/cerrar`,
      `/cierres/${ID_PROCESO}/reenviar`,
      `/cierres/${ID_PROCESO}/simular-respuesta`,
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

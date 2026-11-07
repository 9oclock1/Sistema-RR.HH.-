const { describe, it, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const express = require("express");

process.env.NOTIFICATION_SERVICE_URL = "http://notificaciones.prueba";
process.env.QUEJAS_CLAVE_CIFRADO = randomBytes(32).toString("hex");

const fetchReal = globalThis.fetch;
const clienteFalso = { query: async () => ({ rows: [] }) };
const rutaTransaccion = require.resolve(path.join(__dirname, "../config/transaccion"));
require.cache[rutaTransaccion] = {
  id: rutaTransaccion,
  filename: rutaTransaccion,
  loaded: true,
  exports: { enTransaccion: async (trabajo) => trabajo(clienteFalso) },
};

const modelo = require("../models/seguimientoQuejaModel");
const casosModelo = require("../models/casosQuejaModel");
const servicio = require("../services/seguimientoQuejaService");
const quejasRoutes = require("../routes/quejasRoutes");
const manejadorErrores = require("../middlewares/manejadorErrores");
const { descifrarTexto } = require("../utils/cifrado");
const { ErrorApp } = require("../utils/errores");
const { esTransicionValida, validarCambioEstado, validarAccion } = require("../utils/seguimientoQueja");

const id = (n) => `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const QUEJA = id(1);
const ADMIN = id(10);
const RESPONSABLE = id(11);
const OTRO = id(12);
const DENUNCIANTE = id(13);
const CODIGO = "QJ-7K3M-9XQ2";
const FECHA = new Date("2026-11-07T16:00:00.000Z");

const ESTADOS = [
  { id_estado_queja: 1, codigo: "REGISTRADA", nombre: "Registrada", es_final: false },
  { id_estado_queja: 2, codigo: "ASIGNADA", nombre: "Asignada", es_final: false },
  { id_estado_queja: 3, codigo: "EN_ANALISIS", nombre: "En análisis", es_final: false },
  { id_estado_queja: 4, codigo: "EN_ACCION", nombre: "En acción", es_final: false },
  { id_estado_queja: 5, codigo: "RESUELTA", nombre: "Resuelta", es_final: true },
  { id_estado_queja: 6, codigo: "DESESTIMADA", nombre: "Desestimada", es_final: true },
];
const TIPOS = [
  { id_tipo_accion_queja: 1, codigo: "PREVENTIVA", nombre: "Preventiva" },
  { id_tipo_accion_queja: 2, codigo: "CORRECTIVA", nombre: "Correctiva" },
];
const ID = { ASIGNADA: 2, EN_ANALISIS: 3, EN_ACCION: 4, RESUELTA: 5, DESESTIMADA: 6 };
const RESOLUCION = "Se capacitó al encargado y se reorganizaron los turnos de cajas.";
const ACCION = "Reunión con el encargado de cajas para acordar un trato respetuoso.";

const respuestaJson = (estado, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });

describe("RF-70: acciones y avance del caso de queja (base simulada)", () => {
  let llamadas;
  let queja;
  let logs;

  const simular = ({ aviso = () => respuestaJson(201, { mensaje: "ok" }), vigente = RESPONSABLE } = {}) => {
    llamadas = { avisos: [], acciones: [], cambios: [], transiciones: [], registrosAviso: [], actualizadas: [] };
    mock.method(globalThis, "fetch", async (url, opciones = {}) => {
      llamadas.avisos.push({ url: String(url), cabeceras: opciones.headers, cuerpo: JSON.parse(opciones.body) });
      return aviso();
    });
    mock.method(casosModelo, "listarEstados", async () => ESTADOS);
    mock.method(casosModelo, "bloquearQueja", async () => ({ ...queja }));
    mock.method(casosModelo, "obtenerResponsableVigente", async () => vigente);
    mock.method(casosModelo, "actualizarQueja", async (db, datos) => {
      llamadas.actualizadas.push(datos);
      return { actualizado_en: FECHA };
    });
    mock.method(modelo, "listarTiposAccion", async () => TIPOS);
    mock.method(modelo, "insertarAccion", async (db, datos) => {
      llamadas.acciones.push(datos);
      const tipo = TIPOS.find((t) => t.id_tipo_accion_queja === datos.idTipo);
      return { id_accion: id(50), creado_en: FECHA, tipo_codigo: tipo.codigo, tipo_nombre: tipo.nombre, nombres: "Rosa", apellidos: "Rojas" };
    });
    mock.method(modelo, "cambiarEstado", async (db, datos) => {
      llamadas.cambios.push(datos);
      return { actualizado_en: FECHA };
    });
    mock.method(modelo, "insertarTransicion", async (db, datos) => {
      llamadas.transiciones.push(datos);
      return { fecha_cambio: FECHA };
    });
    mock.method(modelo, "obtenerDatosAvisoResolucion", async () => ({
      codigo_seguimiento: CODIGO,
      es_anonima: !queja.id_empleado_denunciante,
      id_empleado_denunciante: queja.id_empleado_denunciante,
      id_estado_aviso_resolucion: queja.id_estado_aviso_resolucion ?? null,
    }));
    mock.method(modelo, "registrarAvisoResolucion", async (idQueja, idEstado) => {
      llamadas.registrosAviso.push(idEstado);
      return { aviso_resolucion_en: idEstado === 2 ? FECHA : null };
    });
  };

  const enEstado = (codigo, extra = {}) => {
    queja = {
      id_queja: QUEJA,
      id_empleado_denunciante: DENUNCIANTE,
      id_estado_queja: ID[codigo],
      es_final: ["RESUELTA", "DESESTIMADA"].includes(codigo),
      ...extra,
    };
  };

  const rechaza = (promesa, estado, patron) =>
    assert.rejects(promesa, (error) => {
      assert.ok(error instanceof ErrorApp, error.message);
      assert.equal(error.estado, estado);
      if (patron) assert.match(error.message, patron);
      return true;
    });

  beforeEach(() => {
    logs = [];
    mock.method(console, "error", (...partes) => logs.push(partes.join(" ")));
    mock.method(console, "log", (...partes) => logs.push(partes.join(" ")));
    enEstado("ASIGNADA");
    simular();
  });

  afterEach(() => mock.restoreAll());

  describe("transiciones de estado definidas en el backend", () => {
    it("acepta solo derivada → en análisis → en acción → resuelta, con retroceso de en acción a en análisis", () => {
      const validas = [
        ["ASIGNADA", "EN_ANALISIS"],
        ["EN_ANALISIS", "EN_ACCION"],
        ["EN_ACCION", "EN_ANALISIS"],
        ["EN_ACCION", "RESUELTA"],
      ];
      for (const desde of Object.keys(ID)) {
        for (const hacia of Object.keys(ID)) {
          const esperada = validas.some(([a, b]) => a === desde && b === hacia);
          assert.equal(esTransicionValida(ID[desde], ID[hacia]), esperada, `${desde} → ${hacia}`);
        }
      }
    });

    it("«resuelta» exige una descripción de la resolución no vacía", () => {
      const ids = new Set(ESTADOS.map((e) => e.id_estado_queja));
      for (const resolucion of [undefined, "", "   ", "corta"]) {
        assert.throws(
          () => validarCambioEstado({ id_estado_queja: ID.RESUELTA, resolucion }, ids),
          (error) => error.estado === 400 && error.detalles[0].campo === "resolucion",
        );
      }
      assert.deepEqual(validarCambioEstado({ id_estado_queja: "5", resolucion: `  ${RESOLUCION}  ` }, ids), {
        idEstado: ID.RESUELTA,
        resolucion: RESOLUCION,
      });
      assert.deepEqual(validarCambioEstado({ id_estado_queja: 3, resolucion: "ignorada" }, ids), {
        idEstado: ID.EN_ANALISIS,
        resolucion: null,
      });
    });

    it("la acción exige tipo preventiva o correctiva y una descripción", () => {
      const tipos = new Set([1, 2]);
      assert.throws(
        () => validarAccion({ id_tipo_accion_queja: 9, descripcion: "" }, tipos),
        (error) => error.estado === 400 && error.detalles.map((d) => d.campo).join() === "id_tipo_accion_queja,descripcion",
      );
      assert.deepEqual(validarAccion({ id_tipo_accion_queja: "2", descripcion: ` ${ACCION} ` }, tipos), {
        idTipo: 2,
        descripcion: ACCION,
      });
    });
  });

  describe("criterio 1: bitácora de acciones", () => {
    it("el responsable asignado registra una acción con fecha y autor puestos por el backend y la descripción cifrada", async () => {
      enEstado("EN_ANALISIS");
      const resultado = await servicio.registrarAccion({
        idQueja: QUEJA,
        cuerpo: { id_tipo_accion_queja: 1, descripcion: ACCION, id_empleado_registrador: OTRO, creado_en: "2020-01-01" },
        idEmpleado: RESPONSABLE,
      });
      const [insertada] = llamadas.acciones;
      assert.equal(insertada.idEmpleado, RESPONSABLE);
      assert.equal(insertada.idTipo, 1);
      assert.ok(Buffer.isBuffer(insertada.descripcion));
      assert.ok(!insertada.descripcion.toString("utf8").includes(ACCION));
      assert.equal(descifrarTexto(insertada.descripcion), ACCION);
      assert.deepEqual(Object.keys(insertada).sort(), ["descripcion", "idEmpleado", "idQueja", "idTipo"]);
      assert.deepEqual(resultado.registrada_por, { id_empleado: RESPONSABLE, nombre_completo: "Rosa Rojas" });
      assert.equal(resultado.registrada_en, FECHA);
      assert.deepEqual(resultado.tipo, { codigo: "PREVENTIVA", nombre: "Preventiva" });
      assert.equal(llamadas.actualizadas.length, 1);
    });

    it("rechaza con 403 a quien no es el responsable, aunque sea el Administrador de RRHH", async () => {
      for (const idEmpleado of [OTRO, ADMIN, undefined]) {
        await rechaza(
          servicio.registrarAccion({ idQueja: QUEJA, cuerpo: { id_tipo_accion_queja: 2, descripcion: ACCION }, idEmpleado }),
          403,
          /Solo el responsable asignado/,
        );
      }
      assert.equal(llamadas.acciones.length, 0);
    });

    it("un caso resuelto ya no admite acciones", async () => {
      enEstado("RESUELTA");
      await rechaza(
        servicio.registrarAccion({ idQueja: QUEJA, cuerpo: { id_tipo_accion_queja: 2, descripcion: ACCION }, idEmpleado: RESPONSABLE }),
        409,
      );
      assert.equal(llamadas.acciones.length, 0);
    });

    it("rechaza con 400 una acción sin tipo o sin descripción antes de tocar la base", async () => {
      await rechaza(servicio.registrarAccion({ idQueja: QUEJA, cuerpo: {}, idEmpleado: RESPONSABLE }), 400);
      assert.equal(casosModelo.bloquearQueja.mock.callCount(), 0);
    });
  });

  describe("criterio 2: transiciones de estado", () => {
    const VALIDAS = [
      ["ASIGNADA", "EN_ANALISIS"],
      ["EN_ANALISIS", "EN_ACCION"],
      ["EN_ACCION", "EN_ANALISIS"],
    ];

    for (const [desde, hacia] of VALIDAS) {
      it(`registra ${desde} → ${hacia} con estado anterior, nuevo, autor y fecha`, async () => {
        enEstado(desde);
        const resultado = await servicio.cambiarEstado({
          idQueja: QUEJA,
          cuerpo: { id_estado_queja: ID[hacia] },
          idEmpleado: RESPONSABLE,
        });
        assert.deepEqual(llamadas.transiciones, [
          { idQueja: QUEJA, idEstadoAnterior: ID[desde], idEstado: ID[hacia], idEmpleado: RESPONSABLE },
        ]);
        assert.deepEqual(llamadas.cambios, [{ idQueja: QUEJA, idEstado: ID[hacia], resolucion: null, idEstadoAviso: null }]);
        assert.equal(resultado.estado_anterior.codigo, desde);
        assert.equal(resultado.estado.codigo, hacia);
        assert.equal(resultado.cambiado_en, FECHA);
        assert.equal(resultado.aviso_resolucion, null);
        assert.equal(llamadas.avisos.length, 0);
      });
    }

    const INVALIDAS = [
      ["ASIGNADA", "EN_ACCION"],
      ["ASIGNADA", "RESUELTA"],
      ["EN_ANALISIS", "RESUELTA"],
      ["EN_ANALISIS", "ASIGNADA"],
      ["EN_ACCION", "ASIGNADA"],
      ["EN_ACCION", "DESESTIMADA"],
      ["EN_ANALISIS", "EN_ANALISIS"],
    ];

    for (const [desde, hacia] of INVALIDAS) {
      it(`rechaza ${desde} → ${hacia} con 409 y un mensaje claro`, async () => {
        enEstado(desde);
        await rechaza(
          servicio.cambiarEstado({
            idQueja: QUEJA,
            cuerpo: { id_estado_queja: ID[hacia], resolucion: RESOLUCION },
            idEmpleado: RESPONSABLE,
          }),
          409,
          /No se puede pasar el caso de «.+» a «.+»\./,
        );
        assert.equal(llamadas.transiciones.length, 0);
        assert.equal(llamadas.cambios.length, 0);
      });
    }

    it("«resuelta» es terminal: no admite más cambios", async () => {
      enEstado("RESUELTA");
      await rechaza(
        servicio.cambiarEstado({ idQueja: QUEJA, cuerpo: { id_estado_queja: ID.EN_ANALISIS }, idEmpleado: RESPONSABLE }),
        409,
        /cerrado/,
      );
    });

    it("solo el responsable vigente cambia el estado", async () => {
      enEstado("EN_ANALISIS");
      for (const idEmpleado of [ADMIN, OTRO]) {
        await rechaza(
          servicio.cambiarEstado({ idQueja: QUEJA, cuerpo: { id_estado_queja: ID.EN_ACCION }, idEmpleado }),
          403,
        );
      }
      assert.equal(llamadas.transiciones.length, 0);
    });

    it("un estado inexistente se rechaza con 400", async () => {
      await rechaza(servicio.cambiarEstado({ idQueja: QUEJA, cuerpo: { id_estado_queja: 99 }, idEmpleado: RESPONSABLE }), 400);
    });
  });

  describe("criterio 3: resolución y aviso al denunciante", () => {
    it("sin descripción de la resolución responde 400 indicando el campo y no cambia nada", async () => {
      enEstado("EN_ACCION");
      await assert.rejects(
        servicio.cambiarEstado({ idQueja: QUEJA, cuerpo: { id_estado_queja: ID.RESUELTA }, idEmpleado: RESPONSABLE }),
        (error) => error.estado === 400 && error.detalles[0].campo === "resolucion",
      );
      assert.equal(casosModelo.bloquearQueja.mock.callCount(), 0);
      assert.equal(llamadas.cambios.length, 0);
    });

    it("con descripción resuelve, la guarda cifrada y avisa al denunciante solo con el código", async () => {
      enEstado("EN_ACCION");
      const resultado = await servicio.cambiarEstado({
        idQueja: QUEJA,
        cuerpo: { id_estado_queja: ID.RESUELTA, resolucion: RESOLUCION },
        idEmpleado: RESPONSABLE,
      });
      const [cambio] = llamadas.cambios;
      assert.equal(cambio.idEstado, ID.RESUELTA);
      assert.equal(cambio.idEstadoAviso, 1);
      assert.ok(!cambio.resolucion.toString("utf8").includes(RESOLUCION));
      assert.equal(descifrarTexto(cambio.resolucion), RESOLUCION);
      assert.equal(resultado.estado.codigo, "RESUELTA");
      assert.equal(resultado.estado.es_final, true);

      assert.equal(llamadas.avisos.length, 1);
      const [aviso] = llamadas.avisos;
      assert.equal(aviso.url, "http://notificaciones.prueba/comunicaciones/directa");
      assert.equal(aviso.cuerpo.id_empleado_destinatario, DENUNCIANTE);
      assert.match(aviso.cuerpo.asunto, new RegExp(CODIGO));
      assert.match(aviso.cuerpo.contenido, /resuelto/);
      assert.ok(!JSON.stringify(aviso.cuerpo).includes(RESOLUCION));
      assert.ok(!JSON.stringify(aviso.cuerpo).includes("Reunión"));
      assert.deepEqual(llamadas.registrosAviso, [2]);
      assert.deepEqual(resultado.aviso_resolucion, { estado: "ENTREGADO", notificada_en: FECHA });
    });

    it("en una queja anónima no avisa a nadie ni deja datos del denunciante en la base o los logs", async () => {
      enEstado("EN_ACCION", { id_empleado_denunciante: null });
      const resultado = await servicio.cambiarEstado({
        idQueja: QUEJA,
        cuerpo: { id_estado_queja: ID.RESUELTA, resolucion: RESOLUCION },
        idEmpleado: RESPONSABLE,
      });
      assert.equal(llamadas.avisos.length, 0);
      assert.equal(llamadas.cambios[0].idEstadoAviso, null);
      assert.equal(llamadas.registrosAviso.length, 0);
      assert.equal(resultado.aviso_resolucion, null);
      assert.equal(modelo.obtenerDatosAvisoResolucion.mock.callCount(), 0);
      assert.ok(!logs.join("\n").includes(CODIGO));
    });

    it("si el aviso falla la resolución se mantiene, queda FALLIDO y el log no lleva datos del caso", async () => {
      enEstado("EN_ACCION");
      simular({ aviso: () => respuestaJson(503, { error: "caído" }) });
      const resultado = await servicio.cambiarEstado({
        idQueja: QUEJA,
        cuerpo: { id_estado_queja: ID.RESUELTA, resolucion: RESOLUCION },
        idEmpleado: RESPONSABLE,
      });
      assert.equal(resultado.estado.codigo, "RESUELTA");
      assert.deepEqual(resultado.aviso_resolucion, { estado: "FALLIDO", notificada_en: null });
      assert.deepEqual(llamadas.registrosAviso, [3]);
      const texto = logs.join("\n");
      assert.ok(texto.includes("denunciante"));
      for (const dato of [CODIGO, DENUNCIANTE, RESOLUCION, QUEJA]) assert.ok(!texto.includes(dato), dato);
    });

    it("si NotificationService no responde la resolución tampoco se revierte", async () => {
      enEstado("EN_ACCION");
      simular({
        aviso: () => {
          throw new TypeError("fetch failed");
        },
      });
      const resultado = await servicio.cambiarEstado({
        idQueja: QUEJA,
        cuerpo: { id_estado_queja: ID.RESUELTA, resolucion: RESOLUCION },
        idEmpleado: RESPONSABLE,
      });
      assert.equal(resultado.estado.codigo, "RESUELTA");
      assert.equal(resultado.aviso_resolucion.estado, "FALLIDO");
    });

    it("el aviso fallido se puede reintentar solo una queja identificada y solo el responsable", async () => {
      enEstado("RESUELTA", { id_estado_aviso_resolucion: 3 });
      assert.deepEqual(await servicio.reintentarAvisoResolucion({ idQueja: QUEJA, idEmpleado: RESPONSABLE }), {
        estado: "ENTREGADO",
        notificada_en: FECHA,
      });
      await rechaza(servicio.reintentarAvisoResolucion({ idQueja: QUEJA, idEmpleado: ADMIN }), 403);

      enEstado("RESUELTA", { id_estado_aviso_resolucion: 2 });
      await rechaza(servicio.reintentarAvisoResolucion({ idQueja: QUEJA, idEmpleado: RESPONSABLE }), 409, /ya recibió/);

      enEstado("RESUELTA", { id_empleado_denunciante: null });
      await rechaza(servicio.reintentarAvisoResolucion({ idQueja: QUEJA, idEmpleado: RESPONSABLE }), 409, /anónima/);
      assert.equal(llamadas.avisos.length, 1);
    });
  });

  describe("consulta del seguimiento", () => {
    beforeEach(() => {
      mock.method(modelo, "listarAcciones", async () => []);
      mock.method(modelo, "obtenerSituacion", async () => ({ id_estado_queja: queja.id_estado_queja, es_final: queja.es_final }));
    });

    it("el responsable ve solo las transiciones válidas desde el estado actual", async () => {
      enEstado("EN_ACCION");
      const { gestion } = await servicio.obtenerSeguimiento(QUEJA, { esAdministrador: false, idEmpleado: RESPONSABLE });
      assert.equal(gestion.puede_actuar, true);
      assert.deepEqual(gestion.transiciones.map((t) => t.codigo), ["EN_ANALISIS", "RESUELTA"]);
      assert.deepEqual(gestion.tipos_accion, TIPOS);
    });

    it("el Administrador de RRHH consulta la bitácora pero no actúa en nombre del responsable", async () => {
      enEstado("EN_ANALISIS");
      const { gestion } = await servicio.obtenerSeguimiento(QUEJA, { esAdministrador: true, idEmpleado: ADMIN });
      assert.equal(gestion.puede_actuar, false);
      assert.equal(gestion.puede_registrar_acciones, false);
      assert.deepEqual(gestion.transiciones, []);
    });

    it("otro empleado no puede ver el seguimiento", async () => {
      await rechaza(servicio.obtenerSeguimiento(QUEJA, { esAdministrador: false, idEmpleado: OTRO }), 403);
    });

    it("el responsable no recibe la identidad del denunciante ni las derivaciones", async () => {
      const casos = require("../services/casosQuejaService");
      mock.method(casos, "obtenerCaso", async () => ({
        id_queja: QUEJA,
        es_anonima: false,
        denunciante: { id_empleado: DENUNCIANTE, nombre_completo: "Diana Durán" },
        derivaciones: [{ id_asignacion: id(40) }],
      }));
      const caso = await servicio.obtenerAsignado(QUEJA, RESPONSABLE);
      assert.equal(caso.denunciante, null);
      assert.deepEqual(caso.derivaciones, []);
      assert.ok(!JSON.stringify(caso).includes(DENUNCIANTE));
      await rechaza(servicio.obtenerAsignado(QUEJA, OTRO), 403);
    });
  });

  describe("rutas", () => {
    let servidor;
    let base;

    before(async () => {
      const app = express();
      app.use(express.json());
      app.use(quejasRoutes);
      app.use(manejadorErrores);
      servidor = app.listen(0);
      await new Promise((resolver) => servidor.once("listening", resolver));
      base = `http://127.0.0.1:${servidor.address().port}`;
    });

    after(() => servidor.close());

    const pedir = (metodo, ruta, cabeceras = {}, cuerpo) =>
      fetchReal(`${base}${ruta}`, {
        method: metodo,
        headers: { "Content-Type": "application/json", ...cabeceras },
        body: cuerpo && metodo !== "GET" ? JSON.stringify(cuerpo) : undefined,
      });

    it("la bitácora no se puede editar ni borrar: no hay rutas para eso", async () => {
      const espia = mock.method(servicio, "registrarAccion", async () => ({}));
      const cabeceras = { "X-Rol": "admin", "X-Empleado-Id": RESPONSABLE };
      for (const metodo of ["PUT", "PATCH", "DELETE"]) {
        for (const ruta of [`/quejas/casos/${QUEJA}/acciones`, `/quejas/casos/${QUEJA}/acciones/${id(50)}`]) {
          const respuesta = await pedir(metodo, ruta, cabeceras, { descripcion: "cambio" });
          assert.equal(respuesta.status, 404, `${metodo} ${ruta}`);
        }
      }
      assert.equal(espia.mock.callCount(), 0);
    });

    it("registrar acciones y cambiar el estado exigen identificarse como empleado", async () => {
      const espias = ["registrarAccion", "cambiarEstado", "reintentarAvisoResolucion", "listarAsignados"].map((nombre) =>
        mock.method(servicio, nombre, async () => ({})),
      );
      for (const [metodo, ruta] of [
        ["POST", `/quejas/casos/${QUEJA}/acciones`],
        ["POST", `/quejas/casos/${QUEJA}/estado`],
        ["POST", `/quejas/casos/${QUEJA}/resolucion/notificacion`],
        ["GET", "/quejas/asignados"],
      ]) {
        const respuesta = await pedir(metodo, ruta, { "X-Rol": "admin" }, {});
        assert.equal(respuesta.status, 401, `${metodo} ${ruta}`);
      }
      assert.ok(espias.every((espia) => espia.mock.callCount() === 0));

      const conEmpleado = await pedir("POST", `/quejas/casos/${QUEJA}/acciones`, { "X-Empleado-Id": RESPONSABLE }, {});
      assert.equal(conEmpleado.status, 201);
      assert.equal(espias[0].mock.calls[0].arguments[0].idEmpleado, RESPONSABLE);
    });

    it("la bandeja del responsable se limita a sus casos asignados", async () => {
      const recibidos = [];
      mock.method(casosModelo, "listarCasos", async (filtros) => {
        recibidos.push(filtros);
        return [];
      });
      mock.method(casosModelo, "contarCasos", async () => 0);
      const respuesta = await pedir("GET", "/quejas/asignados?estado=3", { "X-Empleado-Id": RESPONSABLE });
      assert.equal(respuesta.status, 200);
      assert.equal(recibidos[0].idResponsable, RESPONSABLE);
      assert.equal(recibidos[0].idEstado, 3);
    });
  });
});

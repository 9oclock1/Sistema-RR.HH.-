const { describe, it, before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const modelo = require("../models/casosQuejaModel");
const servicio = require("../services/casosQuejaService");
const quejasRoutes = require("../routes/quejasRoutes");
const manejadorErrores = require("../middlewares/manejadorErrores");
const { leerFiltros } = require("../utils/casosQueja");
const { ErrorApp } = require("../utils/errores");

const QUEJA = "c0000000-0000-4000-8000-000000000001";
const ADMIN = "c0000000-0000-4000-8000-000000000010";

const fila = (n, extra = {}) => ({
  id_queja: `c0000000-0000-4000-8000-00000000010${n}`,
  codigo_seguimiento: `QJ-AAAA-000${n}`,
  es_anonima: n % 2 === 0,
  creado_en: new Date("2026-11-07T12:00:00Z"),
  actualizado_en: new Date("2026-11-07T12:00:00Z"),
  id_categoria_queja: 2,
  categoria_codigo: "ACOSO",
  categoria_nombre: "Acoso",
  id_prioridad_queja: null,
  prioridad_codigo: null,
  prioridad_nombre: null,
  id_estado_queja: 1,
  estado_codigo: "REGISTRADA",
  estado_nombre: "Registrada",
  es_final: false,
  id_empleado_responsable: null,
  responsable_nombres: null,
  responsable_apellidos: null,
  ...extra,
});

describe("RF-69: bandeja de casos de quejas", () => {
  afterEach(() => mock.restoreAll());

  describe("filtros por estado, categoría y prioridad", () => {
    it("convierte los filtros a números y usa la página 1 de 20 por defecto", () => {
      assert.deepEqual(leerFiltros({ estado: "1", categoria: "2", prioridad: "4" }), {
        idEstado: 1,
        idCategoria: 2,
        idPrioridad: 4,
        sinPrioridad: false,
        pagina: 1,
        limite: 20,
      });
    });

    it("«sin» filtra las quejas todavía sin prioridad", () => {
      const filtros = leerFiltros({ prioridad: "sin" });
      assert.equal(filtros.sinPrioridad, true);
      assert.equal(filtros.idPrioridad, null);
    });

    it("limita el tamaño de página a 50", () => {
      assert.equal(leerFiltros({ limite: "500" }).limite, 50);
    });

    it("rechaza filtros que no son identificadores válidos", () => {
      assert.throws(
        () => leerFiltros({ estado: "abc", categoria: "-1", pagina: "0" }),
        (error) => {
          assert.ok(error instanceof ErrorApp);
          assert.equal(error.estado, 400);
          assert.deepEqual(
            error.detalles.map((d) => d.campo),
            ["estado", "categoria", "pagina"],
          );
          return true;
        },
      );
    });

    it("pasa los filtros al modelo y devuelve el total para paginar", async () => {
      const recibidos = [];
      mock.method(modelo, "listarCasos", async (filtros) => {
        recibidos.push(filtros);
        return [fila(1), fila(2)];
      });
      mock.method(modelo, "contarCasos", async () => 42);
      const resultado = await servicio.listarCasos({ estado: "1", prioridad: "sin", pagina: "3", limite: "2" });
      assert.deepEqual(recibidos[0], {
        idEstado: 1,
        idCategoria: null,
        idPrioridad: null,
        sinPrioridad: true,
        pagina: 3,
        limite: 2,
      });
      assert.equal(resultado.total, 42);
      assert.equal(resultado.pagina, 3);
      assert.equal(resultado.casos.length, 2);
    });

    it("cada fila trae código, categoría, prioridad, estado, responsable y fecha, nunca el contenido", async () => {
      mock.method(modelo, "listarCasos", async () => [
        fila(1, {
          id_prioridad_queja: 3,
          prioridad_codigo: "ALTA",
          prioridad_nombre: "Alta",
          id_empleado_responsable: ADMIN,
          responsable_nombres: "Rosa",
          responsable_apellidos: "Rojas",
        }),
      ]);
      mock.method(modelo, "contarCasos", async () => 1);
      const [caso] = (await servicio.listarCasos({})).casos;
      assert.deepEqual(Object.keys(caso).sort(), [
        "actualizada_en",
        "categoria",
        "codigo_seguimiento",
        "es_anonima",
        "estado",
        "id_queja",
        "prioridad",
        "registrada_en",
        "responsable",
      ]);
      assert.deepEqual(caso.prioridad, { id: 3, codigo: "ALTA", nombre: "Alta" });
      assert.deepEqual(caso.responsable, { id_empleado: ADMIN, nombre_completo: "Rosa Rojas" });
    });
  });

  describe("solo el Administrador de RRHH clasifica y deriva", () => {
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
      fetch(`${base}${ruta}`, {
        method: metodo,
        headers: { "Content-Type": "application/json", ...cabeceras },
        body: cuerpo && metodo !== "GET" ? JSON.stringify(cuerpo) : undefined,
      });

    const RUTAS = [
      ["GET", "/quejas/casos"],
      ["GET", `/quejas/casos/${QUEJA}`],
      ["GET", "/quejas/responsables"],
      ["PUT", `/quejas/casos/${QUEJA}/clasificacion`],
      ["POST", `/quejas/casos/${QUEJA}/involucrados`],
      ["DELETE", `/quejas/casos/${QUEJA}/involucrados/${ADMIN}`],
      ["POST", `/quejas/casos/${QUEJA}/derivacion`],
      ["POST", `/quejas/casos/${QUEJA}/derivacion/notificacion`],
    ];

    const espiarServicio = () =>
      ["listarCasos", "obtenerCaso", "listarResponsables", "clasificar", "registrarInvolucrado", "quitarInvolucrado", "derivar", "reintentarAviso"].map(
        (nombre) => mock.method(servicio, nombre, async () => ({})),
      );

    it("sin rol responde 401 y no llega al servicio", async () => {
      const espias = espiarServicio();
      for (const [metodo, ruta] of RUTAS) {
        const respuesta = await pedir(metodo, ruta, { "X-Empleado-Id": ADMIN }, {});
        assert.equal(respuesta.status, 401, `${metodo} ${ruta}`);
      }
      assert.ok(espias.every((espia) => espia.mock.callCount() === 0));
    });

    it("empleado, supervisor y gerente reciben 403", async () => {
      const espias = espiarServicio();
      for (const rol of ["empleado", "supervisor", "gerente", "reclutador"]) {
        for (const [metodo, ruta] of RUTAS) {
          const respuesta = await pedir(metodo, ruta, { "X-Rol": rol, "X-Empleado-Id": ADMIN }, {});
          assert.equal(respuesta.status, 403, `${rol}: ${metodo} ${ruta}`);
          assert.match((await respuesta.json()).error, /Administrador de RRHH/);
        }
      }
      assert.ok(espias.every((espia) => espia.mock.callCount() === 0));
    });

    it("el administrador accede; para derivar debe identificarse como empleado", async () => {
      const [listar, , , , , , derivar] = espiarServicio();
      assert.equal((await pedir("GET", "/quejas/casos", { "X-Rol": " ADMIN " })).status, 200);
      assert.equal(listar.mock.callCount(), 1);

      const sinEmpleado = await pedir("POST", `/quejas/casos/${QUEJA}/derivacion`, { "X-Rol": "admin" }, {});
      assert.equal(sinEmpleado.status, 401);
      assert.equal(derivar.mock.callCount(), 0);

      const conEmpleado = await pedir(
        "POST",
        `/quejas/casos/${QUEJA}/derivacion`,
        { "X-Rol": "admin", "X-Empleado-Id": ADMIN },
        { id_empleado_responsable: ADMIN },
      );
      assert.equal(conEmpleado.status, 201);
      assert.equal(derivar.mock.calls[0].arguments[0].idAdministrador, ADMIN);
    });

    it("el conflicto de interés llega al cliente como 409 con su código", async () => {
      mock.method(servicio, "derivar", async () => {
        throw new ErrorApp(409, "Conflicto de interés", [
          { campo: "id_empleado_responsable", codigo: "CONFLICTO_INTERES", mensaje: "Conflicto de interés" },
        ]);
      });
      const respuesta = await pedir(
        "POST",
        `/quejas/casos/${QUEJA}/derivacion`,
        { "X-Rol": "admin", "X-Empleado-Id": ADMIN },
        { id_empleado_responsable: ADMIN },
      );
      assert.equal(respuesta.status, 409);
      assert.equal((await respuesta.json()).detalles[0].codigo, "CONFLICTO_INTERES");
    });

    it("la consulta pública por código sigue abierta y sin exigir rol", async () => {
      mock.method(servicio, "listarCasos", async () => ({}));
      const respuesta = await pedir("POST", "/quejas/seguimiento", {}, { codigo: "nada" });
      assert.notEqual(respuesta.status, 401);
      assert.notEqual(respuesta.status, 403);
    });
  });
});

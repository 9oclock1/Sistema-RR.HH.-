/**
 * Suite de integración: KAN-91 (RF-71) historial de quejas atendidas y su trazabilidad.
 *
 * Levanta las rutas de quejas en este mismo proceso contra la PerformanceDB de DATABASE_URL, con EmployeeService
 * simulado, y comprueba con SQL real que solo aparecen las quejas cerradas, que cada filtro (fecha de cierre,
 * categoría y sucursal) y sus combinaciones devuelven exactamente los casos esperados y que la exportación CSV
 * contiene ese mismo conjunto. Crea sus propios datos en 2031 (empleados y sucursales «c9100000-…») y al terminar
 * borra solo esos. Requiere db/init.sql y los catálogos de db/seed.sql. Sin base disponible, se omite.
 * Con el sistema en Docker:
 *   docker compose exec performance-service npm run test:historial
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const http = require("node:http");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const express = require("express");

process.env.QUEJAS_CLAVE_CIFRADO = randomBytes(32).toString("hex");
process.env.QUEJAS_ZONA_HORARIA = "America/La_Paz";

const id = (n) => `c9100000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = id(1);
const RESPONSABLE = id(2);
const DENUNCIANTE = id(3);
const NORTE = id(51);
const SUR = id(52);
const NUEVA = id(53);
const NOMBRE_SUR = "@Sucursal Prueba Sur";
const ASUNTO = "Trato hostil del encargado de cajas en el turno tarde";
const DESCRIPCION = "El encargado de cajas del turno tarde grita al personal frente a los clientes.";
const ACCION = "Reunión con el encargado de cajas para acordar un trato respetuoso.";
const RESOLUCION = "Se capacitó al encargado en liderazgo y se reorganizaron los turnos.";
const VENTANA = "desde=2031-01-01&hasta=2031-12-31";

let pool;
let cifrarTexto;
let generarCodigo;
let servidor;
let empleados;
let base;
let ESTADO = {};
let disponible = false;
let motivo = "";
const casos = {};
const creadas = [];

const escuchar = (srv) => new Promise((resolver) => srv.listen(0, "127.0.0.1", () => resolver(srv.address().port)));

function simularEmpleados() {
  return http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/sucursales") {
      return res.end(JSON.stringify([{ id_sucursal: NUEVA, nombre: "Sucursal Prueba Este" }]));
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "No encontrado" }));
  });
}

async function crearQueja({ categoria, sucursal = null, anonima, estado = "RESUELTA", registro, derivada, cierre }) {
  const codigo = generarCodigo();
  const cerrada = estado === "RESUELTA";
  const { rows } = await pool.query(
    `INSERT INTO quejas (id_empleado_denunciante, id_categoria_queja, id_prioridad_queja, id_estado_queja, id_sucursal,
                         es_anonima, codigo_seguimiento, asunto, descripcion, resolucion, creado_en, actualizado_en)
     VALUES ($1, $2, 2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id_queja`,
    [
      anonima ? null : DENUNCIANTE,
      categoria,
      ESTADO[estado],
      sucursal,
      anonima,
      codigo,
      cifrarTexto(ASUNTO),
      cifrarTexto(DESCRIPCION),
      cerrada ? cifrarTexto(RESOLUCION) : null,
      registro,
      cierre ?? derivada,
    ],
  );
  const idQueja = rows[0].id_queja;
  creadas.push(idQueja);

  const pasos = [
    [null, "REGISTRADA", null, registro],
    ["REGISTRADA", "ASIGNADA", ADMIN, derivada],
    ["ASIGNADA", "EN_ANALISIS", RESPONSABLE, derivada],
    ["EN_ANALISIS", "EN_ACCION", RESPONSABLE, derivada],
    ...(cerrada ? [["EN_ACCION", "RESUELTA", RESPONSABLE, cierre]] : []),
  ];
  for (const [anterior, nuevo, autor, fecha] of pasos) {
    await pool.query(
      `INSERT INTO historiales_estado_queja (id_queja, id_estado_anterior, id_estado_queja, id_empleado_responsable, fecha_cambio)
       VALUES ($1, $2, $3, $4, $5)`,
      [idQueja, anterior ? ESTADO[anterior] : null, ESTADO[nuevo], autor, fecha],
    );
  }
  await pool.query(
    `INSERT INTO asignaciones_queja (id_queja, id_empleado_responsable, id_empleado_asignador, asignada_en)
     VALUES ($1, $2, $3, $4)`,
    [idQueja, RESPONSABLE, ADMIN, derivada],
  );
  await pool.query(
    `INSERT INTO acciones_queja (id_queja, id_tipo_accion_queja, id_empleado_registrador, descripcion, creado_en)
     VALUES ($1, 1, $2, $3, $4)`,
    [idQueja, RESPONSABLE, cifrarTexto(ACCION), derivada],
  );
  return { idQueja, codigo };
}

async function api(ruta, { rol = "auditor", metodo = "GET", cuerpo } = {}) {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { ...(rol && { "X-Rol": rol }), ...(cuerpo && { "Content-Type": "application/json" }) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await respuesta.text();
  const json = respuesta.headers.get("content-type")?.includes("json");
  return { estado: respuesta.status, cuerpo: json && texto ? JSON.parse(texto) : texto, cabeceras: respuesta.headers };
}

const codigosDe = (cuerpo) => cuerpo.casos.map((caso) => caso.codigo_seguimiento);
const esperados = (...claves) => claves.map((clave) => casos[clave].codigo);
const codigosCsv = (texto) =>
  texto
    .replace(/^﻿/, "")
    .trimEnd()
    .split("\r\n")
    .slice(1)
    .map((linea) => linea.split(";")[0].replaceAll('"', ""));

describe("KAN-91 (RF-71): historial de quejas con la base real", () => {
  before(async () => {
    empleados = simularEmpleados();
    process.env.EMPLOYEE_SERVICE_URL = `http://127.0.0.1:${await escuchar(empleados)}`;
    process.env.EMPLOYEE_SERVICE_TIMEOUT_MS = "1500";
    pool = require("../src/config/db");
    ({ cifrarTexto } = require("../src/utils/cifrado"));
    ({ generarCodigo } = require("../src/utils/codigoSeguimiento"));

    try {
      await pool.query("SELECT id_sucursal, resolucion FROM quejas LIMIT 1");
      const { rows } = await pool.query("SELECT id_estado_queja, codigo FROM catalogos_estado_queja");
      ESTADO = Object.fromEntries(rows.map((fila) => [fila.codigo, fila.id_estado_queja]));
      if (!ESTADO.RESUELTA || !ESTADO.EN_ACCION) throw new Error("sin los estados de KAN-90 en seed.sql");
    } catch (error) {
      motivo = `PerformanceDB no disponible o sin el esquema de quejas (${error.message || error.code})`;
      return;
    }

    for (const [idEmpleado, nombres, apellidos] of [
      [ADMIN, "Ana", "Arce Admin"],
      [RESPONSABLE, "Rosa", "Rojas Ríos"],
      [DENUNCIANTE, "Diana", "Durán Daza"],
    ]) {
      await pool.query(
        `INSERT INTO empleados (id_empleado, nombres, apellidos) VALUES ($1, $2, $3) ON CONFLICT (id_empleado) DO NOTHING`,
        [idEmpleado, nombres, apellidos],
      );
    }
    await pool.query(
      `INSERT INTO sucursales (id_sucursal, nombre) VALUES ($1, 'Sucursal Prueba Norte'), ($2, $3) ON CONFLICT DO NOTHING`,
      [NORTE, SUR, NOMBRE_SUR],
    );

    casos.A = await crearQueja({
      categoria: 1,
      sucursal: NORTE,
      anonima: false,
      registro: "2031-03-01T13:00:00Z",
      derivada: "2031-03-02T13:00:00Z",
      cierre: "2031-03-10T13:00:00Z",
    });
    casos.B = await crearQueja({
      categoria: 2,
      sucursal: SUR,
      anonima: true,
      registro: "2031-03-11T13:00:00Z",
      derivada: "2031-03-12T13:00:00Z",
      cierre: "2031-03-20T13:00:00Z",
    });
    casos.C = await crearQueja({
      categoria: 1,
      anonima: true,
      registro: "2031-03-21T13:00:00Z",
      derivada: "2031-03-22T13:00:00Z",
      cierre: "2031-04-05T13:00:00Z",
    });
    casos.D = await crearQueja({
      categoria: 1,
      sucursal: NORTE,
      anonima: false,
      registro: "2031-03-25T13:00:00Z",
      derivada: "2031-03-26T13:00:00Z",
      cierre: "2031-04-01T03:30:00Z",
    });
    casos.E = await crearQueja({
      categoria: 1,
      sucursal: NORTE,
      anonima: false,
      estado: "EN_ACCION",
      registro: "2031-03-12T13:00:00Z",
      derivada: "2031-03-15T13:00:00Z",
    });

    const app = express();
    app.use(express.json());
    app.use(require("../src/routes/quejasRoutes"));
    app.use(require("../src/middlewares/manejadorErrores"));
    servidor = app.listen(0, "127.0.0.1");
    await new Promise((resolver) => servidor.once("listening", resolver));
    base = `http://127.0.0.1:${servidor.address().port}`;
    disponible = true;
  });

  after(async () => {
    servidor?.close();
    empleados?.close();
    if (disponible) {
      for (const tabla of ["acciones_queja", "asignaciones_queja", "historiales_estado_queja"]) {
        await pool.query(`DELETE FROM ${tabla} WHERE id_queja = ANY($1)`, [creadas]);
      }
      await pool.query("DELETE FROM quejas WHERE id_queja = ANY($1)", [creadas]);
      await pool.query("DELETE FROM empleados WHERE id_empleado::text LIKE 'c9100000-%'");
      await pool.query("DELETE FROM sucursales WHERE id_sucursal::text LIKE 'c9100000-%'");
    }
    await pool?.end();
  });

  const requiere = (t) => {
    if (!disponible) t.skip(motivo);
    return disponible;
  };

  describe("criterio 1: solo quejas cerradas", () => {
    it("el historial lista las quejas resueltas y nunca una en atención", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await api(`/quejas/historial?${VENTANA}&limite=50`);
      assert.equal(estado, 200);
      assert.deepEqual(codigosDe(cuerpo), esperados("C", "D", "B", "A"));
      assert.equal(cuerpo.total, 4);
      assert.ok(cuerpo.casos.every((caso) => caso.estado.es_final));

      const sinFiltros = await api("/quejas/historial?limite=50");
      assert.ok(!codigosDe(sinFiltros.cuerpo).includes(casos.E.codigo));
    });

    it("la paginación recorre exactamente el conjunto filtrado", async (t) => {
      if (!requiere(t)) return;
      const primera = await api(`/quejas/historial?${VENTANA}&limite=3&pagina=1`);
      const segunda = await api(`/quejas/historial?${VENTANA}&limite=3&pagina=2`);
      assert.equal(primera.cuerpo.total, 4);
      assert.deepEqual([...codigosDe(primera.cuerpo), ...codigosDe(segunda.cuerpo)], esperados("C", "D", "B", "A"));
    });

    it("el listado trae los metadatos sin textos descifrados ni datos del denunciante", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await api(`/quejas/historial?${VENTANA}`);
      const caso = cuerpo.casos.find((c) => c.codigo_seguimiento === casos.A.codigo);
      assert.equal(caso.es_anonima, false);
      assert.equal(caso.sucursal.nombre, "Sucursal Prueba Norte");
      assert.equal(caso.responsable.nombre_completo, "Rosa Rojas Ríos");
      assert.equal(caso.derivada_en, "2031-03-02T13:00:00.000Z");
      assert.equal(caso.cerrada_en, "2031-03-10T13:00:00.000Z");
      assert.equal(caso.duracion_dias, 9);
      assert.equal(caso.total_acciones, 1);
      const texto = JSON.stringify(cuerpo);
      for (const prohibido of [ASUNTO, DESCRIPCION, ACCION, RESOLUCION, DENUNCIANTE, "Diana", "denunciante"]) {
        assert.ok(!texto.includes(prohibido), prohibido);
      }
    });

    it("el detalle muestra la bitácora completa descifrada sin identificar al denunciante", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await api(`/quejas/historial/${casos.A.idQueja}`);
      assert.equal(estado, 200);
      assert.deepEqual(
        cuerpo.historial.map((paso) => paso.estado.codigo),
        ["REGISTRADA", "ASIGNADA", "EN_ANALISIS", "EN_ACCION", "RESUELTA"],
      );
      assert.equal(cuerpo.historial[0].registrado_por, null);
      assert.equal(cuerpo.historial.at(-1).registrado_por.nombre_completo, "Rosa Rojas Ríos");
      assert.equal(cuerpo.acciones[0].descripcion, ACCION);
      assert.equal(cuerpo.acciones[0].tipo.codigo, "PREVENTIVA");
      assert.equal(cuerpo.resolucion.descripcion, RESOLUCION);
      assert.equal(cuerpo.derivaciones[0].asignador.nombre_completo, "Ana Arce Admin");
      const texto = JSON.stringify(cuerpo);
      for (const prohibido of [ASUNTO, DESCRIPCION, DENUNCIANTE, "Diana", "denunciante"]) {
        assert.ok(!texto.includes(prohibido), prohibido);
      }
    });

    it("una queja en atención no tiene detalle en el historial", async (t) => {
      if (!requiere(t)) return;
      assert.equal((await api(`/quejas/historial/${casos.E.idQueja}`)).estado, 404);
    });
  });

  describe("criterio 2: filtros por fecha de cierre, categoría y sucursal", () => {
    const filtrar = async (consulta) => codigosDe((await api(`/quejas/historial?${consulta}&limite=50`)).cuerpo);

    it("por rango de fechas de cierre, en la hora local de La Paz", async (t) => {
      if (!requiere(t)) return;
      assert.deepEqual(await filtrar("desde=2031-03-15&hasta=2031-03-31"), esperados("D", "B"));
      assert.deepEqual(await filtrar("desde=2031-04-01&hasta=2031-12-31"), esperados("C"));
      assert.deepEqual(await filtrar("desde=2031-01-01&hasta=2031-03-10"), esperados("A"));
      assert.deepEqual(await filtrar("desde=2031-03-10&hasta=2031-03-10"), esperados("A"));
    });

    it("por categoría", async (t) => {
      if (!requiere(t)) return;
      assert.deepEqual(await filtrar(`${VENTANA}&categoria=2`), esperados("B"));
      assert.deepEqual(await filtrar(`${VENTANA}&categoria=1`), esperados("C", "D", "A"));
      assert.deepEqual(await filtrar(`${VENTANA}&categoria=3`), []);
    });

    it("por sucursal, y los casos sin sucursal solo con «sin» o sin filtro de sucursal", async (t) => {
      if (!requiere(t)) return;
      assert.deepEqual(await filtrar(`${VENTANA}&sucursal=${NORTE}`), esperados("D", "A"));
      assert.deepEqual(await filtrar(`${VENTANA}&sucursal=${SUR}`), esperados("B"));
      assert.deepEqual(await filtrar(`${VENTANA}&sucursal=sin`), esperados("C"));
    });

    it("combinados", async (t) => {
      if (!requiere(t)) return;
      assert.deepEqual(await filtrar(`desde=2031-03-01&hasta=2031-03-20&categoria=1&sucursal=${NORTE}`), esperados("A"));
      assert.deepEqual(await filtrar(`desde=2031-03-15&hasta=2031-04-30&categoria=1&sucursal=${NORTE}`), esperados("D"));
      assert.deepEqual(await filtrar(`${VENTANA}&categoria=2&sucursal=${NORTE}`), []);
    });

    it("la exportación contiene exactamente el conjunto filtrado", async (t) => {
      if (!requiere(t)) return;
      for (const consulta of [
        VENTANA,
        "desde=2031-03-15&hasta=2031-03-31",
        `${VENTANA}&categoria=1`,
        `${VENTANA}&sucursal=sin`,
        `desde=2031-03-01&hasta=2031-03-20&categoria=1&sucursal=${NORTE}`,
      ]) {
        const listado = await filtrar(consulta);
        const { estado, cuerpo, cabeceras } = await api(`/quejas/historial/exportacion?${consulta}`);
        assert.equal(estado, 200, consulta);
        assert.match(cabeceras.get("content-type"), /^text\/csv/);
        assert.deepEqual(codigosCsv(cuerpo), listado, consulta);
        assert.equal(cabeceras.get("x-total-casos"), String(listado.length));
      }
    });

    it("el CSV abre en Excel: BOM, encabezados en español, nombres peligrosos neutralizados y sin textos del caso", async (t) => {
      if (!requiere(t)) return;
      const respuesta = await fetch(`${base}/quejas/historial/exportacion?${VENTANA}&sucursal=${SUR}`, {
        headers: { "X-Rol": "auditor" },
      });
      const bytes = new Uint8Array(await respuesta.arrayBuffer());
      assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
      const cuerpo = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
      assert.ok(cuerpo.startsWith("﻿\"Código\";\"Tipo\";\"Categoría\""));
      const [, fila] = cuerpo.trimEnd().split("\r\n");
      const celdas = fila.split(";");
      assert.equal(celdas[1], '"Anónima"');
      assert.equal(celdas[4], `"'${NOMBRE_SUR}"`);
      for (const prohibido of [ASUNTO, DESCRIPCION, ACCION, RESOLUCION, "Diana"]) {
        assert.ok(!cuerpo.includes(prohibido), prohibido);
      }
    });
  });

  describe("criterio 3: permisos", () => {
    it("sin rol responde 401 y con un rol no autorizado 403 en historial, detalle y exportación", async (t) => {
      if (!requiere(t)) return;
      for (const ruta of ["/quejas/historial", `/quejas/historial/${casos.A.idQueja}`, "/quejas/historial/exportacion"]) {
        assert.equal((await api(ruta, { rol: null })).estado, 401, ruta);
        for (const rol of ["supervisor", "empleado", "gerente", "reclutador"]) {
          assert.equal((await api(ruta, { rol })).estado, 403, `${rol} ${ruta}`);
        }
        for (const rol of ["admin", "auditor"]) {
          assert.equal((await api(ruta, { rol })).estado, 200, `${rol} ${ruta}`);
        }
      }
    });
  });

  describe("sucursal registrada por RRHH", () => {
    it("el Administrador asigna la sucursal a un caso abierto y desde entonces se puede filtrar por ella", async (t) => {
      if (!requiere(t)) return;
      const ruta = `/quejas/casos/${casos.E.idQueja}/sucursal`;
      const respuesta = await api(ruta, { rol: "admin", metodo: "PUT", cuerpo: { id_sucursal: NUEVA } });
      assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.cuerpo));
      const { rows } = await pool.query(
        "SELECT q.id_sucursal, s.nombre FROM quejas q JOIN sucursales s USING (id_sucursal) WHERE q.id_queja = $1",
        [casos.E.idQueja],
      );
      assert.deepEqual(rows[0], { id_sucursal: NUEVA, nombre: "Sucursal Prueba Este" });
      const catalogos = await api("/quejas/historial/catalogos");
      assert.ok(catalogos.cuerpo.sucursales.some((s) => s.id_sucursal === NUEVA));

      const cerrada = await api(`/quejas/casos/${casos.A.idQueja}/sucursal`, {
        rol: "admin",
        metodo: "PUT",
        cuerpo: { id_sucursal: NUEVA },
      });
      assert.equal(cerrada.estado, 409);
    });
  });
});

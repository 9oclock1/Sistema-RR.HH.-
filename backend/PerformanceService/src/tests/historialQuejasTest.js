const { describe, it, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const express = require("express");

const URL_EMPLEADOS = "http://empleados.prueba";
process.env.QUEJAS_CLAVE_CIFRADO = randomBytes(32).toString("hex");
process.env.EMPLOYEE_SERVICE_URL = URL_EMPLEADOS;
process.env.QUEJAS_ZONA_HORARIA = "America/La_Paz";
const CLAVE = process.env.QUEJAS_CLAVE_CIFRADO;

const fetchReal = globalThis.fetch;
const clienteFalso = { query: async () => ({ rows: [] }) };
const rutaTransaccion = require.resolve(path.join(__dirname, "../config/transaccion"));
require.cache[rutaTransaccion] = {
  id: rutaTransaccion,
  filename: rutaTransaccion,
  loaded: true,
  exports: { enTransaccion: async (trabajo) => trabajo(clienteFalso) },
};

const modelo = require("../models/historialQuejaModel");
const casosModelo = require("../models/casosQuejaModel");
const seguimientoModelo = require("../models/seguimientoQuejaModel");
const quejasModelo = require("../models/quejasModel");
const sucursalModelo = require("../models/sucursalQuejaModel");
const quejasRoutes = require("../routes/quejasRoutes");
const manejadorErrores = require("../middlewares/manejadorErrores");
const { cifrarTexto } = require("../utils/cifrado");
const { ErrorApp } = require("../utils/errores");
const {
  BOM,
  ENCABEZADOS,
  armarCsv,
  duracionDias,
  leerFiltrosHistorial,
  neutralizarCelda,
} = require("../utils/historialQueja");

const id = (n) => `e1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const QUEJA = id(1);
const RESPONSABLE = id(10);
const ADMIN = id(11);
const SUCURSAL = id(20);
const DENUNCIANTE_NOMBRE = "Diana Durán";
const ASUNTO = "Trato hostil del encargado de cajas";
const ACCION = "Reunión con el encargado de cajas para acordar un trato respetuoso.";
const RESOLUCION = "Se capacitó al encargado y se reorganizaron los turnos de cajas.";
const REGISTRO = new Date("2031-03-01T14:00:00.000Z");
const DERIVACION = new Date("2031-03-02T14:00:00.000Z");
const CIERRE = new Date("2031-03-05T02:00:00.000Z");

const ROLES_PERMITIDOS = ["admin", "auditor"];
const ROLES_RECHAZADOS = ["supervisor", "gerente", "reclutador", "empleado", "invitado"];
const RUTAS = [
  "/quejas/historial",
  "/quejas/historial/catalogos",
  "/quejas/historial/exportacion",
  `/quejas/historial/${QUEJA}`,
];

const filaCerrada = (extra = {}) => ({
  id_queja: QUEJA,
  codigo_seguimiento: "QJ-7K3M-9XQ2",
  es_anonima: false,
  creado_en: REGISTRO,
  cerrada_en: CIERRE,
  id_categoria_queja: 1,
  categoria_codigo: "CLIMA_LABORAL",
  categoria_nombre: "Clima laboral",
  id_prioridad_queja: 3,
  prioridad_codigo: "ALTA",
  prioridad_nombre: "Alta",
  id_estado_queja: 5,
  estado_codigo: "RESUELTA",
  estado_nombre: "Resuelta",
  es_final: true,
  id_sucursal: SUCURSAL,
  sucursal_nombre: "Sopocachi",
  id_empleado_responsable: RESPONSABLE,
  responsable_nombres: "Rosa",
  responsable_apellidos: "Rojas",
  derivada_en: DERIVACION,
  acciones: 1,
  ...extra,
});

const HISTORIAL = [
  { estado_codigo: "REGISTRADA", estado_nombre: "Registrada", anterior_codigo: null, fecha_cambio: REGISTRO, id_empleado_responsable: null },
  {
    estado_codigo: "ASIGNADA",
    estado_nombre: "Asignada",
    anterior_codigo: "REGISTRADA",
    anterior_nombre: "Registrada",
    fecha_cambio: DERIVACION,
    id_empleado_responsable: ADMIN,
    nombres: "Ana",
    apellidos: "Arce",
  },
  {
    estado_codigo: "RESUELTA",
    estado_nombre: "Resuelta",
    anterior_codigo: "EN_ACCION",
    anterior_nombre: "En acción",
    fecha_cambio: CIERRE,
    id_empleado_responsable: RESPONSABLE,
    nombres: "Rosa",
    apellidos: "Rojas",
  },
];

const respuestaJson = (estado, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });

const rechaza400 = (funcion, campo) =>
  assert.throws(funcion, (error) => {
    assert.ok(error instanceof ErrorApp);
    assert.equal(error.estado, 400);
    assert.ok(error.detalles.some((detalle) => detalle.campo === campo), JSON.stringify(error.detalles));
    return true;
  });

describe("RF-71: historial de quejas atendidas (base simulada)", () => {
  let servidor;
  let base;
  let llamadas;
  let filas;
  let detalle;
  let sucursalesExternas;

  const pedir = (ruta, { rol, metodo = "GET", cuerpo } = {}) =>
    fetchReal(`${base}${ruta}`, {
      method: metodo,
      headers: { ...(rol && { "X-Rol": rol }), ...(cuerpo && { "Content-Type": "application/json" }) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });

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

  beforeEach(() => {
    process.env.QUEJAS_CLAVE_CIFRADO = CLAVE;
    llamadas = { listar: [], contar: [], obtener: [], sincronizadas: [], asignadas: [], fetch: [] };
    filas = [filaCerrada()];
    detalle = { ...filaCerrada(), resolucion: cifrarTexto(RESOLUCION) };
    sucursalesExternas = () => respuestaJson(200, [{ id_sucursal: SUCURSAL, nombre: "Sopocachi" }]);
    mock.method(console, "error", () => {});
    mock.method(globalThis, "fetch", async (url, opciones) => {
      if (!String(url).startsWith(URL_EMPLEADOS)) return fetchReal(url, opciones);
      llamadas.fetch.push(String(url));
      return sucursalesExternas();
    });
    mock.method(modelo, "listarCerradas", async (filtros) => {
      llamadas.listar.push(filtros);
      return filas;
    });
    mock.method(modelo, "contarCerradas", async (filtros) => {
      llamadas.contar.push(filtros);
      return filas.length;
    });
    mock.method(modelo, "obtenerCerrada", async (idQueja) => {
      llamadas.obtener.push(idQueja);
      return detalle;
    });
    mock.method(modelo, "listarSucursales", async () => [{ id_sucursal: SUCURSAL, nombre: "Sopocachi" }]);
    mock.method(quejasModelo, "listarCategorias", async () => [{ id_categoria_queja: 1, codigo: "CLIMA_LABORAL", nombre: "Clima laboral" }]);
    mock.method(casosModelo, "listarHistorial", async () => HISTORIAL);
    mock.method(casosModelo, "listarAsignaciones", async () => [
      {
        id_asignacion: id(30),
        comentario: "Revisar con el área de cajas.",
        asignada_en: DERIVACION,
        id_empleado_responsable: RESPONSABLE,
        responsable_nombres: "Rosa",
        responsable_apellidos: "Rojas",
        id_empleado_asignador: ADMIN,
        asignador_nombres: "Ana",
        asignador_apellidos: "Arce",
      },
    ]);
    mock.method(seguimientoModelo, "listarAcciones", async () => [
      {
        id_accion: id(40),
        descripcion: cifrarTexto(ACCION),
        creado_en: DERIVACION,
        tipo_codigo: "PREVENTIVA",
        tipo_nombre: "Preventiva",
        id_empleado_registrador: RESPONSABLE,
        nombres: "Rosa",
        apellidos: "Rojas",
      },
    ]);
    mock.method(casosModelo, "bloquearQueja", async () => ({ id_queja: QUEJA, es_final: false }));
    mock.method(sucursalModelo, "obtenerSucursalDeQueja", async () => ({ id_sucursal: null, sucursal_nombre: null, es_final: false }));
    mock.method(sucursalModelo, "sincronizarSucursal", async (db, datos) => llamadas.sincronizadas.push(datos));
    mock.method(sucursalModelo, "asignarSucursal", async (db, datos) => llamadas.asignadas.push(datos));
  });

  afterEach(() => mock.restoreAll());

  describe("filtros por fecha de cierre, categoría y sucursal", () => {
    it("lee los filtros combinados y normaliza la sucursal", () => {
      const filtros = leerFiltrosHistorial({
        desde: "2031-03-01",
        hasta: "2031-03-31",
        categoria: "2",
        sucursal: SUCURSAL.toUpperCase(),
      });
      assert.deepEqual(filtros, {
        desde: "2031-03-01",
        hasta: "2031-03-31",
        idCategoria: 2,
        idSucursal: SUCURSAL,
        sinSucursal: false,
        zonaHoraria: "America/La_Paz",
        pagina: 1,
        limite: 20,
      });
    });

    it("«sin» busca los casos sin sucursal y sin filtros no restringe nada", () => {
      const sinSucursal = leerFiltrosHistorial({ sucursal: "sin" });
      assert.equal(sinSucursal.sinSucursal, true);
      assert.equal(sinSucursal.idSucursal, null);
      const vacios = leerFiltrosHistorial({});
      assert.deepEqual(
        [vacios.desde, vacios.hasta, vacios.idCategoria, vacios.idSucursal, vacios.sinSucursal],
        [null, null, null, null, false],
      );
    });

    it("limita el tamaño de página y la exportación no se pagina", () => {
      assert.equal(leerFiltrosHistorial({ limite: "500" }).limite, 50);
      const exportacion = leerFiltrosHistorial({ categoria: "1", pagina: "3" }, { paginar: false });
      assert.equal("pagina" in exportacion, false);
      assert.equal("limite" in exportacion, false);
    });

    it("rechaza con 400 fechas inexistentes o con otro formato y un rango invertido", () => {
      rechaza400(() => leerFiltrosHistorial({ desde: "2031-02-30" }), "desde");
      rechaza400(() => leerFiltrosHistorial({ hasta: "31/03/2031" }), "hasta");
      rechaza400(() => leerFiltrosHistorial({ desde: "2031-04-01", hasta: "2031-03-01" }), "hasta");
    });

    it("rechaza con 400 una categoría o sucursal inválida", () => {
      rechaza400(() => leerFiltrosHistorial({ categoria: "uno" }), "categoria");
      rechaza400(() => leerFiltrosHistorial({ categoria: "-1" }), "categoria");
      rechaza400(() => leerFiltrosHistorial({ sucursal: "Sopocachi" }), "sucursal");
    });

    it("la duración de atención va en días con un decimal", () => {
      assert.equal(duracionDias(REGISTRO, CIERRE), 3.5);
      assert.equal(duracionDias(REGISTRO, null), null);
    });
  });

  describe("CSV: formato y protección contra inyección de fórmulas", () => {
    it("neutraliza toda celda de texto que empieza con =, +, -, @, tabulación o retorno", () => {
      for (const peligrosa of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUMA(A1)", "\t=1", "\r=1"]) {
        assert.equal(neutralizarCelda(peligrosa), `'${peligrosa}`);
      }
      assert.equal(neutralizarCelda("Sopocachi"), "Sopocachi");
      assert.equal(neutralizarCelda("Rosa = jefa"), "Rosa = jefa");
      assert.equal(neutralizarCelda(null), "");
    });

    it("lleva BOM, encabezados en español, separador ; y una fila por caso", () => {
      const csv = armarCsv([
        {
          codigo_seguimiento: "QJ-7K3M-9XQ2",
          es_anonima: true,
          categoria: { nombre: "Acoso" },
          prioridad: null,
          sucursal: null,
          responsable: null,
          registrada_en: REGISTRO,
          derivada_en: null,
          cerrada_en: CIERRE,
          duracion_dias: 3.5,
          estado: { nombre: "Resuelta" },
          total_acciones: 0,
        },
      ]);
      assert.ok(csv.startsWith(BOM));
      const lineas = csv.slice(BOM.length).split("\r\n");
      assert.equal(lineas.at(-1), "");
      assert.equal(lineas[0], ENCABEZADOS.map((titulo) => `"${titulo}"`).join(";"));
      assert.equal(lineas.length, 3);
      assert.equal(
        lineas[1],
        '"QJ-7K3M-9XQ2";"Anónima";"Acoso";"Sin prioridad";"Sin sucursal";"Sin responsable";"01/03/2031 10:00";"";"04/03/2031 22:00";"3,5";"Resuelta";"0"',
      );
    });

    it("neutraliza nombres peligrosos de sucursal, responsable o categoría y escapa las comillas", () => {
      const csv = armarCsv([
        {
          codigo_seguimiento: "QJ-7K3M-9XQ2",
          es_anonima: false,
          categoria: { nombre: "-Otro" },
          prioridad: { nombre: "Alta" },
          sucursal: { nombre: '=HYPERLINK("http://malicioso")' },
          responsable: { nombre_completo: "@Rosa Rojas" },
          registrada_en: REGISTRO,
          derivada_en: DERIVACION,
          cerrada_en: CIERRE,
          duracion_dias: 1,
          estado: { nombre: "Resuelta" },
          total_acciones: 2,
        },
      ]);
      const fila = csv.split("\r\n")[1].split(";");
      assert.equal(fila[2], '"\'-Otro"');
      assert.equal(fila[4], '"\'=HYPERLINK(""http://malicioso"")"');
      assert.equal(fila[5], '"\'@Rosa Rojas"');
      assert.equal(fila[1], '"Identificada"');
    });
  });

  describe("criterio 3: solo el Administrador de RRHH y el Auditor", () => {
    it("sin identificación responde 401 en el historial, el detalle, los catálogos y la exportación", async () => {
      for (const ruta of RUTAS) {
        const respuesta = await pedir(ruta);
        assert.equal(respuesta.status, 401, ruta);
      }
      assert.equal(llamadas.listar.length + llamadas.obtener.length, 0);
    });

    it("cualquier otro rol recibe 403 y no se consulta la base", async () => {
      for (const rol of ROLES_RECHAZADOS) {
        for (const ruta of RUTAS) {
          const respuesta = await pedir(ruta, { rol });
          assert.equal(respuesta.status, 403, `${rol} ${ruta}`);
          assert.match((await respuesta.json()).error, /Administrador de RRHH y el Auditor/);
        }
      }
      assert.equal(llamadas.listar.length + llamadas.contar.length + llamadas.obtener.length, 0);
    });

    it("el Administrador de RRHH y el Auditor sí acceden a las cuatro rutas", async () => {
      for (const rol of [...ROLES_PERMITIDOS, "AUDITOR"]) {
        for (const ruta of RUTAS) {
          const respuesta = await pedir(ruta, { rol });
          assert.equal(respuesta.status, 200, `${rol} ${ruta}`);
        }
      }
    });

    it("el historial es solo lectura: no hay rutas para crear, editar ni borrar", async () => {
      for (const metodo of ["POST", "PUT", "PATCH", "DELETE"]) {
        for (const ruta of ["/quejas/historial", `/quejas/historial/${QUEJA}`, "/quejas/historial/exportacion"]) {
          const respuesta = await pedir(ruta, { rol: "admin", metodo, cuerpo: {} });
          assert.equal(respuesta.status, 404, `${metodo} ${ruta}`);
        }
      }
    });

    it("el Auditor no puede registrar la sucursal de un caso: es tarea del Administrador de RRHH", async () => {
      const respuesta = await pedir(`/quejas/casos/${QUEJA}/sucursal`, {
        rol: "auditor",
        metodo: "PUT",
        cuerpo: { id_sucursal: SUCURSAL },
      });
      assert.equal(respuesta.status, 403);
      assert.equal(llamadas.asignadas.length, 0);
    });
  });

  describe("criterio 1: listado de casos cerrados", () => {
    it("pasa los filtros a la consulta y devuelve los metadatos del caso con la duración", async () => {
      const respuesta = await pedir(`/quejas/historial?desde=2031-03-01&hasta=2031-03-31&categoria=1&sucursal=${SUCURSAL}`, {
        rol: "auditor",
      });
      assert.equal(respuesta.status, 200);
      const cuerpo = await respuesta.json();
      assert.equal(cuerpo.total, 1);
      assert.deepEqual(llamadas.listar[0], llamadas.contar[0]);
      assert.equal(llamadas.listar[0].idCategoria, 1);
      assert.equal(llamadas.listar[0].idSucursal, SUCURSAL);
      const [caso] = cuerpo.casos;
      assert.equal(caso.codigo_seguimiento, "QJ-7K3M-9XQ2");
      assert.equal(caso.sucursal.nombre, "Sopocachi");
      assert.equal(caso.responsable.nombre_completo, "Rosa Rojas");
      assert.equal(caso.duracion_dias, 3.5);
      assert.equal(caso.total_acciones, 1);
      assert.equal(caso.estado.es_final, true);
    });

    it("un filtro inválido responde 400 antes de consultar la base", async () => {
      const respuesta = await pedir("/quejas/historial?desde=ayer", { rol: "admin" });
      assert.equal(respuesta.status, 400);
      assert.equal(llamadas.listar.length, 0);
    });

    it("la consulta solo incluye estados finales y no lee textos cifrados ni al denunciante", async () => {
      const consultas = [];
      const db = {
        query: async (sql, valores) => {
          consultas.push({ sql, valores });
          return { rows: [{ total: 0 }] };
        },
      };
      mock.restoreAll();
      const filtros = leerFiltrosHistorial({});
      await modelo.listarCerradas(filtros, db);
      await modelo.contarCerradas(filtros, db);
      await modelo.listarCerradas(leerFiltrosHistorial({}, { paginar: false }), db);
      for (const { sql } of consultas) {
        assert.match(sql, /eq\.es_final/);
        assert.doesNotMatch(sql, /asunto|descripcion|resolucion|denunciante|nombre_original/i);
      }
      assert.match(consultas[0].sql, /LIMIT \$7 OFFSET \$8/);
      assert.doesNotMatch(consultas[2].sql, /LIMIT \$7|OFFSET/);
      assert.equal(consultas[2].valores.length, 6);

      await modelo.obtenerCerrada(QUEJA, db);
      assert.match(consultas[3].sql, /eq\.es_final/);
      assert.doesNotMatch(consultas[3].sql, /asunto|q\.descripcion|denunciante/i);
    });

    it("el listado no descifra: responde aunque falte la clave, y el detalle sí la necesita", async () => {
      delete process.env.QUEJAS_CLAVE_CIFRADO;
      const listado = await pedir("/quejas/historial", { rol: "admin" });
      assert.equal(listado.status, 200);
      const exportacion = await pedir("/quejas/historial/exportacion", { rol: "admin" });
      assert.equal(exportacion.status, 200);
      const detalleSinClave = await pedir(`/quejas/historial/${QUEJA}`, { rol: "admin" });
      assert.equal(detalleSinClave.status, 500);
    });

    it("no expone la identidad del denunciante, tampoco en las quejas identificadas", async () => {
      filas = [
        filaCerrada({ es_anonima: false, id_empleado_denunciante: id(99), denunciante_nombres: "Diana" }),
        filaCerrada({ id_queja: id(2), es_anonima: true }),
      ];
      const cuerpo = await (await pedir("/quejas/historial", { rol: "auditor" })).json();
      const texto = JSON.stringify(cuerpo);
      assert.doesNotMatch(texto, /denunciante|Diana/);
      assert.ok(!texto.includes(id(99)));
      assert.deepEqual(
        cuerpo.casos.map((caso) => caso.es_anonima),
        [false, true],
      );
    });
  });

  describe("criterio 2: exportación del conjunto filtrado", () => {
    it("exporta un CSV con los mismos filtros del listado, sin paginar", async () => {
      filas = [filaCerrada(), filaCerrada({ id_queja: id(2), codigo_seguimiento: "QJ-AAAA-BBBB", id_sucursal: null })];
      const consulta = `desde=2031-03-01&hasta=2031-03-31&categoria=1&sucursal=sin&pagina=4&limite=5`;
      await pedir(`/quejas/historial?${consulta}`, { rol: "admin" });
      const respuesta = await pedir(`/quejas/historial/exportacion?${consulta}`, { rol: "auditor" });
      assert.equal(respuesta.status, 200);
      assert.match(respuesta.headers.get("content-type"), /^text\/csv; charset=utf-8/);
      assert.match(respuesta.headers.get("content-disposition"), /^attachment; filename="historial-quejas-\d{8}\.csv"$/);
      assert.equal(respuesta.headers.get("cache-control"), "no-store");
      assert.equal(respuesta.headers.get("x-total-casos"), "2");

      const [delListado, deLaExportacion] = llamadas.listar;
      const sinPaginar = ({ pagina, limite, ...resto }) => resto;
      assert.deepEqual(deLaExportacion, sinPaginar(delListado));
      assert.equal(deLaExportacion.limite, undefined);

      const bytes = new Uint8Array(await respuesta.arrayBuffer());
      assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
      const lineas = new TextDecoder().decode(bytes).trimEnd().split("\r\n");
      assert.equal(lineas.length, 3);
      assert.ok(lineas[1].startsWith('"QJ-7K3M-9XQ2";'));
      assert.ok(lineas[2].startsWith('"QJ-AAAA-BBBB";'));
      assert.match(lineas[2], /"Sin sucursal"/);
    });

    it("no incluye textos descifrados ni datos del denunciante", async () => {
      filas = [filaCerrada({ id_empleado_denunciante: id(99), denunciante_nombres: "Diana" })];
      const texto = await (await pedir("/quejas/historial/exportacion", { rol: "admin" })).text();
      for (const prohibido of [ASUNTO, ACCION, RESOLUCION, "Diana", id(99)]) {
        assert.ok(!texto.includes(prohibido), prohibido);
      }
    });
  });

  describe("criterio 1: detalle con la bitácora completa", () => {
    it("devuelve transiciones, acciones y resolución descifradas, derivaciones y fechas del caso", async () => {
      const respuesta = await pedir(`/quejas/historial/${QUEJA.toUpperCase()}`, { rol: "auditor" });
      assert.equal(respuesta.status, 200);
      const caso = await respuesta.json();
      assert.equal(llamadas.obtener[0], QUEJA);
      assert.deepEqual(
        caso.historial.map((paso) => [paso.estado_anterior?.codigo ?? null, paso.estado.codigo, paso.registrado_por?.nombre_completo ?? null]),
        [
          [null, "REGISTRADA", null],
          ["REGISTRADA", "ASIGNADA", "Ana Arce"],
          ["EN_ACCION", "RESUELTA", "Rosa Rojas"],
        ],
      );
      assert.deepEqual(caso.acciones, [
        {
          id_accion: id(40),
          tipo: { codigo: "PREVENTIVA", nombre: "Preventiva" },
          descripcion: ACCION,
          registrada_por: { id_empleado: RESPONSABLE, nombre_completo: "Rosa Rojas" },
          registrada_en: DERIVACION.toISOString(),
        },
      ]);
      assert.deepEqual(caso.resolucion, { descripcion: RESOLUCION });
      assert.equal(caso.derivaciones[0].asignador.nombre_completo, "Ana Arce");
      assert.equal(caso.registrada_en, REGISTRO.toISOString());
      assert.equal(caso.derivada_en, DERIVACION.toISOString());
      assert.equal(caso.cerrada_en, CIERRE.toISOString());
      assert.equal(caso.total_acciones, 1);
    });

    it("no devuelve el asunto, la descripción ni al denunciante de la queja", async () => {
      detalle = { ...detalle, id_empleado_denunciante: id(99), denunciante_nombres: "Diana" };
      const caso = await (await pedir(`/quejas/historial/${QUEJA}`, { rol: "admin" })).json();
      const texto = JSON.stringify(caso);
      for (const prohibido of ["asunto", "denunciante", "Diana", id(99), ASUNTO, DENUNCIANTE_NOMBRE]) {
        assert.ok(!texto.includes(prohibido), prohibido);
      }
      assert.equal(caso.es_anonima, false);
    });

    it("responde 404 si el caso no existe, no está cerrado o el identificador no es válido", async () => {
      detalle = null;
      assert.equal((await pedir(`/quejas/historial/${QUEJA}`, { rol: "admin" })).status, 404);
      assert.equal((await pedir("/quejas/historial/no-es-un-id", { rol: "admin" })).status, 404);
    });
  });

  describe("sucursal del caso (dónde ocurrió el problema)", () => {
    const registrar = (cuerpo, rol = "admin") =>
      pedir(`/quejas/casos/${QUEJA}/sucursal`, { rol, metodo: "PUT", cuerpo });

    it("el Administrador registra una sucursal activa de EmployeeService y se copia a la tabla espejo", async () => {
      const respuesta = await registrar({ id_sucursal: SUCURSAL.toUpperCase() });
      assert.equal(respuesta.status, 200);
      assert.deepEqual(await respuesta.json(), { sucursal: { id_sucursal: SUCURSAL, nombre: "Sopocachi" }, editable: true });
      assert.deepEqual(llamadas.sincronizadas, [{ idSucursal: SUCURSAL, nombre: "Sopocachi" }]);
      assert.deepEqual(llamadas.asignadas, [{ idQueja: QUEJA, idSucursal: SUCURSAL }]);
      assert.deepEqual(llamadas.fetch, [`${URL_EMPLEADOS}/sucursales`]);
    });

    it("con null quita la sucursal sin consultar EmployeeService", async () => {
      const respuesta = await registrar({ id_sucursal: null });
      assert.equal(respuesta.status, 200);
      assert.deepEqual(llamadas.asignadas, [{ idQueja: QUEJA, idSucursal: null }]);
      assert.equal(llamadas.fetch.length, 0);
    });

    it("rechaza una sucursal inválida o inexistente con 400 y responde 503 si EmployeeService no contesta", async () => {
      assert.equal((await registrar({ id_sucursal: "Sopocachi" })).status, 400);
      assert.equal((await registrar({})).status, 400);
      assert.equal((await registrar({ id_sucursal: id(21) })).status, 400);
      sucursalesExternas = () => respuestaJson(500, { error: "caído" });
      assert.equal((await registrar({ id_sucursal: SUCURSAL })).status, 503);
      assert.equal(llamadas.asignadas.length, 0);
    });

    it("una queja cerrada no admite cambios de sucursal", async () => {
      mock.method(casosModelo, "bloquearQueja", async () => ({ id_queja: QUEJA, es_final: true }));
      const respuesta = await registrar({ id_sucursal: SUCURSAL });
      assert.equal(respuesta.status, 409);
      assert.equal(llamadas.asignadas.length, 0);
    });

    it("consulta la sucursal vigente del caso", async () => {
      const respuesta = await pedir(`/quejas/casos/${QUEJA}/sucursal`, { rol: "admin" });
      assert.deepEqual(await respuesta.json(), { sucursal: null, editable: true });
    });
  });
});

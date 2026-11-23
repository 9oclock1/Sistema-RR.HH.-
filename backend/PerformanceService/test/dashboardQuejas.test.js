const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const zlib = require("node:zlib");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const express = require("express");

process.env.QUEJAS_CLAVE_CIFRADO = randomBytes(32).toString("hex");
process.env.QUEJAS_ZONA_HORARIA = "America/La_Paz";

const id = (n) => `c9200000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const AREA = { ATENCION: id(11), RRHH: id(12) };
const SUCURSAL = { MIRAFLORES: id(21), SOPOCACHI: id(22) };
const DENUNCIANTE_1 = id(31);
const DENUNCIANTE_2 = id(32);
const RESPONSABLE = id(33);
const ESTADO = { EN_ANALISIS: 3, RESUELTA: 5, DESESTIMADA: 6 };
const CATEGORIA = { CLIMA: 1, ACOSO: 2, CONDICIONES: 3, OTRO: 4 };
const ASUNTO = "Asunto reservado de la queja de prueba";
const DESCRIPCION = "Descripción reservada que nunca debe salir en el dashboard.";
const RESOLUCION = "Resolución reservada de la queja de prueba.";
const PERIODO = "desde=2033-01-01&hasta=2033-03-31";

let pool;
let cifrarTexto;
let generarCodigo;
let servidor;
let base;
let disponible = false;
let motivo = "";
const creadas = [];

const requiere = (t) => {
  if (!disponible) t.skip(motivo);
  return disponible;
};

async function api(ruta, { rol = "admin" } = {}) {
  const respuesta = await fetch(`${base}${ruta}`, { headers: rol ? { "X-Rol": rol } : {} });
  const contenido = Buffer.from(await respuesta.arrayBuffer());
  let cuerpo = null;
  try {
    cuerpo = JSON.parse(contenido.toString("utf8"));
  } catch {
    cuerpo = null;
  }
  return { estado: respuesta.status, cuerpo, contenido, cabeceras: respuesta.headers };
}

const dashboard = (consulta = PERIODO) => api(`/quejas/dashboard?${consulta}`);

const fecha = (texto) => `${texto}:00-04:00`;

async function crearQueja({ categoria, sucursal = null, area = null, anonima, creada, cierre = null, estado }) {
  const finalizada = estado === ESTADO.RESUELTA || estado === ESTADO.DESESTIMADA;
  const { rows } = await pool.query(
    `INSERT INTO quejas (id_empleado_denunciante, id_categoria_queja, id_estado_queja, id_departamento, id_sucursal,
                         es_anonima, codigo_seguimiento, asunto, descripcion, resolucion, creado_en, actualizado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id_queja`,
    [
      anonima ? null : creadas.length % 2 === 0 ? DENUNCIANTE_1 : DENUNCIANTE_2,
      categoria,
      estado,
      area,
      sucursal,
      anonima,
      generarCodigo(),
      cifrarTexto(ASUNTO),
      cifrarTexto(DESCRIPCION),
      estado === ESTADO.RESUELTA ? cifrarTexto(RESOLUCION) : null,
      fecha(creada),
      fecha(finalizada ? cierre : creada),
    ],
  );
  const idQueja = rows[0].id_queja;
  creadas.push(idQueja);
  const pasos = [
    [null, 1, null, creada],
    [1, 2, RESPONSABLE, creada],
    [2, estado === ESTADO.EN_ANALISIS ? 3 : estado, RESPONSABLE, finalizada ? cierre : creada],
  ];
  for (const [anterior, nuevo, autor, momento] of pasos) {
    await pool.query(
      `INSERT INTO historiales_estado_queja (id_queja, id_estado_anterior, id_estado_queja, id_empleado_responsable, fecha_cambio)
       VALUES ($1, $2, $3, $4, $5)`,
      [idQueja, anterior, nuevo, autor, fecha(momento)],
    );
  }
}

async function crearDatos() {
  const sql = (texto, parametros) => pool.query(texto, parametros);
  await sql(`INSERT INTO departamentos (id_departamento, nombre) VALUES ($1, '@KAN92 Atención al cliente'), ($2, '@KAN92 Recursos Humanos')`, [
    AREA.ATENCION,
    AREA.RRHH,
  ]);
  await sql(`INSERT INTO sucursales (id_sucursal, nombre) VALUES ($1, '@KAN92 Miraflores'), ($2, '@KAN92 Sopocachi')`, [
    SUCURSAL.MIRAFLORES,
    SUCURSAL.SOPOCACHI,
  ]);
  for (const [idEmpleado, nombres] of [
    [DENUNCIANTE_1, "Denunciante Uno"],
    [DENUNCIANTE_2, "Denunciante Dos"],
    [RESPONSABLE, "Responsable"],
  ]) {
    await sql("INSERT INTO empleados (id_empleado, nombres, apellidos) VALUES ($1, $2, 'KAN92')", [idEmpleado, nombres]);
  }

  const resuelta = ESTADO.RESUELTA;
  await crearQueja({ categoria: CATEGORIA.CLIMA, sucursal: SUCURSAL.MIRAFLORES, area: AREA.ATENCION, anonima: false, creada: "2033-01-05T10:00", cierre: "2033-01-09T10:00", estado: resuelta });
  await crearQueja({ categoria: CATEGORIA.CLIMA, sucursal: SUCURSAL.MIRAFLORES, area: AREA.ATENCION, anonima: true, creada: "2033-01-10T10:00", cierre: "2033-01-20T10:00", estado: resuelta });
  await crearQueja({ categoria: CATEGORIA.ACOSO, sucursal: SUCURSAL.SOPOCACHI, area: AREA.RRHH, anonima: true, creada: "2033-01-15T10:00", estado: ESTADO.EN_ANALISIS });
  await crearQueja({ categoria: CATEGORIA.CONDICIONES, anonima: false, creada: "2033-02-03T10:00", cierre: "2033-02-14T10:00", estado: resuelta });
  await crearQueja({ categoria: CATEGORIA.CLIMA, sucursal: SUCURSAL.SOPOCACHI, area: AREA.ATENCION, anonima: false, creada: "2033-02-10T10:00", cierre: "2033-02-12T10:00", estado: ESTADO.DESESTIMADA });
  await crearQueja({ categoria: CATEGORIA.ACOSO, sucursal: SUCURSAL.MIRAFLORES, area: AREA.RRHH, anonima: true, creada: "2033-02-20T10:00", cierre: "2033-03-05T10:00", estado: resuelta });
  await crearQueja({ categoria: CATEGORIA.OTRO, sucursal: SUCURSAL.SOPOCACHI, area: AREA.ATENCION, anonima: false, creada: "2033-03-02T10:00", cierre: "2033-03-06T10:00", estado: resuelta });
  await crearQueja({ categoria: CATEGORIA.CLIMA, sucursal: SUCURSAL.MIRAFLORES, area: AREA.ATENCION, anonima: true, creada: "2032-12-20T10:00", cierre: "2033-01-04T10:00", estado: resuelta });
}

async function borrarDatos() {
  const { rows } = await pool.query("SELECT id_queja FROM quejas WHERE id_departamento = ANY($1) OR id_empleado_denunciante = ANY($2) OR id_queja = ANY($3)", [
    [AREA.ATENCION, AREA.RRHH],
    [DENUNCIANTE_1, DENUNCIANTE_2],
    creadas,
  ]);
  const ids = rows.map((fila) => fila.id_queja);
  await pool.query("DELETE FROM historiales_estado_queja WHERE id_queja = ANY($1)", [ids]);
  await pool.query("DELETE FROM asignaciones_queja WHERE id_queja = ANY($1)", [ids]);
  await pool.query("DELETE FROM quejas WHERE id_queja = ANY($1)", [ids]);
  await pool.query("DELETE FROM empleados WHERE id_empleado::text LIKE $1", ["c9200000-%"]);
  await pool.query("DELETE FROM sucursales WHERE id_sucursal::text LIKE $1", ["c9200000-%"]);
  await pool.query("DELETE FROM departamentos WHERE id_departamento::text LIKE $1", ["c9200000-%"]);
}

const textoDelPdf = (contenido) => {
  const binario = contenido.toString("latin1");
  const flujos = [];
  for (const inicio of binario.matchAll(/stream\r?\n/g)) {
    const desde = inicio.index + inicio[0].length;
    try {
      flujos.push(zlib.inflateSync(contenido.subarray(desde, binario.indexOf("endstream", desde))).toString("latin1"));
    } catch {
      continue;
    }
  }
  return [...flujos.join("\n").matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((m) => Buffer.from(m[1], "hex").toString("latin1")).join("\n");
};

const kpis = (cuerpo) => [
  cuerpo.kpis.tasa_resolucion.valor,
  cuerpo.kpis.tasa_resolucion.semaforo,
  cuerpo.kpis.tiempo_promedio.valor,
  cuerpo.kpis.tiempo_promedio.semaforo,
];

describe("KAN-92 (RF-72): dashboard de quejas internas", () => {
  before(async () => {
    pool = require("../src/config/db");
    try {
      await pool.query("SELECT id_queja FROM quejas LIMIT 1");
      const { rows } = await pool.query("SELECT id_estado_queja FROM catalogos_estado_queja");
      if (rows.length < 6) throw new Error("sin los catálogos de db/catalogos.sql");
      ({ cifrarTexto } = require("../src/utils/cifrado"));
      ({ generarCodigo } = require("../src/utils/codigoSeguimiento"));
      await borrarDatos();
      await crearDatos();
    } catch (error) {
      motivo = `PerformanceDB no disponible o sin el esquema (${error.message || error.code})`;
      return;
    }

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
    if (pool) {
      try {
        await borrarDatos();
      } finally {
        await pool.end();
      }
    }
  });

  describe("indicadores del periodo enero a marzo de 2033", () => {
    it("KPI-01: 6 quejas resueltas en el periodo sobre 7 recibidas dan 85,71 % y cumple la meta", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await dashboard();

      assert.equal(estado, 200);
      assert.deepEqual(cuerpo.periodo, { desde: "2033-01-01", hasta: "2033-03-31" });
      assert.equal(cuerpo.kpis.tasa_resolucion.quejas_recibidas, 7);
      assert.equal(cuerpo.kpis.tasa_resolucion.quejas_resueltas, 6);
      assert.equal(cuerpo.kpis.tasa_resolucion.valor, 85.71);
      assert.equal(cuerpo.kpis.tasa_resolucion.semaforo, "VERDE");
    });

    it("KPI-02: el tiempo promedio de las 6 resueltas es 9,5 días y cumple la meta", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard();

      assert.equal(cuerpo.kpis.tiempo_promedio.valor, 9.5);
      assert.equal(cuerpo.kpis.tiempo_promedio.quejas_resueltas, 6);
      assert.equal(cuerpo.kpis.tiempo_promedio.semaforo, "VERDE");
    });

    it("la queja desestimada cuenta como recibida y la resuelta en el periodo pero recibida antes cuenta como resuelta", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard();

      assert.equal(cuerpo.resumen.quejas_recibidas, 7, "la recibida en diciembre de 2032 no entra");
      assert.equal(cuerpo.resumen.quejas_resueltas, 6, "entra la resuelta el 4 de enero aunque se recibió en 2032");
    });

    it("el resumen cuenta 3 anónimas y 4 identificadas entre las recibidas", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard();

      assert.equal(cuerpo.resumen.quejas_anonimas, 3);
      assert.equal(cuerpo.resumen.quejas_identificadas, 4);
    });
  });

  describe("tendencia mensual", () => {
    it("enero cumple las dos metas, febrero no cumple la tasa y marzo supera el 100 %", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard();
      const [enero, febrero, marzo] = cuerpo.tendencia_mensual;

      assert.deepEqual(cuerpo.tendencia_mensual.map((m) => m.mes), ["2033-01", "2033-02", "2033-03"]);
      assert.deepEqual([enero.quejas_recibidas, enero.quejas_resueltas, enero.tasa_resolucion, enero.semaforo_tasa, enero.tiempo_promedio_dias, enero.semaforo_tiempo], [3, 3, 100, "VERDE", 9.67, "VERDE"]);
      assert.deepEqual([febrero.quejas_recibidas, febrero.quejas_resueltas, febrero.tasa_resolucion, febrero.semaforo_tasa, febrero.tiempo_promedio_dias, febrero.semaforo_tiempo], [3, 1, 33.33, "ROJO", 11, "AMARILLO"]);
      assert.deepEqual([marzo.quejas_recibidas, marzo.quejas_resueltas, marzo.tasa_resolucion, marzo.semaforo_tasa, marzo.tiempo_promedio_dias, marzo.semaforo_tiempo], [1, 2, 200, "VERDE", 8.5, "VERDE"]);
    });

    it("un periodo de un solo mes devuelve solo ese mes", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard("desde=2033-02-01&hasta=2033-02-28");

      assert.deepEqual(cuerpo.tendencia_mensual.map((m) => m.mes), ["2033-02"]);
      assert.deepEqual(kpis(cuerpo), [33.33, "ROJO", 11, "AMARILLO"]);
    });
  });

  describe("incidencia por categoría, área y sucursal", () => {
    it("ordena las categorías de más a menos quejas con su tasa y su tiempo", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard();

      assert.deepEqual(
        cuerpo.por_categoria.map((c) => [c.nombre, c.quejas_recibidas, c.quejas_resueltas, c.tasa_resolucion, c.tiempo_promedio_dias]),
        [
          ["Clima laboral", 3, 3, 100, 9.67],
          ["Acoso", 2, 1, 50, 13],
          ["Condiciones de trabajo", 1, 1, 100, 11],
          ["Otro", 1, 1, 100, 4],
        ],
      );
    });

    it("agrupa por área incluyendo las quejas sin área", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard();

      assert.deepEqual(
        cuerpo.por_area.map((a) => [a.nombre.replace("@KAN92 ", ""), a.quejas_recibidas, a.quejas_resueltas]),
        [
          ["Atención al cliente", 4, 4],
          ["Recursos Humanos", 2, 1],
          ["Sin área", 1, 1],
        ],
      );
    });

    it("agrupa por sucursal incluyendo las quejas sin sucursal", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard();

      assert.deepEqual(
        cuerpo.por_sucursal.map((s) => [s.nombre.replace("@KAN92 ", ""), s.quejas_recibidas, s.quejas_resueltas, s.tasa_resolucion]),
        [
          ["Miraflores", 3, 4, 133.33],
          ["Sopocachi", 3, 1, 33.33],
          ["Sin sucursal", 1, 1, 100],
        ],
      );
    });
  });

  describe("filtros por periodo, categoría y sucursal", () => {
    it("filtrar por la categoría Clima laboral recalcula los indicadores", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`${PERIODO}&categoria=${CATEGORIA.CLIMA}`);

      assert.deepEqual(kpis(cuerpo), [100, "VERDE", 9.67, "VERDE"]);
      assert.equal(cuerpo.resumen.quejas_recibidas, 3);
      assert.deepEqual(cuerpo.filtros, { categoria: 1, sucursal: null });
      assert.deepEqual(cuerpo.por_categoria.map((c) => c.nombre), ["Clima laboral"]);
    });

    it("filtrar por Miraflores recalcula los indicadores y el tiempo pasa a amarillo", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`${PERIODO}&sucursal=${SUCURSAL.MIRAFLORES}`);

      assert.deepEqual(kpis(cuerpo), [133.33, "VERDE", 10.5, "AMARILLO"]);
      assert.equal(cuerpo.resumen.quejas_recibidas, 3);
    });

    it("«sin» filtra las quejas sin sucursal", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`${PERIODO}&sucursal=sin`);

      assert.deepEqual(kpis(cuerpo), [100, "VERDE", 11, "AMARILLO"]);
      assert.deepEqual(cuerpo.por_sucursal.map((s) => s.nombre), ["Sin sucursal"]);
      assert.equal(cuerpo.filtros.sucursal, "sin");
    });

    it("categoría y sucursal combinadas sin resoluciones dan 0 % en rojo y sin tiempo promedio", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`${PERIODO}&categoria=${CATEGORIA.ACOSO}&sucursal=${SUCURSAL.SOPOCACHI}`);

      assert.deepEqual(kpis(cuerpo), [0, "ROJO", null, null]);
      assert.equal(cuerpo.resumen.quejas_recibidas, 1);
    });

    it("un periodo sin quejas devuelve valores nulos y todos los meses", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await dashboard("desde=2034-01-01&hasta=2034-03-31");

      assert.equal(estado, 200);
      assert.deepEqual(kpis(cuerpo), [null, null, null, null]);
      assert.equal(cuerpo.tendencia_mensual.length, 3);
      assert.deepEqual([cuerpo.por_categoria, cuerpo.por_area, cuerpo.por_sucursal], [[], [], []]);
    });

    it("las opciones de los selectores traen todas las categorías y las sucursales, sin importar los filtros", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`${PERIODO}&categoria=${CATEGORIA.OTRO}`);

      assert.equal(cuerpo.opciones.categorias.length, 4);
      assert.ok(cuerpo.opciones.sucursales.some((s) => s.id === SUCURSAL.MIRAFLORES));
      assert.ok(cuerpo.opciones.sucursales.some((s) => s.id === SUCURSAL.SOPOCACHI));
    });

    it("sin fechas usa los últimos 6 meses hasta hoy", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await api("/quejas/dashboard");

      assert.equal(cuerpo.tendencia_mensual.length, 6);
      assert.equal(cuerpo.periodo.desde.slice(8), "01");
    });
  });

  describe("anonimato de las quejas", () => {
    const reservados = () => [DENUNCIANTE_1, DENUNCIANTE_2, ASUNTO, DESCRIPCION, RESOLUCION];

    it("la respuesta del dashboard no incluye identificadores de denunciantes ni el texto de las quejas", async (t) => {
      if (!requiere(t)) return;
      const { contenido } = await dashboard();
      const texto = contenido.toString("utf8");

      for (const reservado of reservados()) assert.ok(!texto.includes(reservado), `la respuesta no debe incluir «${reservado}»`);
      const codigos = (await pool.query("SELECT codigo_seguimiento FROM quejas WHERE id_departamento = ANY($1)", [[AREA.ATENCION, AREA.RRHH]])).rows;
      for (const { codigo_seguimiento: codigo } of codigos) assert.ok(!texto.includes(codigo), "tampoco los códigos de seguimiento");
    });

    it("el PDF no incluye identificadores de denunciantes ni el texto de las quejas", async (t) => {
      if (!requiere(t)) return;
      const { contenido } = await api(`/quejas/dashboard/exportacion?${PERIODO}`);
      const texto = textoDelPdf(contenido);
      const binario = contenido.toString("latin1");

      for (const reservado of reservados()) {
        assert.ok(!texto.includes(reservado) && !binario.includes(reservado), `el PDF no debe incluir «${reservado}»`);
      }
    });

    it("las quejas anónimas se cuentan entre las recibidas y no restan a los indicadores", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard();

      assert.ok(cuerpo.resumen.quejas_anonimas > 0);
      assert.equal(cuerpo.resumen.quejas_anonimas + cuerpo.resumen.quejas_identificadas, cuerpo.resumen.quejas_recibidas);
      assert.equal(cuerpo.kpis.tasa_resolucion.quejas_recibidas, cuerpo.resumen.quejas_recibidas);
    });
  });

  describe("exportación a PDF", () => {
    it("descarga un PDF con el nombre del periodo y sin guardarse en caché", async (t) => {
      if (!requiere(t)) return;
      const { estado, contenido, cabeceras } = await api(`/quejas/dashboard/exportacion?${PERIODO}`);

      assert.equal(estado, 200);
      assert.equal(cabeceras.get("content-type"), "application/pdf");
      assert.match(cabeceras.get("content-disposition"), /attachment; filename="dashboard-quejas-2033-01-01_2033-03-31\.pdf"/);
      assert.equal(cabeceras.get("cache-control"), "no-store");
      assert.equal(contenido.subarray(0, 5).toString("latin1"), "%PDF-");
      assert.equal(Number(cabeceras.get("content-length")), contenido.length);
    });

    it("el PDF trae los KPI y las tablas del periodo filtrado", async (t) => {
      if (!requiere(t)) return;
      const { contenido } = await api(`/quejas/dashboard/exportacion?${PERIODO}&categoria=${CATEGORIA.CLIMA}&sucursal=${SUCURSAL.MIRAFLORES}`);
      const texto = textoDelPdf(contenido);

      assert.match(texto, /Periodo: del 01\/01\/2033 al 31\/03\/2033/);
      assert.match(texto, /Categor.a: Clima laboral/);
      assert.match(texto, /Sucursal: @KAN92 Miraflores/);
      assert.match(texto, /150,00 %/);
      assert.match(texto, /9,67 d.as/);
      assert.match(texto, /ene 2033/);
      assert.match(texto, /Quejas por .rea/);
    });

    it("un filtro inválido responde 400 también en la exportación", async (t) => {
      if (!requiere(t)) return;
      assert.equal((await api("/quejas/dashboard/exportacion?desde=2033-13-01")).estado, 400);
    });
  });

  describe("errores y permisos", () => {
    it("rechaza con 400 las fechas, la categoría y la sucursal inválidas y señala cada campo", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await dashboard("desde=2033-13-01&categoria=abc&sucursal=zzz");

      assert.equal(estado, 400);
      assert.deepEqual(cuerpo.detalles.map((d) => d.campo), ["desde", "categoria", "sucursal"]);
    });

    it("rechaza un rango invertido y uno de más de 36 meses", async (t) => {
      if (!requiere(t)) return;
      assert.equal((await dashboard("desde=2033-03-01&hasta=2033-01-01")).estado, 400);
      assert.equal((await dashboard("desde=2020-01-01&hasta=2026-01-01")).estado, 400);
    });

    it("solo el Administrador de RRHH lo consulta y lo exporta; los demás roles reciben 403 y sin rol 401", async (t) => {
      if (!requiere(t)) return;
      for (const ruta of ["/quejas/dashboard", "/quejas/dashboard/exportacion"]) {
        assert.equal((await api(`${ruta}?${PERIODO}`, { rol: "admin" })).estado, 200, `admin ${ruta}`);
        for (const rol of ["gerente", "auditor", "supervisor", "reclutador", "empleado"]) {
          assert.equal((await api(`${ruta}?${PERIODO}`, { rol })).estado, 403, `${rol} ${ruta}`);
        }
        assert.equal((await api(`${ruta}?${PERIODO}`, { rol: null })).estado, 401, `sin rol ${ruta}`);
      }
    });
  });
});

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const express = require("express");

const ID_BASE = "c9400000-0000-4000-8000-";
const id = (n) => `${ID_BASE}${String(n).padStart(12, "0")}`;

const AREA = { ATENCION: id(11), RRHH: id(12) };
const SUCURSAL = { SOPOCACHI: id(21), MIRAFLORES: id(22) };
const CREADOR = id(1);
const EVALUADOR = id(2);
const COLABORADORES = Array.from({ length: 8 }, (_, i) => id(31 + i));
const PERIODO_1 = id(91);
const PERIODO_2 = id(92);
const CICLO_1 = id(101);
const CICLO_2 = id(102);
const CICLO_ABIERTO = id(103);
const PLANTILLA = id(51);
const VERSION = id(52);
const ENVIADA = 3;
const VENCIDA = 4;
const PENDIENTE = 1;

let pool;
let servidor;
let base;
let disponible = false;
let motivo = "";

const requiere = (t) => {
  if (!disponible) t.skip(motivo);
  return disponible;
};

async function api(ruta, { rol = "gerente" } = {}) {
  const respuesta = await fetch(`${base}${ruta}`, { headers: rol ? { "X-Rol": rol } : {} });
  const texto = await respuesta.text();
  let cuerpo = null;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    cuerpo = null;
  }
  return { estado: respuesta.status, cuerpo };
}

const dashboard = (consulta = "") => api(`/desempeno/dashboard${consulta}`);

const EVALUACIONES = [
  [201, CICLO_1, AREA.ATENCION, SUCURSAL.SOPOCACHI, ENVIADA, 80],
  [202, CICLO_1, AREA.ATENCION, SUCURSAL.SOPOCACHI, ENVIADA, 60],
  [203, CICLO_1, AREA.ATENCION, SUCURSAL.MIRAFLORES, ENVIADA, 40],
  [204, CICLO_1, AREA.RRHH, SUCURSAL.SOPOCACHI, ENVIADA, 100],
  [205, CICLO_1, AREA.RRHH, SUCURSAL.MIRAFLORES, VENCIDA, null],
  [206, CICLO_1, AREA.ATENCION, SUCURSAL.MIRAFLORES, VENCIDA, null],
  [211, CICLO_2, AREA.ATENCION, SUCURSAL.SOPOCACHI, ENVIADA, 90],
  [212, CICLO_2, AREA.ATENCION, SUCURSAL.SOPOCACHI, ENVIADA, 70],
  [213, CICLO_2, AREA.ATENCION, SUCURSAL.MIRAFLORES, ENVIADA, 63],
  [214, CICLO_2, AREA.RRHH, SUCURSAL.SOPOCACHI, ENVIADA, 50],
  [215, CICLO_2, AREA.RRHH, SUCURSAL.MIRAFLORES, ENVIADA, 70],
  [221, CICLO_ABIERTO, AREA.ATENCION, SUCURSAL.SOPOCACHI, PENDIENTE, null],
];

async function crearDatos() {
  const sql = (texto, parametros) => pool.query(texto, parametros);
  await sql(
    `INSERT INTO departamentos (id_departamento, nombre) VALUES ($1, '@KAN94 Atención al cliente'), ($2, '@KAN94 Recursos Humanos')`,
    [AREA.ATENCION, AREA.RRHH],
  );
  await sql(
    `INSERT INTO sucursales (id_sucursal, nombre) VALUES ($1, '@KAN94 Sopocachi'), ($2, '@KAN94 Miraflores')`,
    [SUCURSAL.SOPOCACHI, SUCURSAL.MIRAFLORES],
  );
  for (const [idEmpleado, nombres] of [[CREADOR, "Admin"], [EVALUADOR, "Evaluador"], ...COLABORADORES.map((c, i) => [c, `Colaborador ${i + 1}`])]) {
    await sql("INSERT INTO empleados (id_empleado, nombres, apellidos) VALUES ($1, $2, 'KAN94')", [idEmpleado, nombres]);
  }
  await sql(
    `INSERT INTO plantillas_evaluacion (id_plantilla, id_departamento_destino, id_empleado_creador, nombre, objetivo, vigencia_desde, vigencia_hasta)
     VALUES ($1, $2, $3, '@KAN94 plantilla', 'Probar el dashboard', '2032-01-01', '2032-12-31')`,
    [PLANTILLA, AREA.ATENCION, CREADOR],
  );
  await sql(
    `INSERT INTO versiones_plantilla (id_version, id_plantilla, id_estado_version, id_empleado_publicador, numero_version, publicada_en) VALUES ($1, $2, 2, $3, 1, now())`,
    [VERSION, PLANTILLA, CREADOR],
  );
  await sql(
    `INSERT INTO periodos_evaluacion (id_periodo, nombre, fecha_inicio, fecha_fin)
     VALUES ($1, '@KAN94-2032-T1', '2032-01-01', '2032-03-31'), ($2, '@KAN94-2032-T2', '2032-04-01', '2032-06-30')`,
    [PERIODO_1, PERIODO_2],
  );
  await sql(
    `INSERT INTO ciclos_evaluacion (id_ciclo, id_version, id_periodo, id_estado_ciclo, id_empleado_creador, nombre, fecha_inicio, fecha_limite, cerrado_en)
     VALUES ($1, $4, $5, 3, $7, '@KAN94 ciclo 1', '2032-03-01', '2032-04-10', '2032-04-12 08:00:00-04'),
            ($2, $4, $6, 3, $7, '@KAN94 ciclo 2', '2032-06-01', '2032-07-10', '2032-07-12 08:00:00-04'),
            ($3, $4, $6, 2, $7, '@KAN94 ciclo abierto', '2032-06-01', '2032-12-31', NULL)`,
    [CICLO_1, CICLO_2, CICLO_ABIERTO, VERSION, PERIODO_1, PERIODO_2, CREADOR],
  );
  let indice = 0;
  for (const [n, ciclo, area, sucursal, estado, puntaje] of EVALUACIONES) {
    await sql(
      `INSERT INTO evaluaciones (id_evaluacion, id_ciclo, id_empleado_evaluado, id_empleado_evaluador, id_departamento, id_sucursal, id_estado_evaluacion, puntaje_final, enviada_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7::smallint, $8::numeric, CASE WHEN $7::smallint = 3 THEN now() END)`,
      [id(n), ciclo, COLABORADORES[indice % COLABORADORES.length], EVALUADOR, area, sucursal, estado, puntaje],
    );
    indice += 1;
  }
}

async function borrarDatos() {
  const ciclos = [CICLO_1, CICLO_2, CICLO_ABIERTO];
  await pool.query("DELETE FROM evaluaciones WHERE id_ciclo = ANY($1)", [ciclos]);
  await pool.query("DELETE FROM ciclos_evaluacion WHERE id_ciclo = ANY($1)", [ciclos]);
  await pool.query("DELETE FROM periodos_evaluacion WHERE id_periodo = ANY($1)", [[PERIODO_1, PERIODO_2]]);
  await pool.query("DELETE FROM versiones_plantilla WHERE id_version::text LIKE $1", [`${ID_BASE}%`]);
  await pool.query("DELETE FROM plantillas_evaluacion WHERE id_plantilla::text LIKE $1", [`${ID_BASE}%`]);
  await pool.query("DELETE FROM empleados WHERE id_empleado::text LIKE $1", [`${ID_BASE}%`]);
  await pool.query("DELETE FROM sucursales WHERE id_sucursal::text LIKE $1", [`${ID_BASE}%`]);
  await pool.query("DELETE FROM departamentos WHERE id_departamento::text LIKE $1", [`${ID_BASE}%`]);
}

const kpis = (cuerpo) => [
  cuerpo.kpis.puntaje_promedio.valor,
  cuerpo.kpis.puntaje_promedio.semaforo,
  cuerpo.kpis.cumplimiento_evaluaciones.valor,
  cuerpo.kpis.cumplimiento_evaluaciones.semaforo,
];
const cantidades = (cuerpo) => cuerpo.histograma.rangos.map((rango) => rango.cantidad);

describe("KAN-94 (RF-74): dashboard consolidado de desempeño", () => {
  before(async () => {
    pool = require("../src/config/db");
    try {
      await pool.query("SELECT id_evaluacion FROM evaluaciones LIMIT 1");
      const { rows } = await pool.query("SELECT id_estado_ciclo FROM catalogos_estado_ciclo");
      if (rows.length < 3) throw new Error("sin los catálogos de db/catalogos.sql");
      await borrarDatos();
      await crearDatos();
    } catch (error) {
      motivo = `PerformanceDB no disponible o sin el esquema (${error.message || error.code})`;
      return;
    }

    const app = express();
    app.use(express.json());
    app.use(require("../src/routes/desempenoRoutes"));
    app.use(require("../src/middlewares/manejadorErrores"));
    servidor = await new Promise((resolver) => {
      const srv = app.listen(0, "127.0.0.1", () => resolver(srv));
    });
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

  describe("indicadores de un ciclo cerrado", () => {
    it("sin elegir ciclo muestra el último ciclo cerrado", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await dashboard();

      assert.equal(estado, 200);
      assert.equal(cuerpo.ciclo.id_ciclo, CICLO_2);
      assert.equal(cuerpo.ciclo.nombre, "@KAN94 ciclo 2");
    });

    it("KPI-07 y KPI-08 del ciclo 2: 3,43 amarillo y 100 % verde", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`?ciclo=${CICLO_2}`);

      assert.deepEqual(kpis(cuerpo), [3.43, "AMARILLO", 100, "VERDE"]);
      assert.equal(cuerpo.kpis.puntaje_promedio.puntaje_sobre_100, 68.6);
      assert.equal(cuerpo.kpis.puntaje_promedio.meta, 3.5);
      assert.equal(cuerpo.kpis.cumplimiento_evaluaciones.meta, 90);
    });

    it("KPI-07 y KPI-08 del ciclo 1: justo en la meta (3,50 verde) y 66,67 % rojo con 2 vencidas", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`?ciclo=${CICLO_1}`);

      assert.deepEqual(kpis(cuerpo), [3.5, "VERDE", 66.67, "ROJO"]);
      assert.equal(cuerpo.kpis.puntaje_promedio.evaluaciones_cerradas, 4);
      assert.equal(cuerpo.kpis.cumplimiento_evaluaciones.evaluaciones_enviadas, 4);
      assert.equal(cuerpo.kpis.cumplimiento_evaluaciones.evaluaciones_asignadas, 6);
      assert.equal(cuerpo.kpis.cumplimiento_evaluaciones.evaluaciones_vencidas, 2);
    });
  });

  describe("histograma y rankings", () => {
    it("el histograma del ciclo 1 reparte 80, 60, 40 y 100 en sus rangos de medio punto", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`?ciclo=${CICLO_1}`);

      assert.equal(cuerpo.histograma.total, 4);
      assert.deepEqual(cantidades(cuerpo), [0, 0, 1, 0, 1, 0, 1, 1]);
    });

    it("el ranking de áreas del ciclo 1 pone a Recursos Humanos (5,00) sobre Atención al cliente (3,00)", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`?ciclo=${CICLO_1}`);
      const propios = cuerpo.ranking_areas.filter((a) => a.id === AREA.RRHH || a.id === AREA.ATENCION);

      assert.deepEqual(
        propios.map((a) => [a.posicion, a.puntaje, a.evaluaciones_enviadas, a.evaluaciones_asignadas]),
        [
          [1, 5, 1, 2],
          [2, 3, 3, 4],
        ],
      );
      assert.deepEqual(propios.map((a) => a.id), [AREA.RRHH, AREA.ATENCION]);
    });

    it("el ranking de sucursales del ciclo 1 pone a Sopocachi (4,00) sobre Miraflores (2,00)", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`?ciclo=${CICLO_1}`);

      assert.deepEqual(
        cuerpo.ranking_sucursales.map((s) => [s.id, s.puntaje]),
        [
          [SUCURSAL.SOPOCACHI, 4],
          [SUCURSAL.MIRAFLORES, 2],
        ],
      );
    });

    it("el ranking cambia entre ciclos: en el ciclo 2 Atención al cliente supera a Recursos Humanos", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`?ciclo=${CICLO_2}`);

      assert.deepEqual(
        cuerpo.ranking_areas.map((a) => [a.id, a.puntaje]),
        [
          [AREA.ATENCION, 3.72],
          [AREA.RRHH, 3.0],
        ],
      );
    });
  });

  describe("filtros por área y sucursal", () => {
    it("filtrar por Recursos Humanos recalcula los KPI y el histograma del ciclo 1", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`?ciclo=${CICLO_1}&departamento=${AREA.RRHH}`);

      assert.deepEqual(kpis(cuerpo), [5, "VERDE", 50, "ROJO"]);
      assert.equal(cuerpo.histograma.total, 1);
      assert.deepEqual(cantidades(cuerpo), [0, 0, 0, 0, 0, 0, 0, 1]);
    });

    it("el ranking de áreas ignora el filtro de área y el de sucursales lo respeta", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`?ciclo=${CICLO_1}&departamento=${AREA.RRHH}`);

      assert.ok(cuerpo.ranking_areas.some((a) => a.id === AREA.ATENCION));
      assert.deepEqual(
        cuerpo.ranking_sucursales.map((s) => [s.id, s.evaluaciones_asignadas]),
        [
          [SUCURSAL.SOPOCACHI, 1],
          [SUCURSAL.MIRAFLORES, 1],
        ],
      );
    });

    it("filtrar por Miraflores recalcula los KPI y limita el ranking de áreas a esa sucursal", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`?ciclo=${CICLO_1}&sucursal=${SUCURSAL.MIRAFLORES}`);

      assert.deepEqual(kpis(cuerpo), [2, "ROJO", 33.33, "ROJO"]);
      assert.deepEqual(
        cuerpo.ranking_areas.map((a) => [a.id, a.evaluaciones_asignadas]).sort(),
        [
          [AREA.ATENCION, 2],
          [AREA.RRHH, 1],
        ].sort(),
      );
    });

    it("la combinación de área y sucursal sin evaluaciones enviadas devuelve valores nulos, no un error", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await dashboard(`?ciclo=${CICLO_1}&departamento=${AREA.RRHH}&sucursal=${SUCURSAL.MIRAFLORES}`);

      assert.equal(estado, 200);
      assert.deepEqual(kpis(cuerpo), [null, null, 0, "ROJO"]);
      assert.equal(cuerpo.histograma.total, 0);
    });

    it("las opciones de los selectores traen las áreas y sucursales del ciclo, sin aplicar los filtros", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`?ciclo=${CICLO_1}&departamento=${AREA.RRHH}`);

      assert.ok(cuerpo.opciones.departamentos.some((a) => a.id === AREA.ATENCION));
      assert.ok(cuerpo.opciones.departamentos.some((a) => a.id === AREA.RRHH));
      assert.ok(cuerpo.opciones.sucursales.some((s) => s.id === SUCURSAL.SOPOCACHI));
      assert.deepEqual(cuerpo.filtros, { departamento: AREA.RRHH, sucursal: null });
    });
  });

  describe("comparativo entre ciclos", () => {
    it("lista los ciclos cerrados en orden y calcula la variación del ciclo 2 respecto del 1", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`?ciclo=${CICLO_2}`);
      const posiciones = cuerpo.comparativo_ciclos.map((c) => c.id_ciclo);
      const uno = cuerpo.comparativo_ciclos.find((c) => c.id_ciclo === CICLO_1);
      const dos = cuerpo.comparativo_ciclos.find((c) => c.id_ciclo === CICLO_2);

      assert.ok(posiciones.indexOf(CICLO_1) < posiciones.indexOf(CICLO_2));
      assert.equal(uno.puntaje_promedio, 3.5);
      assert.equal(dos.puntaje_promedio, 3.43);
      assert.equal(dos.variacion, -0.07);
      assert.equal(dos.tendencia, "BAJA");
      assert.equal(dos.seleccionado, true);
      assert.equal(uno.seleccionado, false);
      assert.equal(uno.semaforo_cumplimiento, "ROJO");
      assert.equal(dos.semaforo_cumplimiento, "VERDE");
    });

    it("no incluye los ciclos que siguen abiertos", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard();

      assert.ok(!cuerpo.comparativo_ciclos.some((c) => c.id_ciclo === CICLO_ABIERTO));
    });

    it("con un filtro de área el comparativo recalcula todos los ciclos", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await dashboard(`?ciclo=${CICLO_2}&departamento=${AREA.RRHH}`);
      const uno = cuerpo.comparativo_ciclos.find((c) => c.id_ciclo === CICLO_1);
      const dos = cuerpo.comparativo_ciclos.find((c) => c.id_ciclo === CICLO_2);

      assert.equal(uno.puntaje_promedio, 5);
      assert.equal(dos.puntaje_promedio, 3);
      assert.equal(dos.variacion, -2);
    });
  });

  describe("errores y permisos", () => {
    it("un ciclo que aún está abierto responde 409", async (t) => {
      if (!requiere(t)) return;
      assert.equal((await dashboard(`?ciclo=${CICLO_ABIERTO}`)).estado, 409);
    });

    it("un ciclo que no existe responde 404", async (t) => {
      if (!requiere(t)) return;
      assert.equal((await dashboard(`?ciclo=${id(999)}`)).estado, 404);
    });

    it("los filtros que no son identificadores responden 400 y señalan el campo", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await dashboard("?ciclo=x&sucursal=y");

      assert.equal(estado, 400);
      assert.deepEqual(cuerpo.detalles.map((d) => d.campo), ["ciclo", "sucursal"]);
    });

    it("lo consultan el administrador y el gerente; los demás reciben 403 y sin rol 401", async (t) => {
      if (!requiere(t)) return;
      assert.equal((await api("/desempeno/dashboard", { rol: "admin" })).estado, 200);
      assert.equal((await api("/desempeno/dashboard", { rol: "gerente" })).estado, 200);
      for (const rol of ["supervisor", "empleado", "reclutador", "auditor"]) {
        assert.equal((await api("/desempeno/dashboard", { rol })).estado, 403, rol);
      }
      assert.equal((await api("/desempeno/dashboard", { rol: null })).estado, 401);
    });
  });
});

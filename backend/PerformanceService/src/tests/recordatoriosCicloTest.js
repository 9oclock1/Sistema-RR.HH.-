const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const modelo = require("../models/procesoCiclosModel");
const { enviarRecordatorioEvaluaciones } = require("../services/recordatoriosExternos");
const proceso = require("../services/procesoCiclosService");
const { DIAS_AVISO, agruparRecordatorios, armarAviso } = require("../utils/recordatoriosCiclo");

const id = (n) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const HOY = "2026-11-08";
const ADMIN = id(5);
const EVALUADOR_1 = id(21);
const EVALUADOR_2 = id(22);
const CICLO_A = id(111);
const CICLO_B = id(112);

// Fila como la devuelve procesoCiclosModel.listarRecordatoriosPendientes.
const fila = (n, { evaluador = EVALUADOR_1, ciclo = CICLO_A, nombres = "Carlos", apellidos = "Rojas Vargas", dias = 3, limite = "2026-11-11" } = {}) => ({
  id_evaluacion: id(1000 + n),
  id_empleado_evaluador: evaluador,
  id_ciclo: ciclo,
  ciclo: ciclo === CICLO_A ? "Evaluación de campaña de fin de año" : "Evaluación de personal nuevo 2026",
  fecha_limite: limite,
  id_empleado_creador: ADMIN,
  dias_restantes: dias,
  nombres,
  apellidos,
});

afterEach(() => mock.restoreAll());

describe("RF-03, criterio 3: recordatorio a 3 días de la fecha límite", () => {
  it("el aviso sale cuando faltan 3 días o menos", () => {
    assert.equal(DIAS_AVISO, 3);
  });

  describe("agrupación: un aviso por evaluador y ciclo", () => {
    it("junta las evaluaciones pendientes de un mismo evaluador en un solo aviso", () => {
      const grupos = agruparRecordatorios([
        fila(1, { nombres: "Carlos", apellidos: "Rojas" }),
        fila(2, { nombres: "Lucía", apellidos: "Flores" }),
      ]);
      assert.equal(grupos.length, 1);
      assert.deepEqual(grupos[0].evaluados, ["Carlos Rojas", "Lucía Flores"]);
      assert.deepEqual(grupos[0].idsEvaluaciones, [id(1001), id(1002)]);
      assert.equal(grupos[0].idEvaluador, EVALUADOR_1);
      assert.equal(grupos[0].idRemitente, ADMIN, "el remitente es quien programó el ciclo");
    });

    it("separa evaluadores distintos y también ciclos distintos del mismo evaluador", () => {
      const grupos = agruparRecordatorios([
        fila(1),
        fila(2, { evaluador: EVALUADOR_2 }),
        fila(3, { ciclo: CICLO_B }),
      ]);
      assert.equal(grupos.length, 3);
      assert.deepEqual(grupos.map((g) => [g.idEvaluador, g.idCiclo]), [
        [EVALUADOR_1, CICLO_A],
        [EVALUADOR_2, CICLO_A],
        [EVALUADOR_1, CICLO_B],
      ]);
    });

    it("sin evaluaciones pendientes no hay avisos", () => {
      assert.deepEqual(agruparRecordatorios([]), []);
    });
  });

  describe("texto del aviso", () => {
    const base = { ciclo: "Evaluación de campaña", fechaLimite: "2026-11-11", diasRestantes: 3, evaluados: ["Carlos Rojas"] };

    it("indica el ciclo, la cantidad, la fecha límite en formato día/mes/año y los días que faltan", () => {
      const { asunto, contenido } = armarAviso({ ...base, evaluados: ["Carlos Rojas", "Lucía Flores"] });
      assert.match(asunto, /Evaluación de campaña/);
      assert.match(contenido, /Tiene 2 evaluaciones de desempeño sin enviar/);
      assert.match(contenido, /11\/11\/2026/);
      assert.match(contenido, /faltan 3 días/);
      assert.match(contenido, /Carlos Rojas, Lucía Flores/);
      assert.match(contenido, /ya no se podrán editar/);
    });

    it("usa el singular con una sola evaluación", () => {
      assert.match(armarAviso(base).contenido, /Tiene 1 evaluación de desempeño sin enviar/);
    });

    it("dice «vence mañana» y «vence hoy» cuando falta un día o ninguno", () => {
      assert.match(armarAviso({ ...base, diasRestantes: 1 }).contenido, /vence mañana/);
      assert.match(armarAviso({ ...base, diasRestantes: 0 }).contenido, /vence hoy/);
    });

    it("con más de 10 colaboradores nombra a los 10 primeros y cuenta el resto", () => {
      const evaluados = Array.from({ length: 13 }, (_, i) => `Colaborador ${i + 1}`);
      const { contenido } = armarAviso({ ...base, evaluados });
      assert.match(contenido, /Tiene 13 evaluaciones/);
      assert.match(contenido, /Colaborador 10 y 3 más/);
      assert.doesNotMatch(contenido, /Colaborador 11/);
    });

    it("el asunto no supera los 150 caracteres que acepta NotificationService", () => {
      const { asunto } = armarAviso({ ...base, ciclo: "x".repeat(300) });
      assert.ok(asunto.length <= 150);
    });
  });

  describe("consulta de evaluaciones por recordar (condiciones del SQL)", () => {
    const consultar = async () => {
      const consultas = [];
      const db = { query: async (sql, parametros) => (consultas.push({ sql: sql.replace(/\s+/g, " "), parametros }), { rows: [] }) };
      await modelo.listarRecordatoriosPendientes(HOY, DIAS_AVISO, db);
      return consultas[0];
    };

    it("toma solo ciclos activos, evaluaciones pendientes o en borrador y sin recordatorio previo", async () => {
      const { sql } = await consultar();
      assert.match(sql, /c\.id_estado_ciclo = 2/, "ciclo ACTIVO");
      assert.match(sql, /e\.id_estado_evaluacion IN \(1, 2\)/, "PENDIENTE o BORRADOR: las enviadas y vencidas no se recuerdan");
      assert.match(sql, /e\.recordatorio_enviado_en IS NULL/, "no repite el aviso");
    });

    it("la ventana va de hoy a hoy + 3 días, ambos incluidos", async () => {
      const { sql, parametros } = await consultar();
      assert.match(sql, /c\.fecha_limite BETWEEN \$1::date AND \(\$1::date \+ \$2::int\)/);
      assert.deepEqual(parametros, [HOY, 3]);
    });

    it("solo se marca lo que sigue abierto y sin recordar", async () => {
      const consultas = [];
      const db = { query: async (sql, parametros) => (consultas.push({ sql: sql.replace(/\s+/g, " "), parametros }), { rowCount: 2 }) };
      assert.equal(await modelo.marcarRecordatorios([id(1001), id(1002)], db), 2);
      assert.match(consultas[0].sql, /recordatorio_enviado_en IS NULL/);
      assert.match(consultas[0].sql, /id_estado_evaluacion IN \(1, 2\)/);
      assert.deepEqual(consultas[0].parametros, [[id(1001), id(1002)]]);
    });
  });

  describe("envío y registro del recordatorio", () => {
    let avisos;
    let marcadas;

    const simular = ({ filas, entrega = async () => ({ ok: true, status: 201 }), marcar } = {}) => {
      avisos = [];
      marcadas = [];
      mock.method(console, "error", () => {});
      mock.method(modelo, "listarRecordatoriosPendientes", async (dia, dias) => {
        avisos.push({ consulta: [dia, dias] });
        return filas;
      });
      mock.method(modelo, "marcarRecordatorios", marcar ?? (async (ids) => (marcadas.push(ids), ids.length)));
      mock.method(globalThis, "fetch", async (url, init) => {
        const cuerpo = JSON.parse(init.body);
        avisos.push({ url, init, cuerpo });
        return entrega(cuerpo);
      });
    };
    const peticiones = () => avisos.filter((a) => a.url);

    beforeEach(() => mock.restoreAll());

    it("consulta con la ventana de 3 días a partir de la fecha de hoy", async () => {
      simular({ filas: [] });
      await proceso.recordar(HOY);
      assert.deepEqual(avisos[0].consulta, [HOY, 3]);
    });

    it("sin evaluaciones por recordar no envía nada", async () => {
      simular({ filas: [] });
      const resumen = await proceso.recordar(HOY);
      assert.deepEqual(resumen, { evaluadores: 0, enviados: 0, fallidos: 0, evaluaciones_marcadas: 0 });
      assert.equal(peticiones().length, 0);
    });

    it("envía un mensaje directo al evaluador a nombre de quien programó el ciclo", async () => {
      simular({ filas: [fila(1), fila(2, { nombres: "Lucía", apellidos: "Flores Choque" })] });
      await proceso.recordar(HOY);

      assert.equal(peticiones().length, 1, "un solo aviso para las dos evaluaciones del mismo evaluador");
      const { url, init, cuerpo } = peticiones()[0];
      assert.match(url, /\/comunicaciones\/directa$/);
      assert.equal(init.method, "POST");
      assert.equal(init.headers["X-Empleado-Id"], ADMIN);
      assert.equal(init.headers["X-Rol"], "admin");
      assert.equal(cuerpo.id_empleado_destinatario, EVALUADOR_1);
      assert.equal(cuerpo.prioridad, "ALTA");
      assert.equal(cuerpo.enlace, "/desempeno/evaluaciones");
      assert.equal(cuerpo.notificar_correo, true);
      assert.match(cuerpo.contenido, /Carlos Rojas Vargas, Lucía Flores Choque/);
    });

    it("marca el recordatorio solo después de que NotificationService confirmó la entrega", async () => {
      simular({ filas: [fila(1), fila(2)] });
      const resumen = await proceso.recordar(HOY);
      assert.deepEqual(marcadas, [[id(1001), id(1002)]]);
      assert.deepEqual(resumen, { evaluadores: 1, enviados: 1, fallidos: 0, evaluaciones_marcadas: 2 });
    });

    it("si NotificationService rechaza el aviso, no marca nada y queda para reintentar", async () => {
      simular({ filas: [fila(1)], entrega: async () => ({ ok: false, status: 400 }) });
      const resumen = await proceso.recordar(HOY);
      assert.deepEqual(marcadas, []);
      assert.deepEqual(resumen, { evaluadores: 1, enviados: 0, fallidos: 1, evaluaciones_marcadas: 0 });
    });

    it("si NotificationService no responde, no marca nada y el proceso no falla", async () => {
      simular({
        filas: [fila(1)],
        entrega: async () => {
          throw new TypeError("fetch failed");
        },
      });
      const resumen = await proceso.recordar(HOY);
      assert.deepEqual(marcadas, []);
      assert.equal(resumen.fallidos, 1);
    });

    it("un aviso fallido no impide enviar ni marcar los demás", async () => {
      simular({
        filas: [fila(1, { evaluador: EVALUADOR_1 }), fila(2, { evaluador: EVALUADOR_2 })],
        entrega: async (cuerpo) => ({ ok: cuerpo.id_empleado_destinatario !== EVALUADOR_1, status: 500 }),
      });
      const resumen = await proceso.recordar(HOY);
      assert.deepEqual(marcadas, [[id(1002)]]);
      assert.deepEqual(resumen, { evaluadores: 2, enviados: 1, fallidos: 1, evaluaciones_marcadas: 1 });
    });

    it("si falla el registro del recordatorio en la base, lo cuenta como fallido y sigue con los demás", async () => {
      simular({
        filas: [fila(1, { evaluador: EVALUADOR_1 }), fila(2, { evaluador: EVALUADOR_2 })],
        marcar: async (ids) => {
          if (ids.includes(id(1001))) throw new Error("conexión perdida");
          marcadas.push(ids);
          return ids.length;
        },
      });
      const resumen = await proceso.recordar(HOY);
      assert.deepEqual(marcadas, [[id(1002)]]);
      assert.deepEqual(resumen, { evaluadores: 2, enviados: 1, fallidos: 1, evaluaciones_marcadas: 1 });
    });

    it("el total de evaluaciones marcadas es correcto aunque los avisos terminen en desorden", async () => {
      const demoras = { [EVALUADOR_1]: 30, [EVALUADOR_2]: 5, [id(23)]: 15 };
      simular({
        filas: [fila(1), fila(2), fila(3, { evaluador: EVALUADOR_2 }), fila(4, { evaluador: id(23) }), fila(5, { evaluador: id(23) }), fila(6, { evaluador: id(23) })],
        marcar: async (ids) => {
          const evaluador = ids[0] === id(1001) ? EVALUADOR_1 : ids[0] === id(1003) ? EVALUADOR_2 : id(23);
          await new Promise((resolver) => setTimeout(resolver, demoras[evaluador]));
          return ids.length;
        },
      });
      const resumen = await proceso.recordar(HOY);
      assert.equal(resumen.evaluaciones_marcadas, 6, "2 + 1 + 3");
      assert.equal(resumen.enviados, 3);
    });

    it("no envía más de 5 avisos a la vez", async () => {
      let activos = 0;
      let maximo = 0;
      simular({
        filas: Array.from({ length: 12 }, (_, i) => fila(i + 1, { evaluador: id(100 + i) })),
        entrega: async () => {
          activos += 1;
          maximo = Math.max(maximo, activos);
          await new Promise((resolver) => setTimeout(resolver, 5));
          activos -= 1;
          return { ok: true, status: 201 };
        },
      });
      const resumen = await proceso.recordar(HOY);
      assert.equal(resumen.enviados, 12);
      assert.ok(maximo > 1 && maximo <= 5, `simultáneos: ${maximo}`);
    });
  });

  describe("cliente de NotificationService", () => {
    it("nunca lanza: informa si el aviso fue entregado", async () => {
      mock.method(console, "error", () => {});
      const aviso = { asunto: "a", contenido: "c" };
      mock.method(globalThis, "fetch", async () => ({ ok: true, status: 201 }));
      assert.deepEqual(await enviarRecordatorioEvaluaciones({ idRemitente: ADMIN, idEvaluador: EVALUADOR_1, aviso }), { entregado: true });
      globalThis.fetch.mock.restore();
      mock.method(globalThis, "fetch", async () => ({ ok: false, status: 503 }));
      assert.deepEqual(await enviarRecordatorioEvaluaciones({ idRemitente: ADMIN, idEvaluador: EVALUADOR_1, aviso }), { entregado: false });
    });
  });
});

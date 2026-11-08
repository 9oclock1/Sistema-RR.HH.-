const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const modelo = require("../models/evaluacionesModel");
const servicio = require("../services/evaluacionesService");
const { autorizarConsulta, promediar } = require("../utils/historialDesempeno");
const ayudas = require("./ayudas/plantillaEvaluacion");

const { uuid, EVALUADOR, OTRO_EVALUADOR } = ayudas;
const COLABORADOR = uuid("4", 31);
const OTRO_COLABORADOR = uuid("4", 32);

const PERIODO_2025 = { id_periodo: uuid("6", 1), periodo: "2025-S2", periodo_fecha_inicio: "2025-07-01", periodo_fecha_fin: "2025-12-31" };
const PERIODO_2026 = { id_periodo: uuid("6", 2), periodo: "2026-S1", periodo_fecha_inicio: "2026-01-01", periodo_fecha_fin: "2026-06-30" };

const fila = (n, cambios) => ({
  id_evaluacion: uuid("f", n),
  puntaje_final: null,
  enviada_en: "2026-07-02T19:30:00.000Z",
  fortalezas: null,
  aspectos_mejora: null,
  comentarios_generales: null,
  id_ciclo: uuid("1", 1),
  id_version: uuid("2", 1),
  ciclo: "Evaluación de desempeño 2026-S1",
  fecha_inicio: "2026-06-01",
  fecha_limite: "2026-07-03",
  cerrado_en: "2026-07-05T12:00:00.000Z",
  ...PERIODO_2026,
  evaluador_nombres: "Ana",
  evaluador_apellidos: "Pérez",
  plantilla: "Evaluación de personal de tienda",
  ...cambios,
});

// Dos evaluadores en 2026-S1 (87,78 y 85,56) y uno en 2025-S2 (85,56).
const HISTORIAL = [
  fila(1, { puntaje_final: 87.78, fortalezas: "Atiende con amabilidad.", aspectos_mejora: "Reclamos complejos." }),
  fila(2, { puntaje_final: 85.56, evaluador_nombres: "Luis", evaluador_apellidos: "Mamani", comentarios_generales: "Buen semestre." }),
  fila(3, {
    puntaje_final: 85.56,
    id_ciclo: uuid("1", 2),
    ciclo: "Evaluación de desempeño 2025-S2",
    fecha_inicio: "2025-12-01",
    fecha_limite: "2025-12-20",
    ...PERIODO_2025,
  }),
];
const RESPUESTAS = {
  [uuid("f", 1)]: ayudas.RESPUESTAS_DEL_SEED,
  [uuid("f", 2)]: ayudas.RESPUESTAS_OBLIGATORIAS,
  [uuid("f", 3)]: ayudas.RESPUESTAS_OBLIGATORIAS,
};

function simular({ historial = HISTORIAL, empleado = { id_empleado: COLABORADOR, nombres: "Carlos", apellidos: "Rojas" } } = {}) {
  const consultas = [];
  mock.method(modelo, "obtenerEmpleado", async () => empleado);
  mock.method(modelo, "listarHistorialDelEvaluado", async (id) => {
    consultas.push(id);
    return historial;
  });
  mock.method(modelo, "listarEstructuraDeEvaluaciones", async (ids) =>
    ids.flatMap((id) => ayudas.filas(RESPUESTAS[id]).map((f) => ({ ...f, id_evaluacion: id }))),
  );
  mock.method(modelo, "listarNiveles", async () => ayudas.NIVELES);
  mock.method(modelo, "listarCompromisosDeEvaluaciones", async () => [
    { id_evaluacion: uuid("f", 1), id_compromiso: uuid("9", 1), descripcion: "Curso de reclamos", fecha_objetivo: "2026-09-30" },
  ]);
  return consultas;
}

const consultar = (cambios = {}) =>
  servicio.obtenerHistorialDesempeno({ idSolicitante: COLABORADOR, rol: "empleado", idColaborador: COLABORADOR, ...cambios });

describe("Consulta de evaluaciones individuales", () => {
  beforeEach(() => mock.restoreAll());

  describe("criterio 1: puntaje final, desglose por competencia y retroalimentación de cada ciclo", () => {
    it("consolida el puntaje del ciclo como promedio de sus evaluaciones enviadas", async () => {
      simular();
      const { ciclos } = await consultar();
      assert.equal(ciclos.length, 2);
      const [s1] = ciclos;
      assert.equal(s1.nombre, "Evaluación de desempeño 2026-S1");
      assert.equal(s1.cantidad_evaluaciones, 2);
      assert.equal(s1.puntaje_final, 86.67);
    });

    it("desglosa por competencia con el promedio de los evaluadores", async () => {
      simular();
      const [s1] = (await consultar()).ciclos;
      assert.deepEqual(
        s1.competencias.map((c) => [c.competencia, c.puntaje, c.peso_porcentual]),
        [
          // Atención al cliente: seed (20·100+15·80+15·80)/50 = 88; obligatorias (20·100+15·80+15·60)/50 = 82.
          ["Atención al cliente", 85, 50],
          ["Trabajo en equipo", 90, 30],
          ["Puntualidad y orden", 87.5, 20],
        ],
      );
    });

    it("incluye la retroalimentación y los compromisos de cada evaluador del ciclo", async () => {
      simular();
      const [s1] = (await consultar()).ciclos;
      const [primera, segunda] = s1.evaluaciones;
      assert.equal(primera.evaluador.nombre_completo, "Ana Pérez");
      assert.equal(primera.retroalimentacion.fortalezas, "Atiende con amabilidad.");
      assert.equal(primera.retroalimentacion.compromisos[0].descripcion, "Curso de reclamos");
      assert.equal(segunda.evaluador.nombre_completo, "Luis Mamani");
      assert.equal(segunda.retroalimentacion.comentarios_generales, "Buen semestre.");
      assert.deepEqual(segunda.retroalimentacion.compromisos, []);
    });

    it("sin evaluaciones cerradas devuelve un historial vacío", async () => {
      simular({ historial: [] });
      const historial = await consultar();
      assert.deepEqual(historial.ciclos, []);
      assert.deepEqual(historial.evolucion, []);
      assert.equal(historial.resumen.puntaje_actual, null);
    });
  });

  describe("criterio 2: evolución del puntaje por periodo", () => {
    it("ordena los periodos cronológicamente con su puntaje y la variación respecto al anterior", async () => {
      simular();
      const { evolucion, resumen } = await consultar();
      assert.deepEqual(
        evolucion.map((p) => [p.nombre, p.puntaje, p.variacion]),
        [
          ["2025-S2", 85.56, null],
          ["2026-S1", 86.67, 1.11],
        ],
      );
      assert.equal(resumen.puntaje_actual, 86.67);
      assert.equal(resumen.variacion, 1.11);
      assert.equal(resumen.promedio_historico, 86.12);
      assert.equal(resumen.cantidad_ciclos, 2);
    });

    it("promedia sin errores de coma flotante", () => {
      assert.equal(promediar([0.1, 0.2]), 0.15);
      assert.equal(promediar([]), null);
    });
  });

  describe("criterio 3: RBAC al consultar las evaluaciones de otra persona", () => {
    it("rechaza (403) a un colaborador que consulta a otro y no lee sus datos", async () => {
      const consultas = simular();
      await assert.rejects(
        consultar({ idColaborador: OTRO_COLABORADOR }),
        (error) => error.estado === 403 && /no le permite consultar/.test(error.message),
      );
      assert.deepEqual(consultas, []);
    });

    for (const rol of ["empleado", "supervisor", "reclutador", "auditor", null]) {
      it(`rechaza el rol ${rol ?? "ausente"} para otro colaborador`, () => {
        assert.throws(
          () => autorizarConsulta({ idSolicitante: EVALUADOR, rol, idColaborador: OTRO_EVALUADOR }),
          (error) => error.estado === 403,
        );
      });
    }

    it("permite a RRHH (admin y gerente) consultar a otro colaborador", async () => {
      for (const rol of ["admin", "gerente"]) {
        const consultas = simular();
        const historial = await consultar({ idSolicitante: EVALUADOR, rol, idColaborador: COLABORADOR });
        assert.deepEqual(consultas, [COLABORADOR]);
        assert.equal(historial.colaborador.nombre_completo, "Carlos Rojas");
        mock.restoreAll();
      }
    });

    it("el propio colaborador siempre puede consultarse, sin importar el rol", () => {
      assert.deepEqual(autorizarConsulta({ idSolicitante: COLABORADOR, rol: null, idColaborador: COLABORADOR.toUpperCase() }), {
        idColaborador: COLABORADOR,
        propio: true,
      });
    });

    it("RRHH recibe 404 si el colaborador no existe", async () => {
      simular({ empleado: null });
      await assert.rejects(consultar({ idSolicitante: EVALUADOR, rol: "admin" }), (error) => error.estado === 404);
    });

    it("rechaza (400) un identificador de colaborador inválido", () => {
      assert.throws(
        () => autorizarConsulta({ idSolicitante: COLABORADOR, rol: "admin", idColaborador: "abc" }),
        (error) => error.estado === 400,
      );
    });
  });
});

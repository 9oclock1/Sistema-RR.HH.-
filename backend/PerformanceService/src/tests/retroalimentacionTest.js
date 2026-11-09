const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// La transacción entrega un cliente falso: el servicio se prueba sin PostgreSQL.
const clienteFalso = { query: async () => ({ rows: [] }) };
const rutaTransaccion = require.resolve(path.join(__dirname, "../config/transaccion"));
require.cache[rutaTransaccion] = {
  id: rutaTransaccion,
  filename: rutaTransaccion,
  loaded: true,
  exports: { enTransaccion: async (trabajo) => trabajo(clienteFalso) },
};

const modelo = require("../models/evaluacionesModel");
const servicio = require("../services/evaluacionesService");
const { validarRetroalimentacion } = require("../utils/retroalimentacion");
const ayudas = require("./ayudas/plantillaEvaluacion");

const { EVALUADOR, OTRO_EVALUADOR, ID_EVALUACION, uuid } = ayudas;
const EVALUADO = uuid("4", 31);
const ACTUALIZADO_EN = "2030-12-01T11:00:00.000Z";

const RETRO = {
  fortalezas: "  Atiende con amabilidad.  ",
  aspectos_mejora: "Mejorar el manejo de reclamos.",
  comentarios_generales: "",
  compromisos: [
    { descripcion: "Curso de atención de reclamos", fecha_objetivo: "2031-03-31" },
    { descripcion: "Acompañar a un compañero nuevo", fecha_objetivo: "2031-01-15" },
  ],
};

describe("KAN-26: retroalimentación cualitativa final", () => {
  let llamadas;

  const simular = ({ evaluacion = {}, respuestas = ayudas.RESPUESTAS_OBLIGATORIAS, guardada = ACTUALIZADO_EN, compromisos = [] } = {}) => {
    llamadas = { textos: [], compromisos: [] };
    let guardados = compromisos;
    mock.method(modelo, "obtenerEvaluacion", async () => ayudas.evaluacion({ evaluador_nombres: "Ana", evaluador_apellidos: "Pérez", ...evaluacion }));
    mock.method(modelo, "listarEstructura", async () => ayudas.filas(respuestas));
    mock.method(modelo, "listarNiveles", async () => ayudas.NIVELES);
    mock.method(modelo, "cambiarEstadoAbierta", async () => ACTUALIZADO_EN);
    mock.method(modelo, "guardarRetroalimentacion", async (id, datos) => {
      llamadas.textos.push(datos);
      return guardada;
    });
    mock.method(modelo, "reemplazarCompromisos", async (id, lista) => {
      llamadas.compromisos.push(lista);
      guardados = lista
        .map((c, i) => ({ id_compromiso: uuid("9", i + 1), descripcion: c.descripcion, fecha_objetivo: c.fechaObjetivo }))
        .sort((a, b) => a.fecha_objetivo.localeCompare(b.fecha_objetivo));
    });
    mock.method(modelo, "listarCompromisos", async () => guardados);
  };

  beforeEach(() => mock.restoreAll());

  describe("criterio 1: con los puntajes completos registra fortalezas, aspectos de mejora y comentarios", () => {
    it("guarda los tres textos recortados y deja en null los vacíos", async () => {
      simular();
      const respuesta = await servicio.guardarRetroalimentacion(EVALUADOR, ID_EVALUACION, RETRO);
      assert.equal(llamadas.textos.length, 1);
      assert.equal(llamadas.textos[0].fortalezas, "Atiende con amabilidad.");
      assert.equal(llamadas.textos[0].aspectos_mejora, "Mejorar el manejo de reclamos.");
      assert.equal(llamadas.textos[0].comentarios_generales, null);
      assert.equal(respuesta.actualizado_en, ACTUALIZADO_EN);
      assert.equal(respuesta.retroalimentacion.fortalezas, "Atiende con amabilidad.");
    });

    it("rechaza (422) si faltan preguntas obligatorias y no guarda nada", async () => {
      simular({ respuestas: { 1: 5, 2: 4 } });
      await assert.rejects(
        servicio.guardarRetroalimentacion(EVALUADOR, ID_EVALUACION, RETRO),
        (error) => error.estado === 422 && /Complete los puntajes/.test(error.message) && error.detalles.length === 3,
      );
      assert.equal(llamadas.textos.length, 0);
      assert.equal(llamadas.compromisos.length, 0);
    });

    it("solo el evaluador asignado puede registrarla (403)", async () => {
      simular({ evaluacion: { id_empleado_evaluador: OTRO_EVALUADOR } });
      await assert.rejects(servicio.guardarRetroalimentacion(EVALUADOR, ID_EVALUACION, RETRO), (e) => e.estado === 403);
      assert.equal(llamadas.textos.length, 0);
    });

    it("el formulario del evaluador incluye la retroalimentación guardada", async () => {
      simular({
        evaluacion: { fortalezas: "Puntual", aspectos_mejora: null, comentarios_generales: "Bien" },
        compromisos: [{ id_compromiso: uuid("9", 1), descripcion: "Curso", fecha_objetivo: "2031-01-01" }],
      });
      const formulario = await servicio.obtenerFormulario(EVALUADOR, ID_EVALUACION);
      assert.deepEqual(formulario.retroalimentacion, {
        fortalezas: "Puntual",
        aspectos_mejora: null,
        comentarios_generales: "Bien",
        compromisos: [{ id_compromiso: uuid("9", 1), descripcion: "Curso", fecha_objetivo: "2031-01-01" }],
      });
    });

    it("rechaza textos que no son cadenas o superan el largo máximo", () => {
      assert.throws(
        () => validarRetroalimentacion({ fortalezas: 5, aspectos_mejora: "x".repeat(4001) }),
        (e) => e.estado === 400 && e.detalles.map((d) => d.campo).join() === "fortalezas,aspectos_mejora",
      );
    });
  });

  describe("criterio 2: cada compromiso queda con descripción y fecha objetivo", () => {
    it("reemplaza los compromisos con su descripción y fecha objetivo", async () => {
      simular();
      const respuesta = await servicio.guardarRetroalimentacion(EVALUADOR, ID_EVALUACION, RETRO);
      assert.deepEqual(
        llamadas.compromisos[0].map((c) => [c.descripcion, c.fechaObjetivo]),
        [
          ["Curso de atención de reclamos", "2031-03-31"],
          ["Acompañar a un compañero nuevo", "2031-01-15"],
        ],
      );
      assert.deepEqual(
        respuesta.retroalimentacion.compromisos.map((c) => c.fecha_objetivo),
        ["2031-01-15", "2031-03-31"],
      );
      assert.ok(respuesta.retroalimentacion.compromisos.every((c) => c.id_compromiso && c.descripcion));
    });

    it("una lista vacía quita los compromisos guardados", async () => {
      simular();
      await servicio.guardarRetroalimentacion(EVALUADOR, ID_EVALUACION, { ...RETRO, compromisos: [] });
      assert.deepEqual(llamadas.compromisos, [[]]);
    });

    it("exige descripción y una fecha válida en cada compromiso (400)", () => {
      assert.throws(
        () =>
          validarRetroalimentacion({
            compromisos: [
              { descripcion: "  ", fecha_objetivo: "2031-01-01" },
              { descripcion: "Curso", fecha_objetivo: "2031-02-30" },
              { descripcion: "Curso" },
            ],
          }),
        (e) =>
          e.estado === 400 &&
          JSON.stringify(e.detalles.map((d) => d.campo)) ===
            JSON.stringify(["compromisos[0].descripcion", "compromisos[1].fecha_objetivo", "compromisos[2].fecha_objetivo"]),
      );
    });

    it("no acepta una fecha objetivo anterior a hoy", async () => {
      simular();
      await assert.rejects(
        servicio.guardarRetroalimentacion(EVALUADOR, ID_EVALUACION, {
          compromisos: [{ descripcion: "Curso", fecha_objetivo: "2030-11-30" }],
        }),
        (e) => e.estado === 400 && e.detalles[0].campo === "compromisos[0].fecha_objetivo",
      );
      assert.equal(llamadas.compromisos.length, 0);
    });
  });

  describe("criterio 3: el colaborador consulta la retroalimentación sin poder editarla", () => {
    const enviada = { id_estado_evaluacion: 3, puntaje_final: 87.78, enviada_en: "2030-12-02T10:00:00.000Z" };

    it("el colaborador ve sus resultados con la retroalimentación y sin edición", async () => {
      simular({
        respuestas: ayudas.RESPUESTAS_DEL_SEED,
        evaluacion: { ...enviada, fortalezas: "Puntual", aspectos_mejora: "Reclamos", comentarios_generales: "Bien" },
        compromisos: [{ id_compromiso: uuid("9", 1), descripcion: "Curso", fecha_objetivo: "2031-01-01" }],
      });
      const vista = await servicio.obtenerMiResultado(EVALUADO, ID_EVALUACION);
      assert.equal(vista.editable, false);
      assert.equal(vista.puntaje_final, 87.78);
      assert.equal(vista.evaluador.nombre_completo, "Ana Pérez");
      assert.equal(vista.retroalimentacion.fortalezas, "Puntual");
      assert.equal(vista.retroalimentacion.compromisos.length, 1);
    });

    it("no muestra resultados de una evaluación que aún no se envió (409)", async () => {
      simular();
      await assert.rejects(servicio.obtenerMiResultado(EVALUADO, ID_EVALUACION), (e) => e.estado === 409);
    });

    it("un empleado no puede ver los resultados de otro (403)", async () => {
      simular({ evaluacion: enviada });
      await assert.rejects(servicio.obtenerMiResultado(OTRO_EVALUADOR, ID_EVALUACION), (e) => e.estado === 403);
    });

    it("tras el envío la retroalimentación ya no se puede modificar (409)", async () => {
      simular({ evaluacion: enviada });
      await assert.rejects(
        servicio.guardarRetroalimentacion(EVALUADOR, ID_EVALUACION, RETRO),
        (e) => e.estado === 409 && /ya fue enviada/.test(e.message),
      );
      assert.equal(llamadas.textos.length, 0);
    });

    it("el colaborador no puede escribir la retroalimentación de su propia evaluación (403)", async () => {
      simular();
      await assert.rejects(servicio.guardarRetroalimentacion(EVALUADO, ID_EVALUACION, RETRO), (e) => e.estado === 403);
    });

    it("lista solo las evaluaciones enviadas del colaborador", async () => {
      let pedido;
      mock.method(modelo, "listarResultadosDelEvaluado", async (id) => {
        pedido = id;
        return [
          {
            id_evaluacion: ID_EVALUACION,
            id_ciclo: uuid("1", 1),
            ciclo: "2030-S2",
            fecha_limite: "2030-12-31",
            plantilla: "Personal de tienda",
            evaluador_nombres: "Ana",
            evaluador_apellidos: "Pérez",
            puntaje_final: 87.78,
            enviada_en: enviada.enviada_en,
            compromisos: 2,
          },
        ];
      });
      const lista = await servicio.listarMisResultados(EVALUADO);
      assert.equal(pedido, EVALUADO);
      assert.equal(lista[0].evaluador.nombre_completo, "Ana Pérez");
      assert.equal(lista[0].compromisos, 2);
    });
  });
});

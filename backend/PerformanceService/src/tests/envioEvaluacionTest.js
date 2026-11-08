const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// La transacción entrega un cliente falso: el servicio se prueba sin PostgreSQL.
const clienteFalso = { query: async () => ({ rows: [] }) };
const rutaTransaccion = require.resolve(
  path.join(__dirname, "../config/transaccion"),
);
require.cache[rutaTransaccion] = {
  id: rutaTransaccion,
  filename: rutaTransaccion,
  loaded: true,
  exports: { enTransaccion: async (trabajo) => trabajo(clienteFalso) },
};

const { ESTADO_EVALUACION } = require("../utils/evaluaciones");
const modelo = require("../models/evaluacionesModel");
const servicio = require("../services/evaluacionesService");
const ayudas = require("./ayudas/plantillaEvaluacion");

const { EVALUADOR, ID_EVALUACION, idPregunta } = ayudas;
const ENVIADA_EN = "2030-12-01T10:30:00.000Z";

describe("RF-04: servicio de envío de la evaluación (base simulada)", () => {
  let llamadas;
  let almacen;

  // Simula el modelo: `respuestas` son las ya guardadas y `enviada` es lo que devuelve la marca de envío
  // (null si otra solicitud se adelantó).
  const simular = ({
    evaluacion = {},
    respuestas = {},
    enviada = ENVIADA_EN,
    filas,
  } = {}) => {
    almacen = { ...respuestas };
    llamadas = { obtener: [], estado: [], enviar: [], guardar: 0 };
    const fila = ayudas.evaluacion(evaluacion);
    mock.method(modelo, "obtenerEvaluacion", async (id, opciones) => {
      llamadas.obtener.push({ id, opciones });
      return fila;
    });
    mock.method(
      modelo,
      "listarEstructura",
      async () => filas ?? ayudas.filas(almacen),
    );
    mock.method(modelo, "listarNiveles", async () => ayudas.NIVELES);
    mock.method(modelo, "listarCompromisos", async () => []);
    mock.method(modelo, "cambiarEstadoAbierta", async (id, estado) => {
      llamadas.estado.push(estado);
      return "2030-12-01T10:05:00.000Z";
    });
    mock.method(modelo, "guardarRespuestas", async () => {
      llamadas.guardar += 1;
    });
    mock.method(modelo, "marcarEnviada", async (id, puntaje) => {
      llamadas.enviar.push({ id, puntaje });
      return enviada;
    });
  };

  beforeEach(() => mock.restoreAll());

  describe("criterio 3: puntaje ponderado y bloqueo", () => {
    it("con todo lo obligatorio respondido calcula el puntaje final, lo congela y marca la evaluación como enviada", async () => {
      simular({ respuestas: ayudas.RESPUESTAS_OBLIGATORIAS });
      const resultado = await servicio.enviar(EVALUADOR, ID_EVALUACION);

      assert.deepEqual(llamadas.enviar, [
        { id: ID_EVALUACION, puntaje: 85.56 },
      ]);
      assert.equal(resultado.estado_codigo, "ENVIADA");
      assert.equal(resultado.puntaje_final, 85.56);
      assert.equal(resultado.enviada_en, ENVIADA_EN);
      assert.deepEqual(resultado.progreso, {
        total: 6,
        respondidas: 5,
        obligatorias_total: 5,
        obligatorias_respondidas: 5,
      });
    });

    it("devuelve el desglose por competencia con su peso y su puntaje", async () => {
      simular({ respuestas: ayudas.RESPUESTAS_OBLIGATORIAS });
      const { resultado } = await servicio.enviar(EVALUADOR, ID_EVALUACION);
      assert.deepEqual(
        resultado.secciones.map((s) => [
          s.competencia,
          s.peso_porcentual,
          s.puntaje,
        ]),
        [
          ["Atención al cliente", 50, 82],
          ["Trabajo en equipo", 30, 80],
          ["Puntualidad y orden", 20, 100],
        ],
      );
      assert.equal(resultado.puntaje_final, 85.56);
    });

    it("la pregunta opcional respondida entra en el cálculo y la que quedó vacía no penaliza", async () => {
      simular({ respuestas: { ...ayudas.RESPUESTAS_OBLIGATORIAS, 5: 5 } });
      assert.equal(
        (await servicio.enviar(EVALUADOR, ID_EVALUACION)).puntaje_final,
        87,
      );

      mock.restoreAll();
      simular({ respuestas: ayudas.RESPUESTAS_OBLIGATORIAS });
      assert.equal(
        (await servicio.enviar(EVALUADOR, ID_EVALUACION)).puntaje_final,
        85.56,
      );
    });

    it("el mismo formulario con las mismas respuestas siempre da el mismo puntaje", async () => {
      simular({ respuestas: ayudas.RESPUESTAS_DEL_SEED });
      const primero = (await servicio.enviar(EVALUADOR, ID_EVALUACION))
        .puntaje_final;
      mock.restoreAll();
      simular({ respuestas: ayudas.RESPUESTAS_DEL_SEED });
      const segundo = (await servicio.enviar(EVALUADOR, ID_EVALUACION))
        .puntaje_final;
      assert.equal(primero, 87.78);
      assert.equal(segundo, primero);
    });

    it("toma la evaluación con bloqueo para que ningún autoguardado se cuele durante el envío", async () => {
      simular({ respuestas: ayudas.RESPUESTAS_OBLIGATORIAS });
      await servicio.enviar(EVALUADOR, ID_EVALUACION);
      assert.equal(llamadas.obtener[0].opciones.bloquear, true);
    });
  });

  describe("criterio 4: faltan obligatorias", () => {
    it("impide el envío (422) y lista las preguntas obligatorias pendientes", async () => {
      simular({ respuestas: { 1: 5, 2: 4 } });
      await assert.rejects(
        servicio.enviar(EVALUADOR, ID_EVALUACION),
        (error) =>
          error.estado === 422 &&
          /Faltan 3 pregunta\(s\) obligatoria\(s\)/.test(error.message) &&
          JSON.stringify(error.detalles.map((d) => d.id_pregunta)) ===
            JSON.stringify([idPregunta(3), idPregunta(4), idPregunta(6)]) &&
          error.detalles.every(
            (d) => d.campo === d.id_pregunta && /«.+»/.test(d.mensaje),
          ),
      );
      assert.equal(llamadas.enviar.length, 0, "no se marca como enviada");
    });

    it("no cambia el estado de la evaluación ni toca las respuestas ya guardadas", async () => {
      simular({
        respuestas: { 1: 5, 2: 4 },
        evaluacion: { id_estado_evaluacion: ESTADO_EVALUACION.BORRADOR },
      });
      await assert.rejects(servicio.enviar(EVALUADOR, ID_EVALUACION), {
        estado: 422,
      });
      assert.equal(llamadas.estado.length, 0);
      assert.equal(llamadas.guardar, 0);
      assert.deepEqual(almacen, { 1: 5, 2: 4 });
    });

    it("una sola obligatoria pendiente basta para impedirlo", async () => {
      simular({ respuestas: { 1: 5, 2: 4, 3: 3, 4: 4 } });
      await assert.rejects(
        servicio.enviar(EVALUADOR, ID_EVALUACION),
        (e) =>
          e.estado === 422 &&
          e.detalles.length === 1 &&
          e.detalles[0].id_pregunta === idPregunta(6),
      );
    });

    it("con el formulario vacío señala todas las obligatorias, no la opcional", async () => {
      simular();
      await assert.rejects(
        servicio.enviar(EVALUADOR, ID_EVALUACION),
        (e) =>
          e.estado === 422 &&
          e.detalles.length === 5 &&
          !e.detalles.some((d) => d.id_pregunta === idPregunta(5)),
      );
    });

    it("sin ninguna respuesta no hay puntaje que calcular, aunque nada sea obligatorio", async () => {
      const soloOpcional = ayudas
        .filas({})
        .filter((f) => f.id_pregunta === idPregunta(5));
      simular({ filas: soloOpcional });
      await assert.rejects(
        servicio.enviar(EVALUADOR, ID_EVALUACION),
        (e) => e.estado === 422 && /al menos una pregunta/.test(e.message),
      );
      assert.equal(llamadas.enviar.length, 0);
    });
  });

  describe("bloqueo tras el envío", () => {
    it("una evaluación ya enviada no se puede enviar de nuevo (409)", async () => {
      simular({
        evaluacion: {
          id_estado_evaluacion: ESTADO_EVALUACION.ENVIADA,
          puntaje_final: 85.56,
        },
        respuestas: ayudas.RESPUESTAS_OBLIGATORIAS,
      });
      await assert.rejects(
        servicio.enviar(EVALUADOR, ID_EVALUACION),
        (e) => e.estado === 409 && /ya fue enviada/.test(e.message),
      );
      assert.equal(
        llamadas.enviar.length,
        0,
        "el puntaje congelado no se recalcula",
      );
    });

    it("si otra solicitud la envió justo antes, esta responde 409 y no pisa el resultado", async () => {
      simular({ respuestas: ayudas.RESPUESTAS_OBLIGATORIAS, enviada: null });
      await assert.rejects(servicio.enviar(EVALUADOR, ID_EVALUACION), {
        estado: 409,
      });
    });

    it("fuera de plazo no se envía: queda vencida (409)", async () => {
      simular({
        evaluacion: { fecha_limite: "2030-11-30", hoy: "2030-12-01" },
        respuestas: ayudas.RESPUESTAS_OBLIGATORIAS,
      });
      await assert.rejects(
        servicio.enviar(EVALUADOR, ID_EVALUACION),
        (e) => e.estado === 409 && /venció/.test(e.message),
      );
      assert.deepEqual(llamadas.estado, [ESTADO_EVALUACION.VENCIDA]);
      assert.equal(llamadas.enviar.length, 0);
    });

    it("el día de la fecha límite todavía se puede enviar", async () => {
      simular({
        evaluacion: { fecha_limite: "2030-12-01", hoy: "2030-12-01" },
        respuestas: ayudas.RESPUESTAS_OBLIGATORIAS,
      });
      assert.equal(
        (await servicio.enviar(EVALUADOR, ID_EVALUACION)).estado_codigo,
        "ENVIADA",
      );
    });

    it("solo el evaluador asignado puede enviar (403) y una evaluación inexistente responde 404", async () => {
      simular({ respuestas: ayudas.RESPUESTAS_OBLIGATORIAS });
      await assert.rejects(
        servicio.enviar(ayudas.OTRO_EVALUADOR, ID_EVALUACION),
        { estado: 403 },
      );
      await assert.rejects(servicio.enviar(EVALUADOR, "no-es-uuid"), {
        estado: 404,
      });
      assert.equal(llamadas.enviar.length, 0);
    });
  });

  describe("formulario que se muestra al evaluador (obtenerFormulario)", () => {
    it("una evaluación abierta se puede editar y no trae resultado", async () => {
      simular({ respuestas: { 1: 5 } });
      const formulario = await servicio.obtenerFormulario(
        EVALUADOR,
        ID_EVALUACION,
      );
      assert.equal(formulario.editable, true);
      assert.equal(formulario.estado_codigo, "PENDIENTE");
      assert.equal(formulario.resultado, null);
      assert.equal(formulario.secciones.length, 3);
      assert.deepEqual(formulario.progreso, {
        total: 6,
        respondidas: 1,
        obligatorias_total: 5,
        obligatorias_respondidas: 1,
      });
      assert.equal(
        llamadas.obtener[0].opciones.bloquear,
        false,
        "leer no bloquea la fila",
      );
    });

    it("una evaluación enviada queda de solo lectura y muestra el puntaje congelado, no uno recalculado", async () => {
      simular({
        evaluacion: {
          id_estado_evaluacion: ESTADO_EVALUACION.ENVIADA,
          puntaje_final: 90.12,
          enviada_en: ENVIADA_EN,
        },
        respuestas: ayudas.RESPUESTAS_OBLIGATORIAS,
      });
      const formulario = await servicio.obtenerFormulario(
        EVALUADOR,
        ID_EVALUACION,
      );
      assert.equal(formulario.editable, false);
      assert.equal(formulario.estado_codigo, "ENVIADA");
      assert.equal(formulario.resultado.puntaje_final, 90.12);
      assert.equal(formulario.resultado.secciones.length, 3);
      assert.equal(formulario.enviada_en, ENVIADA_EN);
    });

    it("una evaluación cuyo plazo pasó se muestra como vencida y sin edición, aunque nadie la haya marcado aún", async () => {
      simular({
        evaluacion: { fecha_limite: "2030-11-30", hoy: "2030-12-01" },
      });
      const formulario = await servicio.obtenerFormulario(
        EVALUADOR,
        ID_EVALUACION,
      );
      assert.equal(formulario.estado_codigo, "VENCIDA");
      assert.equal(formulario.editable, false);
      assert.equal(formulario.resultado, null);
      assert.equal(llamadas.estado.length, 0, "leer no modifica nada");
    });

    it("otro evaluador no puede abrirla (403)", async () => {
      simular();
      await assert.rejects(
        servicio.obtenerFormulario(ayudas.OTRO_EVALUADOR, ID_EVALUACION),
        { estado: 403 },
      );
    });
  });
});

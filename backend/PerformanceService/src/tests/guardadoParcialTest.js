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

const {
  ESTADO_EVALUACION,
  validarRespuestas,
} = require("../utils/evaluaciones");
const modelo = require("../models/evaluacionesModel");
const servicio = require("../services/evaluacionesService");
const ayudas = require("./ayudas/plantillaEvaluacion");

const { EVALUADOR, ID_EVALUACION, idPregunta, nivelDe } = ayudas;

const capturar = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
};

const cuerpo = (...respuestas) => ({
  respuestas: respuestas.map(([n, valor]) => ({
    id_pregunta: idPregunta(n),
    id_nivel: valor === null ? null : nivelDe(n, valor),
  })),
});

describe("RF-04: validación del cuerpo del guardado parcial (validarRespuestas)", () => {
  it("acepta una lista de respuestas, normaliza los ids y conserva null para borrar", () => {
    const lista = validarRespuestas({
      respuestas: [
        {
          id_pregunta: idPregunta(1).toUpperCase(),
          id_nivel: nivelDe(1, 5).toUpperCase(),
        },
        { id_pregunta: idPregunta(2), id_nivel: null },
      ],
    });
    assert.deepEqual(lista, [
      { idPregunta: idPregunta(1), idNivel: nivelDe(1, 5), posicion: 0 },
      { idPregunta: idPregunta(2), idNivel: null, posicion: 1 },
    ]);
  });

  it("exige al menos una respuesta", () => {
    for (const malo of [
      undefined,
      null,
      {},
      { respuestas: [] },
      { respuestas: "x" },
    ]) {
      const error = capturar(() => validarRespuestas(malo));
      assert.equal(error.estado, 400);
      assert.equal(error.detalles[0].campo, "respuestas");
    }
  });

  it("limita cuántas respuestas entran en una sola solicitud", () => {
    const demasiadas = Array.from({ length: 301 }, () => ({
      id_pregunta: idPregunta(1),
      id_nivel: null,
    }));
    assert.equal(
      capturar(() => validarRespuestas({ respuestas: demasiadas })).estado,
      400,
    );
  });

  it("indica qué respuesta y qué campo vienen mal", () => {
    const error = capturar(() =>
      validarRespuestas({
        respuestas: [
          { id_pregunta: "no-es-uuid", id_nivel: null },
          { id_pregunta: idPregunta(2) },
          { id_pregunta: idPregunta(3), id_nivel: 4 },
        ],
      }),
    );
    assert.equal(error.estado, 400);
    assert.deepEqual(
      error.detalles.map((d) => d.campo),
      [
        "respuestas[0].id_pregunta",
        "respuestas[1].id_nivel",
        "respuestas[2].id_nivel",
      ],
    );
  });

  it("rechaza la misma pregunta repetida en una solicitud", () => {
    const error = capturar(() => validarRespuestas(cuerpo([1, 3], [1, 5])));
    assert.equal(error.estado, 400);
    assert.deepEqual(
      error.detalles.map((d) => d.campo),
      ["respuestas[1].id_pregunta"],
    );
  });
});

describe("RF-04 criterio 2: servicio de guardado parcial (base simulada)", () => {
  let llamadas;
  let almacen;

  // Simula el modelo con una evaluación abierta y un almacén en memoria de las respuestas guardadas.
  const simular = ({ evaluacion = {}, respuestas = {} } = {}) => {
    almacen = { ...respuestas };
    llamadas = { obtener: [], guardar: [], borrar: [], estado: [], enviar: [] };
    const fila = ayudas.evaluacion(evaluacion);
    mock.method(modelo, "obtenerEvaluacion", async (id, opciones) => {
      llamadas.obtener.push({ id, opciones });
      return fila;
    });
    mock.method(modelo, "listarEstructura", async () => ayudas.filas(almacen));
    mock.method(modelo, "listarNiveles", async () => ayudas.NIVELES);
    mock.method(modelo, "guardarRespuestas", async (id, items) => {
      llamadas.guardar.push(
        items.map(({ idPregunta, idNivel }) => ({ idPregunta, idNivel })),
      );
      for (const { idPregunta: p, idNivel } of items)
        almacen[ayudas.numeroDePregunta(p)] = ayudas.valorDeNivel(idNivel);
    });
    mock.method(modelo, "borrarRespuestas", async (id, ids) => {
      llamadas.borrar.push(ids);
      for (const p of ids) delete almacen[ayudas.numeroDePregunta(p)];
    });
    mock.method(
      modelo,
      "contarRespuestas",
      async () => Object.keys(almacen).length,
    );
    mock.method(modelo, "cambiarEstadoAbierta", async (id, estado) => {
      llamadas.estado.push(estado);
      return "2030-12-01T10:05:00.000Z";
    });
    mock.method(modelo, "marcarEnviada", async (id, puntaje) => {
      llamadas.enviar.push({ id, puntaje });
      return "2030-12-01T10:30:00.000Z";
    });
  };

  beforeEach(() => mock.restoreAll());

  describe("guardado como borrador", () => {
    it("guarda solo lo enviado, deja la evaluación en borrador y no la envía", async () => {
      simular();
      const resultado = await servicio.guardarRespuestas(
        EVALUADOR,
        ID_EVALUACION,
        cuerpo([1, 5], [2, 4]),
      );

      assert.deepEqual(llamadas.guardar, [
        [
          { idPregunta: idPregunta(1), idNivel: nivelDe(1, 5) },
          { idPregunta: idPregunta(2), idNivel: nivelDe(2, 4) },
        ],
      ]);
      assert.deepEqual(llamadas.estado, [ESTADO_EVALUACION.BORRADOR]);
      assert.equal(llamadas.enviar.length, 0, "guardar nunca envía");
      assert.equal(resultado.estado_codigo, "BORRADOR");
      assert.equal(resultado.actualizado_en, "2030-12-01T10:05:00.000Z");
      assert.deepEqual(resultado.progreso, {
        total: 6,
        respondidas: 2,
        obligatorias_total: 5,
        obligatorias_respondidas: 2,
      });
    });

    it("toma la fila de la evaluación con bloqueo para que un autoguardado no se cruce con el envío", async () => {
      simular();
      await servicio.guardarRespuestas(
        EVALUADOR,
        ID_EVALUACION,
        cuerpo([1, 5]),
      );
      assert.equal(llamadas.obtener[0].id, ID_EVALUACION);
      assert.equal(llamadas.obtener[0].opciones.bloquear, true);
    });

    it("cambiar una respuesta no toca las demás", async () => {
      simular({
        respuestas: { 1: 3, 2: 4 },
        evaluacion: { id_estado_evaluacion: ESTADO_EVALUACION.BORRADOR },
      });
      await servicio.guardarRespuestas(
        EVALUADOR,
        ID_EVALUACION,
        cuerpo([1, 5]),
      );
      assert.equal(llamadas.guardar[0].length, 1);
      assert.deepEqual(almacen, { 1: 5, 2: 4 });
    });

    it("repetir el mismo guardado es inofensivo: queda una sola respuesta por pregunta", async () => {
      simular();
      await servicio.guardarRespuestas(
        EVALUADOR,
        ID_EVALUACION,
        cuerpo([1, 5]),
      );
      const resultado = await servicio.guardarRespuestas(
        EVALUADOR,
        ID_EVALUACION,
        cuerpo([1, 5]),
      );
      assert.deepEqual(almacen, { 1: 5 });
      assert.equal(resultado.progreso.respondidas, 1);
    });

    it("con id_nivel null borra la respuesta y se mantiene el borrador si quedan otras", async () => {
      simular({
        respuestas: { 1: 5, 2: 4 },
        evaluacion: { id_estado_evaluacion: ESTADO_EVALUACION.BORRADOR },
      });
      const resultado = await servicio.guardarRespuestas(
        EVALUADOR,
        ID_EVALUACION,
        cuerpo([2, null]),
      );
      assert.deepEqual(llamadas.borrar, [[idPregunta(2)]]);
      assert.deepEqual(almacen, { 1: 5 });
      assert.equal(resultado.estado_codigo, "BORRADOR");
    });

    it("si no queda ninguna respuesta la evaluación vuelve a pendiente", async () => {
      simular({
        respuestas: { 1: 5 },
        evaluacion: { id_estado_evaluacion: ESTADO_EVALUACION.BORRADOR },
      });
      const resultado = await servicio.guardarRespuestas(
        EVALUADOR,
        ID_EVALUACION,
        cuerpo([1, null]),
      );
      assert.deepEqual(llamadas.estado, [ESTADO_EVALUACION.PENDIENTE]);
      assert.equal(resultado.estado_codigo, "PENDIENTE");
      assert.equal(resultado.progreso.respondidas, 0);
    });
  });

  describe("referencias de la plantilla", () => {
    it("rechaza una pregunta que no pertenece al formulario y no guarda nada", async () => {
      simular();
      await assert.rejects(
        servicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, {
          respuestas: [
            { id_pregunta: ayudas.uuid("c", 99), id_nivel: nivelDe(1, 3) },
          ],
        }),
        (error) =>
          error.estado === 400 &&
          error.detalles[0].campo === "respuestas[0].id_pregunta",
      );
      assert.equal(llamadas.guardar.length, 0);
      assert.equal(llamadas.estado.length, 0);
    });

    it("rechaza un nivel que no es de la escala de la pregunta y dice cuál campo falla", async () => {
      simular();
      await assert.rejects(
        servicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, {
          respuestas: [
            {
              id_pregunta: idPregunta(1),
              id_nivel: ayudas.nivelId(ayudas.ESCALA.CUALITATIVA, 2),
            },
          ],
        }),
        (error) =>
          error.estado === 400 &&
          error.detalles[0].campo === "respuestas[0].id_nivel",
      );
      assert.equal(llamadas.guardar.length, 0);
    });

    it("valida el cuerpo antes de consultar la base de datos", async () => {
      simular();
      await assert.rejects(
        servicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, {}),
        { estado: 400 },
      );
      assert.equal(llamadas.obtener.length, 0);
    });
  });

  describe("permisos y existencia", () => {
    it("solo el evaluador asignado puede guardar (403)", async () => {
      simular();
      await assert.rejects(
        servicio.guardarRespuestas(
          ayudas.OTRO_EVALUADOR,
          ID_EVALUACION,
          cuerpo([1, 5]),
        ),
        { estado: 403 },
      );
      assert.equal(llamadas.guardar.length, 0);
    });

    it("un identificador mal formado o inexistente responde 404", async () => {
      simular();
      await assert.rejects(
        servicio.guardarRespuestas(EVALUADOR, "no-es-uuid", cuerpo([1, 5])),
        { estado: 404 },
      );
      assert.equal(llamadas.obtener.length, 0, "ni siquiera consulta la base");

      mock.method(modelo, "obtenerEvaluacion", async () => null);
      await assert.rejects(
        servicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, cuerpo([1, 5])),
        { estado: 404 },
      );
    });

    it("no se responde mientras el ciclo no esté activo (409)", async () => {
      simular({ evaluacion: { id_estado_ciclo: 1 } });
      await assert.rejects(
        servicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, cuerpo([1, 5])),
        { estado: 409 },
      );
      assert.equal(llamadas.guardar.length, 0);
    });
  });

  describe("bloqueo: evaluaciones enviadas y vencidas", () => {
    it("una evaluación enviada no se puede modificar (409)", async () => {
      simular({
        evaluacion: {
          id_estado_evaluacion: ESTADO_EVALUACION.ENVIADA,
          puntaje_final: 85.56,
        },
        respuestas: ayudas.RESPUESTAS_OBLIGATORIAS,
      });
      await assert.rejects(
        servicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, cuerpo([1, 1])),
        (e) => e.estado === 409 && /ya fue enviada/.test(e.message),
      );
      assert.equal(llamadas.guardar.length, 0);
      assert.equal(llamadas.borrar.length, 0);
      assert.equal(llamadas.estado.length, 0);
      assert.deepEqual(
        almacen,
        ayudas.RESPUESTAS_OBLIGATORIAS,
        "las respuestas quedan intactas",
      );
    });

    it("tampoco se pueden borrar respuestas de una evaluación enviada", async () => {
      simular({
        evaluacion: { id_estado_evaluacion: ESTADO_EVALUACION.ENVIADA },
        respuestas: ayudas.RESPUESTAS_OBLIGATORIAS,
      });
      await assert.rejects(
        servicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, cuerpo([1, null])),
        { estado: 409 },
      );
      assert.equal(llamadas.borrar.length, 0);
    });

    it("pasada la fecha límite se marca como vencida, no guarda y responde 409", async () => {
      simular({
        evaluacion: { fecha_limite: "2030-11-30", hoy: "2030-12-01" },
      });
      await assert.rejects(
        servicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, cuerpo([1, 5])),
        (e) => e.estado === 409 && /venció el 2030-11-30/.test(e.message),
      );
      assert.deepEqual(
        llamadas.estado,
        [ESTADO_EVALUACION.VENCIDA],
        "la marca de vencida sí queda guardada",
      );
      assert.equal(llamadas.guardar.length, 0);
    });

    it("el día de la fecha límite todavía se puede responder", async () => {
      simular({
        evaluacion: { fecha_limite: "2030-12-01", hoy: "2030-12-01" },
      });
      const resultado = await servicio.guardarRespuestas(
        EVALUADOR,
        ID_EVALUACION,
        cuerpo([1, 5]),
      );
      assert.equal(resultado.estado_codigo, "BORRADOR");
    });

    it("si el ciclo se cerró la evaluación abierta pasa a vencida con ese motivo", async () => {
      simular({ evaluacion: { id_estado_ciclo: 3 } });
      await assert.rejects(
        servicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, cuerpo([1, 5])),
        (e) => e.estado === 409 && /cerrado/.test(e.message),
      );
      assert.deepEqual(llamadas.estado, [ESTADO_EVALUACION.VENCIDA]);
    });

    it("una evaluación ya marcada como vencida responde 409 sin volver a marcarla", async () => {
      simular({
        evaluacion: {
          id_estado_evaluacion: ESTADO_EVALUACION.VENCIDA,
          fecha_limite: "2030-11-30",
          hoy: "2030-12-01",
        },
      });
      await assert.rejects(
        servicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, cuerpo([1, 5])),
        { estado: 409 },
      );
      assert.equal(llamadas.estado.length, 0);
      assert.equal(llamadas.guardar.length, 0);
    });
  });
});

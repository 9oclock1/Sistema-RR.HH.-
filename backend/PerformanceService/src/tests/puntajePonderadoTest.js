const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { calcularPuntaje } = require("../utils/puntajePonderado");
const {
  armarFormulario,
  resumirProgreso,
  buscarFaltantes,
  calcularResultado,
} = require("../utils/formulario");
const ayudas = require("./ayudas/plantillaEvaluacion");

const formularioCon = (respuestas) =>
  armarFormulario(ayudas.filas(respuestas), ayudas.NIVELES);

describe("RF-04: puntaje ponderado (calcularPuntaje)", () => {
  it("convierte cada respuesta a 0-100 con valor / máximo de su escala", () => {
    assert.equal(calcularPuntaje([{ peso: 100, valor: 5, maximo: 5 }]), 100);
    assert.equal(calcularPuntaje([{ peso: 100, valor: 1, maximo: 5 }]), 20);
    assert.equal(calcularPuntaje([{ peso: 100, valor: 3, maximo: 4 }]), 75);
    assert.equal(calcularPuntaje([{ peso: 100, valor: 0, maximo: 5 }]), 0);
  });

  it("pondera cada respuesta por el peso de su pregunta", () => {
    // (80 · 100 % + 20 · 20 %) / 100 = 84
    assert.equal(
      calcularPuntaje([
        { peso: 80, valor: 5, maximo: 5 },
        { peso: 20, valor: 1, maximo: 5 },
      ]),
      84,
    );
  });

  it("mezcla escalas distintas: cada una se normaliza con su propio máximo", () => {
    // (50 · 20 % + 50 · 25 %) / 100 = 22,5
    assert.equal(
      calcularPuntaje([
        { peso: 50, valor: 1, maximo: 5 },
        { peso: 50, valor: 1, maximo: 4 },
      ]),
      22.5,
    );
  });

  it("caso de la evaluación enviada del seed: 87,78", () => {
    const items = [
      { peso: 20, valor: 5, maximo: 5 },
      { peso: 15, valor: 4, maximo: 5 },
      { peso: 15, valor: 4, maximo: 5 },
      { peso: 20, valor: 5, maximo: 5 },
      { peso: 20, valor: 3, maximo: 4 },
    ];
    assert.equal(calcularPuntaje(items), 87.78);
  });

  it("una pregunta opcional sin responder no cuenta como 0: su peso se reparte entre las respondidas", () => {
    const respondidas = [
      { peso: 20, valor: 5, maximo: 5 },
      { peso: 15, valor: 4, maximo: 5 },
      { peso: 15, valor: 4, maximo: 5 },
      { peso: 20, valor: 5, maximo: 5 },
      { peso: 20, valor: 3, maximo: 4 },
    ];
    const sinOpcional = calcularPuntaje(respondidas);
    const conOpcional = calcularPuntaje([
      ...respondidas,
      { peso: 10, valor: 5, maximo: 5 },
    ]);
    assert.equal(sinOpcional, 87.78);
    assert.equal(conOpcional, 89);
    // Si se contara como 0 el resultado sería 79: el evaluado no se penaliza por algo opcional.
    assert.notEqual(sinOpcional, 79);
  });

  it("redondea una sola vez al final, a 2 decimales y hacia arriba en el punto medio", () => {
    assert.equal(calcularPuntaje([{ peso: 1, valor: 1, maximo: 3 }]), 33.33);
    assert.equal(calcularPuntaje([{ peso: 1, valor: 2, maximo: 3 }]), 66.67);
    assert.equal(
      calcularPuntaje([
        { peso: 3, valor: 1, maximo: 3 },
        { peso: 7, valor: 2, maximo: 3 },
      ]),
      56.67,
    );
    // 100 / 32 = 3,125 exacto: sube a 3,13.
    assert.equal(calcularPuntaje([{ peso: 1, valor: 1, maximo: 32 }]), 3.13);
    assert.equal(calcularPuntaje([{ peso: 1, valor: 1, maximo: 200 }]), 0.5);
  });

  it("los pesos con decimales suman exactos (sin errores de coma flotante)", () => {
    const todasAlMaximo = [
      { peso: 33.33, valor: 5, maximo: 5 },
      { peso: 33.33, valor: 5, maximo: 5 },
      { peso: 33.34, valor: 5, maximo: 5 },
    ];
    assert.equal(calcularPuntaje(todasAlMaximo), 100);
    assert.equal(
      calcularPuntaje([
        { peso: 0.1, valor: 1, maximo: 1 },
        { peso: 0.2, valor: 1, maximo: 1 },
      ]),
      100,
    );
  });

  it("devuelve null si no hay nada que calcular", () => {
    assert.equal(calcularPuntaje([]), null);
    assert.equal(calcularPuntaje(null), null);
    assert.equal(calcularPuntaje([{ peso: 0, valor: 3, maximo: 5 }]), null);
  });

  it("rechaza una escala cuyo valor máximo no es positivo", () => {
    assert.throws(
      () => calcularPuntaje([{ peso: 10, valor: 1, maximo: 0 }]),
      RangeError,
    );
  });
});

describe("RF-04: formulario armado desde la plantilla (armarFormulario)", () => {
  it("agrupa las preguntas en secciones y criterios, en el orden de la plantilla", () => {
    const { secciones } = formularioCon({});
    assert.deepEqual(
      secciones.map((s) => s.competencia.nombre),
      ["Atención al cliente", "Trabajo en equipo", "Puntualidad y orden"],
    );
    assert.deepEqual(
      secciones[0].criterios.map((c) => c.nombre),
      ["Trato al cliente", "Resolución de reclamos"],
    );
    assert.deepEqual(
      secciones[0].criterios[0].preguntas.map((p) => p.id_pregunta),
      [ayudas.idPregunta(1), ayudas.idPregunta(2)],
    );
    assert.equal(secciones[2].competencia.tipo, "FACTOR_OPERATIVO");
  });

  it("cada escala trae sus niveles ordenados por valor y su valor máximo", () => {
    const desordenados = [...ayudas.NIVELES].reverse();
    const { escalas } = armarFormulario(ayudas.filas({}), desordenados);
    const likert = escalas.find((e) => e.id_escala === ayudas.ESCALA.LIKERT);
    const cualitativa = escalas.find(
      (e) => e.id_escala === ayudas.ESCALA.CUALITATIVA,
    );
    assert.deepEqual(
      likert.niveles.map((n) => n.valor),
      [1, 2, 3, 4, 5],
    );
    assert.equal(likert.valor_maximo, 5);
    assert.equal(likert.tipo, "CUANTITATIVA");
    assert.deepEqual(
      cualitativa.niveles.map((n) => n.etiqueta),
      ["No cumple", "Cumple parcialmente", "Cumple", "Supera lo esperado"],
    );
    assert.equal(cualitativa.valor_maximo, 4);
  });

  it("deja en cada pregunta la respuesta guardada, o null si no tiene", () => {
    const { secciones } = formularioCon({ 1: 5 });
    const [primera, segunda] = secciones[0].criterios[0].preguntas;
    assert.deepEqual(primera.respuesta, {
      id_nivel: ayudas.nivelDe(1, 5),
      valor: 5,
    });
    assert.equal(segunda.respuesta, null);
  });
});

describe("RF-04: avance y preguntas obligatorias pendientes", () => {
  it("mide el avance total y el de las obligatorias por separado", () => {
    assert.deepEqual(resumirProgreso(formularioCon({})), {
      total: 6,
      respondidas: 0,
      obligatorias_total: 5,
      obligatorias_respondidas: 0,
    });
    assert.deepEqual(resumirProgreso(formularioCon({ 1: 5, 5: 3 })), {
      total: 6,
      respondidas: 2,
      obligatorias_total: 5,
      obligatorias_respondidas: 1,
    });
    assert.deepEqual(
      resumirProgreso(formularioCon(ayudas.RESPUESTAS_OBLIGATORIAS)),
      {
        total: 6,
        respondidas: 5,
        obligatorias_total: 5,
        obligatorias_respondidas: 5,
      },
    );
  });

  it("criterio 4: lista solo las obligatorias sin responder, con un mensaje por cada una", () => {
    const faltantes = buscarFaltantes(formularioCon({ 1: 5, 2: 4 }));
    assert.deepEqual(
      faltantes.map((f) => f.id_pregunta),
      [ayudas.idPregunta(3), ayudas.idPregunta(4), ayudas.idPregunta(6)],
    );
    assert.ok(
      faltantes.every((f) => f.campo === f.id_pregunta),
      "el campo es el id de la pregunta, para resaltarla",
    );
    assert.match(
      faltantes[0].mensaje,
      /obligatoria «¿Gestiona los reclamos con calma\?»/,
    );
  });

  it("la opcional sin responder nunca aparece como pendiente", () => {
    assert.deepEqual(
      buscarFaltantes(formularioCon(ayudas.RESPUESTAS_OBLIGATORIAS)),
      [],
    );
    assert.ok(
      !buscarFaltantes(formularioCon({})).some(
        (f) => f.id_pregunta === ayudas.idPregunta(5),
      ),
    );
  });
});

describe("RF-04: desglose del resultado (calcularResultado)", () => {
  it("criterio 3: el puntaje final es el ponderado de todas las respuestas", () => {
    assert.equal(
      calcularResultado(formularioCon(ayudas.RESPUESTAS_DEL_SEED))
        .puntaje_final,
      87.78,
    );
    assert.equal(
      calcularResultado(formularioCon(ayudas.RESPUESTAS_OBLIGATORIAS))
        .puntaje_final,
      85.56,
    );
  });

  it("calcula el puntaje y el peso de cada competencia con la misma fórmula", () => {
    const { secciones } = calcularResultado(
      formularioCon(ayudas.RESPUESTAS_DEL_SEED),
    );
    assert.deepEqual(
      secciones.map((s) => [s.competencia, s.peso_porcentual, s.puntaje]),
      [
        ["Atención al cliente", 50, 88],
        ["Trabajo en equipo", 30, 100],
        ["Puntualidad y orden", 20, 75],
      ],
    );
  });

  it("calcula también el puntaje de cada criterio", () => {
    const { secciones } = calcularResultado(
      formularioCon(ayudas.RESPUESTAS_DEL_SEED),
    );
    assert.deepEqual(
      secciones[0].criterios.map((c) => [
        c.nombre,
        c.peso_porcentual,
        c.puntaje,
      ]),
      [
        ["Trato al cliente", 35, 91.43],
        ["Resolución de reclamos", 15, 80],
      ],
    );
  });

  it("los pesos de las competencias suman el 100 % de la plantilla", () => {
    const { secciones } = calcularResultado(formularioCon({}));
    assert.equal(
      secciones.reduce((total, s) => total + s.peso_porcentual, 0),
      100,
    );
  });

  it("sin respuestas no hay puntaje: queda en null, no en 0", () => {
    const resultado = calcularResultado(formularioCon({}));
    assert.equal(resultado.puntaje_final, null);
    assert.ok(resultado.secciones.every((s) => s.puntaje === null));
  });

  it("una competencia sin respuestas queda en null aunque las demás tengan puntaje", () => {
    const { puntaje_final, secciones } = calcularResultado(
      formularioCon({ 1: 5, 2: 5, 3: 5 }),
    );
    assert.equal(puntaje_final, 100);
    assert.deepEqual(
      secciones.map((s) => s.puntaje),
      [100, null, null],
    );
  });
});

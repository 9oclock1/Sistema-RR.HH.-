const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarPlantilla } = require("../src/utils/validarPlantilla");
const { balancePesos, describirDesbalance } = require("../src/utils/ponderacion");

const LIKERT = [
  { valor: 1, etiqueta: "Muy deficiente" },
  { valor: 2, etiqueta: "Deficiente" },
  { valor: 3, etiqueta: "Aceptable" },
  { valor: 4, etiqueta: "Bueno" },
  { valor: 5, etiqueta: "Excelente" },
];

const pregunta = (extra = {}) => ({ enunciado: "Cumple sus metas", peso: 50, tipo_escala: "LIKERT", niveles: LIKERT, ...extra });

const plantilla = (preguntas = [pregunta()]) => ({
  nombre: "Desempeño de cajeros",
  criterios: [{ nombre: "Productividad", preguntas }],
});

const rechaza = (datos, campo) =>
  assert.throws(
    () => validarPlantilla(datos),
    (error) => error.estado === 400 && error.detalles.some((detalle) => detalle.campo === campo)
  );

test("criterio 1: acepta preguntas con peso y escala cuantitativa o cualitativa", () => {
  const resultado = validarPlantilla(
    plantilla([
      pregunta({ peso: 40 }),
      pregunta({ peso: 30, tipo_escala: "NUMERICA", valor_minimo: 0, valor_maximo: 100, niveles: undefined }),
      pregunta({
        peso: 30,
        tipo_escala: "CUALITATIVA",
        niveles: [
          { valor: 3, etiqueta: "Supera" },
          { valor: 1, etiqueta: "No cumple" },
          { valor: 2, etiqueta: "Cumple" },
        ],
      }),
    ])
  );
  const [likert, numerica, cualitativa] = resultado.criterios[0].preguntas;
  assert.equal(likert.peso, 40);
  assert.deepEqual([numerica.valor_minimo, numerica.valor_maximo, numerica.niveles], [0, 100, []]);
  assert.deepEqual(
    cualitativa.niveles.map((nivel) => nivel.etiqueta),
    ["No cumple", "Cumple", "Supera"]
  );
  assert.deepEqual([cualitativa.valor_minimo, cualitativa.valor_maximo], [1, 3]);
});

test("criterio 1: un borrador puede guardarse con pesos que aún no suman 100", () => {
  assert.doesNotThrow(() => validarPlantilla(plantilla([pregunta({ peso: 10 })])));
  assert.doesNotThrow(() => validarPlantilla({ nombre: "Vacía" }));
});

test("criterio 3: la escala Likert registra la etiqueta de cada nivel del 1 al 5", () => {
  const { niveles, valor_minimo, valor_maximo } = validarPlantilla(plantilla()).criterios[0].preguntas[0];
  assert.deepEqual(niveles, LIKERT);
  assert.deepEqual([valor_minimo, valor_maximo], [1, 5]);
});

test("criterio 3: rechaza una escala Likert con niveles o etiquetas faltantes", () => {
  rechaza(plantilla([pregunta({ niveles: LIKERT.slice(0, 4) })]), "criterios[0].preguntas[0].niveles");
  rechaza(plantilla([pregunta({ niveles: LIKERT.map((n) => ({ ...n, valor: n.valor + 1 })) })]), "criterios[0].preguntas[0].niveles");
  const sinEtiqueta = LIKERT.map((nivel) => (nivel.valor === 3 ? { ...nivel, etiqueta: "  " } : nivel));
  rechaza(plantilla([pregunta({ niveles: sinEtiqueta })]), "criterios[0].preguntas[0].niveles[2].etiqueta");
});

test("rechaza pesos fuera de rango o con más de dos decimales", () => {
  rechaza(plantilla([pregunta({ peso: 0 })]), "criterios[0].preguntas[0].peso");
  rechaza(plantilla([pregunta({ peso: 100.5 })]), "criterios[0].preguntas[0].peso");
  rechaza(plantilla([pregunta({ peso: 12.345 })]), "criterios[0].preguntas[0].peso");
  rechaza(plantilla([pregunta({ peso: "50" })]), "criterios[0].preguntas[0].peso");
});

test("rechaza escalas mal definidas", () => {
  const ruta = "criterios[0].preguntas[0]";
  rechaza(plantilla([pregunta({ tipo_escala: "ESTRELLAS" })]), `${ruta}.tipo_escala`);
  rechaza(plantilla([pregunta({ tipo_escala: "NUMERICA", valor_minimo: 10, valor_maximo: 10 })]), `${ruta}.valor_maximo`);
  rechaza(plantilla([pregunta({ tipo_escala: "CUALITATIVA", niveles: [{ valor: 1, etiqueta: "Único" }] })]), `${ruta}.niveles`);
  rechaza(
    plantilla([pregunta({ tipo_escala: "CUALITATIVA", niveles: [{ valor: 1, etiqueta: "A" }, { valor: 1, etiqueta: "B" }] })]),
    `${ruta}.niveles[1].valor`
  );
});

test("rechaza datos requeridos faltantes y criterios repetidos", () => {
  rechaza({}, "nombre");
  rechaza(plantilla([pregunta({ enunciado: "" })]), "criterios[0].preguntas[0].enunciado");
  rechaza(
    { nombre: "X", criterios: [{ nombre: "Actitud" }, { nombre: "actitud " }] },
    "criterios[1].nombre"
  );
});

test("criterio 2: el balance suma en centésimas y describe el desbalance", () => {
  const criterios = [{ preguntas: [{ peso: 33.33 }, { peso: 33.33 }] }, { preguntas: [{ peso: 33.34 }] }];
  assert.deepEqual(balancePesos(criterios), { suma: 100, diferencia: 0, balanceado: true });

  const falta = balancePesos([{ preguntas: [{ peso: 60 }, { peso: 25.5 }] }]);
  assert.deepEqual(falta, { suma: 85.5, diferencia: 14.5, balanceado: false });
  assert.match(describirDesbalance(falta), /85\.5 %: faltan 14\.5 %/);

  const sobra = balancePesos([{ preguntas: [{ peso: 70 }, { peso: 40 }] }]);
  assert.match(describirDesbalance(sobra), /110 %: sobran 10 %/);
});

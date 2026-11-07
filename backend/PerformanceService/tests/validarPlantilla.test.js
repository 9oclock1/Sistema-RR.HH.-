const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarPlantilla } = require("../src/utils/validarPlantilla");
const { validarEscala, validarCompetencia } = require("../src/utils/validarCatalogos");
const { balancePesos, describirDesbalance } = require("../src/utils/ponderacion");

const LIKERT = "00000000-0000-4000-8000-000000000001";
const CUMPLIMIENTO = "00000000-0000-4000-8000-000000000002";
const COMPETENCIA = "c0000000-0000-4000-8000-000000000001";
const COMPETENCIA_2 = "c0000000-0000-4000-8000-000000000002";
const AREA = "d0000000-0000-4000-8000-000000000001";

const NIVELES_LIKERT = [
  { valor: 1, etiqueta: "Muy deficiente" },
  { valor: 2, etiqueta: "Deficiente" },
  { valor: 3, etiqueta: "Aceptable" },
  { valor: 4, etiqueta: "Bueno" },
  { valor: 5, etiqueta: "Excelente" },
];

const pregunta = (extra = {}) => ({ texto: "Cumple sus metas", peso_porcentual: 50, id_escala: LIKERT, ...extra });

const plantilla = (preguntas = [pregunta()], extra = {}) => ({
  nombre: "Desempeño de cajeros",
  objetivo: "Medir el desempeño semestral de los cajeros.",
  id_departamento_destino: AREA,
  vigencia_desde: "2026-01-01",
  vigencia_hasta: "2026-12-31",
  secciones: [{ id_competencia: COMPETENCIA, criterios: [{ nombre: "Productividad", preguntas }] }],
  ...extra,
});

const rechaza = (validar, datos, campo) =>
  assert.throws(
    () => validar(datos),
    (error) => error.estado === 400 && error.detalles.some((detalle) => detalle.campo === campo)
  );

const RUTA = "secciones[0].criterios[0].preguntas[0]";

test("criterio 1: acepta secciones por competencia con criterios y preguntas ponderadas", () => {
  const resultado = validarPlantilla(
    plantilla([pregunta({ peso_porcentual: 40 }), pregunta({ peso_porcentual: 60, id_escala: CUMPLIMIENTO, es_obligatoria: false })])
  );
  assert.equal(resultado.nombre, "Desempeño de cajeros");
  assert.equal(resultado.id_departamento_destino, AREA);
  const [likert, cualitativa] = resultado.secciones[0].criterios[0].preguntas;
  assert.deepEqual(likert, { texto: "Cumple sus metas", peso_porcentual: 40, es_obligatoria: true, id_escala: LIKERT });
  assert.equal(cualitativa.id_escala, CUMPLIMIENTO);
  assert.equal(cualitativa.es_obligatoria, false);
});

test("criterio 1: un borrador puede guardarse con pesos que aún no suman 100 o sin secciones", () => {
  assert.doesNotThrow(() => validarPlantilla(plantilla([pregunta({ peso_porcentual: 10 })])));
  assert.doesNotThrow(() => validarPlantilla(plantilla([], { secciones: [] })));
});

test("valida los datos base: nombre, objetivo, área y vigencia", () => {
  rechaza(validarPlantilla, plantilla(undefined, { nombre: " " }), "nombre");
  rechaza(validarPlantilla, plantilla(undefined, { objetivo: "" }), "objetivo");
  rechaza(validarPlantilla, plantilla(undefined, { id_departamento_destino: "área" }), "id_departamento_destino");
  rechaza(validarPlantilla, plantilla(undefined, { vigencia_desde: "2026-02-30" }), "vigencia_desde");
  rechaza(validarPlantilla, plantilla(undefined, { vigencia_hasta: "2025-12-31" }), "vigencia_hasta");
});

test("sin datos base solo valida la estructura", () => {
  const resultado = validarPlantilla({ secciones: plantilla().secciones }, { conDatosBase: false });
  assert.equal(resultado.nombre, undefined);
  assert.equal(resultado.secciones.length, 1);
});

test("rechaza pesos fuera de rango o con más de dos decimales", () => {
  rechaza(validarPlantilla, plantilla([pregunta({ peso_porcentual: 0 })]), `${RUTA}.peso_porcentual`);
  rechaza(validarPlantilla, plantilla([pregunta({ peso_porcentual: 100.5 })]), `${RUTA}.peso_porcentual`);
  rechaza(validarPlantilla, plantilla([pregunta({ peso_porcentual: 12.345 })]), `${RUTA}.peso_porcentual`);
  rechaza(validarPlantilla, plantilla([pregunta({ peso_porcentual: "50" })]), `${RUTA}.peso_porcentual`);
});

test("rechaza preguntas sin texto, sin escala u obligatoriedad inválida", () => {
  rechaza(validarPlantilla, plantilla([pregunta({ texto: "" })]), `${RUTA}.texto`);
  rechaza(validarPlantilla, plantilla([pregunta({ id_escala: null })]), `${RUTA}.id_escala`);
  rechaza(validarPlantilla, plantilla([pregunta({ es_obligatoria: "sí" })]), `${RUTA}.es_obligatoria`);
});

test("rechaza competencias repetidas y criterios repetidos dentro de una sección", () => {
  const seccion = plantilla().secciones[0];
  rechaza(validarPlantilla, plantilla(undefined, { secciones: [seccion, seccion] }), "secciones[1].id_competencia");
  assert.doesNotThrow(() =>
    validarPlantilla(plantilla(undefined, { secciones: [seccion, { ...seccion, id_competencia: COMPETENCIA_2 }] }))
  );
  rechaza(
    validarPlantilla,
    plantilla(undefined, {
      secciones: [{ id_competencia: COMPETENCIA, criterios: [{ nombre: "Actitud" }, { nombre: "actitud " }] }],
    }),
    "secciones[0].criterios[1].nombre"
  );
});

test("criterio 3: una escala Likert registra la etiqueta de cada nivel, ordenados por valor", () => {
  const escala = validarEscala({ nombre: "Likert 1-5", tipo: "cuantitativa", niveles: [...NIVELES_LIKERT].reverse() });
  assert.equal(escala.id_tipo_escala, 1);
  assert.deepEqual(escala.niveles, NIVELES_LIKERT);
});

test("criterio 3: acepta escalas cualitativas con valor para el cálculo", () => {
  const escala = validarEscala({
    nombre: "Cumplimiento",
    tipo: "CUALITATIVA",
    niveles: [
      { valor: 2, etiqueta: "Cumple" },
      { valor: 1, etiqueta: "No cumple" },
    ],
  });
  assert.equal(escala.id_tipo_escala, 2);
  assert.deepEqual(
    escala.niveles.map((n) => n.etiqueta),
    ["No cumple", "Cumple"]
  );
});

test("criterio 3: rechaza escalas mal definidas", () => {
  const base = { nombre: "Escala", tipo: "CUANTITATIVA", niveles: NIVELES_LIKERT };
  rechaza(validarEscala, { ...base, tipo: "ESTRELLAS" }, "tipo");
  rechaza(validarEscala, { ...base, nombre: "" }, "nombre");
  rechaza(validarEscala, { ...base, niveles: [{ valor: 1, etiqueta: "Único" }] }, "niveles");
  rechaza(validarEscala, { ...base, niveles: [{ valor: 1, etiqueta: "A" }, { valor: 1, etiqueta: "B" }] }, "niveles[1].valor");
  rechaza(validarEscala, { ...base, niveles: [{ valor: 1, etiqueta: "A" }, { valor: 2, etiqueta: "a" }] }, "niveles[1].etiqueta");
  rechaza(validarEscala, { ...base, niveles: [{ valor: -1, etiqueta: "A" }, { valor: 2, etiqueta: "B" }] }, "niveles[0].valor");
  rechaza(validarEscala, { ...base, niveles: [{ valor: 1, etiqueta: "A" }, { valor: 1000, etiqueta: "B" }] }, "niveles[1].valor");
});

test("valida las competencias del catálogo", () => {
  assert.deepEqual(validarCompetencia({ nombre: " Trabajo en equipo ", tipo: "competencia_laboral" }), {
    nombre: "Trabajo en equipo",
    descripcion: null,
    id_tipo_competencia: 1,
  });
  rechaza(validarCompetencia, { nombre: "Puntualidad", tipo: "OTRO" }, "tipo");
  rechaza(validarCompetencia, { tipo: "FACTOR_OPERATIVO" }, "nombre");
});

test("criterio 2: el balance suma en centésimas y describe el desbalance", () => {
  const seccion = (...pesos) => ({ criterios: [{ preguntas: pesos.map((peso_porcentual) => ({ peso_porcentual })) }] });
  assert.deepEqual(balancePesos([seccion(33.33, 33.33), seccion(33.34)]), { suma: 100, diferencia: 0, balanceado: true });

  const falta = balancePesos([seccion(60, 25.5)]);
  assert.deepEqual(falta, { suma: 85.5, diferencia: 14.5, balanceado: false });
  assert.match(describirDesbalance(falta), /85\.5 %: faltan 14\.5 %/);

  assert.match(describirDesbalance(balancePesos([seccion(70, 40)])), /110 %: sobran 10 %/);
});

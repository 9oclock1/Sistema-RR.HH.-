const uuid = (grupo, n) =>
  `${grupo.repeat(8)}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const ESCALA = {
  LIKERT: "00000000-0000-4000-8000-000000000001",
  CUALITATIVA: "00000000-0000-4000-8000-000000000002",
};

const NIVELES_LIKERT = [
  [1, "Muy deficiente"],
  [2, "Deficiente"],
  [3, "Aceptable"],
  [4, "Bueno"],
  [5, "Excelente"],
];
const NIVELES_CUALITATIVA = [
  [1, "No cumple"],
  [2, "Cumple parcialmente"],
  [3, "Cumple"],
  [4, "Supera lo esperado"],
];

const nivelId = (escala, valor) =>
  uuid(escala === ESCALA.LIKERT ? "d" : "e", valor);

const NIVELES = [
  ...NIVELES_LIKERT.map(([valor, etiqueta]) => ({
    id_nivel: nivelId(ESCALA.LIKERT, valor),
    id_escala: ESCALA.LIKERT,
    valor,
    etiqueta,
  })),
  ...NIVELES_CUALITATIVA.map(([valor, etiqueta]) => ({
    id_nivel: nivelId(ESCALA.CUALITATIVA, valor),
    id_escala: ESCALA.CUALITATIVA,
    valor,
    etiqueta,
  })),
];

const COMPETENCIAS = {
  1: { nombre: "Atención al cliente", tipo: "COMPETENCIA_LABORAL" },
  2: { nombre: "Trabajo en equipo", tipo: "COMPETENCIA_LABORAL" },
  3: { nombre: "Puntualidad y orden", tipo: "FACTOR_OPERATIVO" },
};
const CRITERIOS = {
  1: { nombre: "Trato al cliente", orden: 1 },
  2: { nombre: "Resolución de reclamos", orden: 2 },
  3: { nombre: "Colaboración", orden: 1 },
  4: { nombre: "Cumplimiento de horario", orden: 1 },
};

// Pesos: 20 + 15 + 15 + 20 + 10 + 20 = 100.
const PREGUNTAS = [
  {
    n: 1,
    seccion: 1,
    criterio: 1,
    orden: 1,
    peso: 20,
    obligatoria: true,
    escala: ESCALA.LIKERT,
    texto: "¿Saluda y atiende al cliente con cortesía?",
  },
  {
    n: 2,
    seccion: 1,
    criterio: 1,
    orden: 2,
    peso: 15,
    obligatoria: true,
    escala: ESCALA.LIKERT,
    texto: "¿Resuelve las dudas del cliente con claridad?",
  },
  {
    n: 3,
    seccion: 1,
    criterio: 2,
    orden: 1,
    peso: 15,
    obligatoria: true,
    escala: ESCALA.LIKERT,
    texto: "¿Gestiona los reclamos con calma?",
  },
  {
    n: 4,
    seccion: 2,
    criterio: 3,
    orden: 1,
    peso: 20,
    obligatoria: true,
    escala: ESCALA.LIKERT,
    texto: "¿Apoya a sus compañeros?",
  },
  {
    n: 5,
    seccion: 2,
    criterio: 3,
    orden: 2,
    peso: 10,
    obligatoria: false,
    escala: ESCALA.LIKERT,
    texto: "¿Comparte información útil con el equipo?",
  },
  {
    n: 6,
    seccion: 3,
    criterio: 4,
    orden: 1,
    peso: 20,
    obligatoria: true,
    escala: ESCALA.CUALITATIVA,
    texto: "¿Cumple su horario de trabajo?",
  },
];

const idPregunta = (n) => uuid("c", n);
const nivelDe = (n, valor) =>
  nivelId(PREGUNTAS.find((p) => p.n === n).escala, valor);
const numeroDePregunta = (id) =>
  PREGUNTAS.find((p) => idPregunta(p.n) === id)?.n;
const valorDeNivel = (id) =>
  NIVELES.find((nivel) => nivel.id_nivel === id)?.valor;

// Filas planas como las devuelve el modelo (listarEstructura). respuestas: { [número de pregunta]: valor del nivel }.
const filas = (respuestas = {}) =>
  PREGUNTAS.map((pregunta) => {
    const valor = respuestas[pregunta.n] ?? null;
    return {
      id_seccion: uuid("a", pregunta.seccion),
      orden_seccion: pregunta.seccion,
      id_competencia: uuid("3", pregunta.seccion),
      competencia: COMPETENCIAS[pregunta.seccion].nombre,
      competencia_descripcion: null,
      tipo_competencia: COMPETENCIAS[pregunta.seccion].tipo,
      id_criterio: uuid("b", pregunta.criterio),
      criterio: CRITERIOS[pregunta.criterio].nombre,
      criterio_descripcion: null,
      orden_criterio: CRITERIOS[pregunta.criterio].orden,
      id_pregunta: idPregunta(pregunta.n),
      texto: pregunta.texto,
      peso_porcentual: pregunta.peso,
      es_obligatoria: pregunta.obligatoria,
      orden_pregunta: pregunta.orden,
      id_escala: pregunta.escala,
      escala:
        pregunta.escala === ESCALA.LIKERT
          ? "Likert de 1 a 5"
          : "Nivel de cumplimiento",
      tipo_escala:
        pregunta.escala === ESCALA.LIKERT ? "CUANTITATIVA" : "CUALITATIVA",
      id_nivel_respondido:
        valor === null ? null : nivelId(pregunta.escala, valor),
      valor_respondido: valor,
    };
  });

// Las 5 obligatorias respondidas y la opcional sin responder: (20·100 + 15·80 + 15·60 + 20·80 + 20·100) / 90 = 85,56.
const RESPUESTAS_OBLIGATORIAS = { 1: 5, 2: 4, 3: 3, 4: 4, 6: 4 };
// Las respuestas de la evaluación enviada del seed: (20·100 + 15·80 + 15·80 + 20·100 + 20·75) / 90 = 87,78.
const RESPUESTAS_DEL_SEED = { 1: 5, 2: 4, 3: 4, 4: 5, 6: 3 };

const EVALUADOR = uuid("4", 21);
const OTRO_EVALUADOR = uuid("4", 22);
const ID_EVALUACION = uuid("f", 1);

// Fila de la evaluación como la devuelve el modelo (obtenerEvaluacion): abierta, en un ciclo activo y dentro de plazo.
const evaluacion = (cambios = {}) => ({
  id_evaluacion: ID_EVALUACION,
  id_empleado_evaluado: uuid("4", 31),
  id_empleado_evaluador: EVALUADOR,
  id_estado_evaluacion: 1,
  puntaje_final: null,
  enviada_en: null,
  actualizado_en: "2030-12-01T10:00:00.000Z",
  id_ciclo: uuid("1", 1),
  id_version: uuid("2", 1),
  ciclo: "Evaluación de desempeño 2030-S2",
  fecha_limite: "2030-12-31",
  id_estado_ciclo: 2,
  hoy: "2030-12-01",
  nombres: "Carlos",
  apellidos: "Rojas Vargas",
  sucursal: "Sopocachi",
  departamento: "Atención al cliente",
  plantilla: "Evaluación de personal de tienda",
  objetivo:
    "Medir la atención al cliente, el trabajo en equipo y la puntualidad.",
  numero_version: 1,
  ...cambios,
});

module.exports = {
  uuid,
  ESCALA,
  NIVELES,
  PREGUNTAS,
  RESPUESTAS_OBLIGATORIAS,
  RESPUESTAS_DEL_SEED,
  EVALUADOR,
  OTRO_EVALUADOR,
  ID_EVALUACION,
  idPregunta,
  nivelId,
  nivelDe,
  numeroDePregunta,
  valorDeNivel,
  filas,
  evaluacion,
};

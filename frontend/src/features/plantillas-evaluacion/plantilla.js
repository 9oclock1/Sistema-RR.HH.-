export const ESTADOS = {
  BORRADOR: { etiqueta: "Borrador", tono: "aviso" },
  PUBLICADA: { etiqueta: "Publicada", tono: "exito" },
  ARCHIVADA: { etiqueta: "Archivada", tono: "neutral" },
};

export const TIPOS_ESCALA = [
  { valor: "LIKERT", etiqueta: "Likert de 1 a 5" },
  { valor: "NUMERICA", etiqueta: "Cuantitativa (rango numérico)" },
  { valor: "CUALITATIVA", etiqueta: "Cualitativa (niveles con nombre)" },
];

const ETIQUETAS_LIKERT = ["Muy deficiente", "Deficiente", "Aceptable", "Bueno", "Excelente"];
const NIVELES_CUALITATIVOS = ["No cumple", "Cumple parcialmente", "Cumple", "Supera lo esperado"];

// Claves locales para las listas del formulario; no se envían al servidor.
let siguienteClave = 0;
const clave = () => `l${++siguienteClave}`;

const nivel = (valor, etiqueta) => ({ clave: clave(), valor: String(valor), etiqueta });

export function escalaPredeterminada(tipo) {
  if (tipo === "LIKERT") return { valor_minimo: "1", valor_maximo: "5", niveles: ETIQUETAS_LIKERT.map((e, i) => nivel(i + 1, e)) };
  if (tipo === "NUMERICA") return { valor_minimo: "0", valor_maximo: "100", niveles: [] };
  return { valor_minimo: "", valor_maximo: "", niveles: NIVELES_CUALITATIVOS.map((e, i) => nivel(i + 1, e)) };
}

export const nuevaPregunta = () => ({
  clave: clave(),
  enunciado: "",
  peso: "",
  tipo_escala: "LIKERT",
  ...escalaPredeterminada("LIKERT"),
});

export const nuevoCriterio = () => ({ clave: clave(), nombre: "", descripcion: "", preguntas: [nuevaPregunta()] });

export const nuevoNivel = (niveles) => {
  const mayor = Math.max(0, ...niveles.map((n) => Number(n.valor) || 0));
  return nivel(Math.floor(mayor) + 1, "");
};

const texto = (valor) => (valor === null || valor === undefined ? "" : String(valor));

export const aFormulario = (plantilla) => ({
  nombre: plantilla?.nombre ?? "",
  descripcion: plantilla?.descripcion ?? "",
  criterios: (plantilla?.criterios ?? []).map((criterio) => ({
    clave: clave(),
    nombre: criterio.nombre,
    descripcion: texto(criterio.descripcion),
    preguntas: criterio.preguntas.map((pregunta) => ({
      clave: clave(),
      enunciado: pregunta.enunciado,
      peso: texto(pregunta.peso),
      tipo_escala: pregunta.tipo_escala,
      valor_minimo: texto(pregunta.valor_minimo),
      valor_maximo: texto(pregunta.valor_maximo),
      niveles: pregunta.niveles.map((n) => nivel(n.valor, n.etiqueta)),
    })),
  })),
});

// Los campos vacíos viajan como null para que el servidor los marque como requeridos.
const aNumero = (valor) => (String(valor).trim() === "" ? null : Number(valor));

export const aDatos = (formulario) => ({
  nombre: formulario.nombre,
  descripcion: formulario.descripcion,
  criterios: formulario.criterios.map((criterio) => ({
    nombre: criterio.nombre,
    descripcion: criterio.descripcion,
    preguntas: criterio.preguntas.map((pregunta) => ({
      enunciado: pregunta.enunciado,
      peso: aNumero(pregunta.peso),
      tipo_escala: pregunta.tipo_escala,
      ...(pregunta.tipo_escala === "NUMERICA"
        ? { valor_minimo: aNumero(pregunta.valor_minimo), valor_maximo: aNumero(pregunta.valor_maximo) }
        : { niveles: pregunta.niveles.map((n) => ({ valor: aNumero(n.valor), etiqueta: n.etiqueta })) }),
    })),
  })),
});

// Misma regla que el servidor: se suma en centésimas para evitar errores de redondeo.
const aCentesimas = (valor) => Math.round((Number(valor) || 0) * 100);

export const pesoCriterio = (criterio) =>
  criterio.preguntas.reduce((total, pregunta) => total + aCentesimas(pregunta.peso), 0) / 100;

export function balancePesos(criterios) {
  const centesimas = criterios.reduce((total, criterio) => total + aCentesimas(pesoCriterio(criterio)), 0);
  return { suma: centesimas / 100, diferencia: (10000 - centesimas) / 100, balanceado: centesimas === 10000 };
}

export const formatearPorcentaje = (valor) =>
  `${Number(valor).toLocaleString("es-BO", { maximumFractionDigits: 2 })} %`;

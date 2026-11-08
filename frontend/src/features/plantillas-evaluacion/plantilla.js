export const TIPOS_ESCALA = [
  { valor: "CUANTITATIVA", etiqueta: "Cuantitativa" },
  { valor: "CUALITATIVA", etiqueta: "Cualitativa" },
];
const ETIQUETAS_LIKERT = ["Muy deficiente", "Deficiente", "Aceptable", "Bueno", "Excelente"];

// Claves locales para las listas del formulario; no se envían al servidor.
let siguienteClave = 0;
const clave = () => `n${++siguienteClave}`;

const texto = (valor) => (valor === null || valor === undefined ? "" : String(valor));

// Los campos numéricos vacíos viajan como null para que el servidor los marque como requeridos.
const aNumero = (valor) => (String(valor).trim() === "" ? null : Number(valor));

// --- Estructura de una versión: secciones (una competencia) -> criterios -> preguntas ---
// En el formulario cada sección lleva la competencia completa (para mostrarla) y los pesos como texto.

export const nuevaPregunta = (idEscala = "") => ({
  clave: clave(),
  texto: "",
  peso_porcentual: "",
  es_obligatoria: true,
  id_escala: idEscala,
});

export const nuevoCriterio = (idEscala = "") => ({
  clave: clave(),
  nombre: "",
  descripcion: "",
  preguntas: [nuevaPregunta(idEscala)],
});

export const nuevaSeccion = (competencia) => ({ clave: clave(), competencia, criterios: [] });

// Las claves de lo guardado salen de sus identificadores: así son iguales en cada lectura y React no remonta los campos.
export const seccionesAFormulario = (secciones) =>
  secciones.map((seccion) => ({
    clave: `s-${seccion.id_seccion}`,
    competencia: seccion.competencia,
    criterios: seccion.criterios.map((criterio) => ({
      clave: `c-${criterio.id_criterio}`,
      nombre: criterio.nombre,
      descripcion: texto(criterio.descripcion),
      preguntas: criterio.preguntas.map((pregunta) => ({
        clave: `q-${pregunta.id_pregunta}`,
        texto: pregunta.texto,
        peso_porcentual: texto(pregunta.peso_porcentual),
        es_obligatoria: pregunta.es_obligatoria,
        id_escala: pregunta.id_escala,
      })),
    })),
  }));

export const seccionesADatos = (secciones) =>
  secciones.map((seccion) => ({
    id_competencia: seccion.competencia.id_competencia,
    criterios: seccion.criterios.map((criterio) => ({
      nombre: criterio.nombre,
      descripcion: criterio.descripcion,
      preguntas: criterio.preguntas.map((pregunta) => ({
        texto: pregunta.texto,
        peso_porcentual: aNumero(pregunta.peso_porcentual),
        es_obligatoria: pregunta.es_obligatoria,
        id_escala: pregunta.id_escala || null,
      })),
    })),
  }));

export const contarPreguntas = (secciones) =>
  secciones.reduce((total, s) => total + s.criterios.reduce((n, c) => n + c.preguntas.length, 0), 0);

// Misma regla que el servidor: se suma en centésimas para evitar errores de redondeo.
const aCentesimas = (valor) => Math.round((Number(valor) || 0) * 100);

const sumar = (preguntas) => preguntas.reduce((total, pregunta) => total + aCentesimas(pregunta.peso_porcentual), 0) / 100;

export const pesoCriterio = (criterio) => sumar(criterio.preguntas);

export const pesoSeccion = (seccion) => sumar(seccion.criterios.flatMap((criterio) => criterio.preguntas));

export function balancePesos(secciones) {
  const centesimas = aCentesimas(sumar(secciones.flatMap((s) => s.criterios).flatMap((c) => c.preguntas)));
  return { suma: centesimas / 100, diferencia: (10000 - centesimas) / 100, balanceado: centesimas === 10000 };
}

export const formatearPorcentaje = (valor) =>
  `${Number(valor).toLocaleString("es-BO", { maximumFractionDigits: 2 })} %`;

export const describirDesbalance = ({ suma, diferencia }) =>
  diferencia > 0
    ? `La suma de pesos es ${formatearPorcentaje(suma)}: faltan ${formatearPorcentaje(diferencia)} para llegar a 100 %.`
    : `La suma de pesos es ${formatearPorcentaje(suma)}: sobran ${formatearPorcentaje(-diferencia)} sobre 100 %.`;

// --- Escalas de valoración ---

const nivel = (valor, etiqueta) => ({ clave: clave(), valor: String(valor), etiqueta });

export const nuevaEscala = () => ({
  nombre: "",
  descripcion: "",
  tipo: "CUANTITATIVA",
  niveles: ETIQUETAS_LIKERT.map((etiqueta, i) => nivel(i + 1, etiqueta)),
});

export const escalaAFormulario = (escala) => ({
  nombre: escala.nombre,
  descripcion: texto(escala.descripcion),
  tipo: escala.tipo,
  niveles: escala.niveles.map((n) => nivel(n.valor, n.etiqueta)),
});

export const escalaADatos = (formulario) => ({
  nombre: formulario.nombre,
  descripcion: formulario.descripcion,
  tipo: formulario.tipo,
  niveles: formulario.niveles.map((n) => ({ valor: aNumero(n.valor), etiqueta: n.etiqueta })),
});

export const nuevoNivel = (niveles) => {
  const mayor = Math.max(0, ...niveles.map((n) => Number(n.valor) || 0));
  return nivel(Math.floor(mayor) + 1, "");
};

export const describirNiveles = (escala) =>
  escala.niveles.map((n) => `${Number(n.valor).toLocaleString("es-BO")} · ${n.etiqueta}`).join(", ");

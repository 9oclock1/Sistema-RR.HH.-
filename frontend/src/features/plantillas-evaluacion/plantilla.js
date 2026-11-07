export const ESTADOS = {
  BORRADOR: { etiqueta: "Borrador", tono: "aviso" },
  PUBLICADA: { etiqueta: "Publicada", tono: "exito" },
  ARCHIVADA: { etiqueta: "Archivada", tono: "neutral" },
};

export const TIPOS_ESCALA = [
  { valor: "CUANTITATIVA", etiqueta: "Cuantitativa" },
  { valor: "CUALITATIVA", etiqueta: "Cualitativa" },
];

export const TIPOS_COMPETENCIA = [
  { valor: "COMPETENCIA_LABORAL", etiqueta: "Competencia laboral" },
  { valor: "FACTOR_OPERATIVO", etiqueta: "Factor operativo" },
];

const ETIQUETAS_LIKERT = ["Muy deficiente", "Deficiente", "Aceptable", "Bueno", "Excelente"];

// Claves locales para las listas del formulario; no se envían al servidor.
let siguienteClave = 0;
const clave = () => `l${++siguienteClave}`;

const texto = (valor) => (valor === null || valor === undefined ? "" : String(valor));

// Los campos numéricos vacíos viajan como null para que el servidor los marque como requeridos.
const aNumero = (valor) => (String(valor).trim() === "" ? null : Number(valor));

// --- Plantilla: datos base -> secciones (una competencia) -> criterios -> preguntas ---

export const nuevaPregunta = (idEscala = "") => ({
  clave: clave(),
  texto: "",
  peso_porcentual: "",
  es_obligatoria: true,
  id_escala: idEscala,
});

export const nuevoCriterio = (idEscala) => ({
  clave: clave(),
  nombre: "",
  descripcion: "",
  preguntas: [nuevaPregunta(idEscala)],
});

export const nuevaSeccion = (idEscala) => ({ clave: clave(), id_competencia: "", criterios: [nuevoCriterio(idEscala)] });

export const aFormulario = (plantilla) => ({
  nombre: plantilla?.nombre ?? "",
  objetivo: plantilla?.objetivo ?? "",
  id_departamento_destino: plantilla?.id_departamento_destino ?? "",
  vigencia_desde: plantilla?.vigencia_desde ?? "",
  vigencia_hasta: plantilla?.vigencia_hasta ?? "",
  secciones: (plantilla?.secciones ?? []).map((seccion) => ({
    clave: clave(),
    id_competencia: seccion.id_competencia,
    criterios: seccion.criterios.map((criterio) => ({
      clave: clave(),
      nombre: criterio.nombre,
      descripcion: texto(criterio.descripcion),
      preguntas: criterio.preguntas.map((pregunta) => ({
        clave: clave(),
        texto: pregunta.texto,
        peso_porcentual: texto(pregunta.peso_porcentual),
        es_obligatoria: pregunta.es_obligatoria,
        id_escala: pregunta.id_escala,
      })),
    })),
  })),
});

// conDatosBase = false cuando los datos base ya quedaron fijos (la plantilla tiene una versión publicada).
export const aDatos = (formulario, { conDatosBase = true } = {}) => ({
  ...(conDatosBase && {
    nombre: formulario.nombre,
    objetivo: formulario.objetivo,
    id_departamento_destino: formulario.id_departamento_destino || null,
    vigencia_desde: formulario.vigencia_desde || null,
    vigencia_hasta: formulario.vigencia_hasta || null,
  }),
  secciones: formulario.secciones.map((seccion) => ({
    id_competencia: seccion.id_competencia || null,
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
  })),
});

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

export const formatearFecha = (fecha) =>
  fecha ? new Date(`${fecha}T00:00:00`).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

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

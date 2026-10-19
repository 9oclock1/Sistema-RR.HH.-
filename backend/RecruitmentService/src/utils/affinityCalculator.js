const { NIVELES_EDUCACION } = require("./nivelesEducacion");

// Mapeo jerárquico de niveles educativos
const MAPA_ORDEN_EDUCACION = Object.fromEntries(
  NIVELES_EDUCACION.map((n) => [n.codigo, n.orden]),
);

// Patrones léxicos para clasificar títulos en español
const PATRONES_NIVEL_TITULO = [
  { codigo: "DOCTORADO", regex: /\b(doctorado|ph\.?d|doctor[a]?)\b/i },
  {
    codigo: "MAESTRIA",
    regex: /\b(maestr[ií]a|master|msc|mag[ií]ster|postgrado|posgrado)\b/i,
  },
  {
    codigo: "LICENCIATURA",
    regex:
      /\b(licenciatura|licenciado|licenciada|ingenier[ií]a|ingeniero|ingeniera|abogad[oa]|arquitect[oa]|contador|medicina)\b/i,
  },
  { codigo: "TECNICO_SUPERIOR", regex: /\b(t[eé]cnico superior|tsu)\b/i },
  { codigo: "TECNICO_MEDIO", regex: /\b(t[eé]cnico medio|t[eé]cnico)\b/i },
  {
    codigo: "BACHILLER",
    regex: /\b(bachiller|secundaria|humanidades|colegio)\b/i,
  },
];

function normalizarTexto(texto = "") {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/([a-z0-9]+)[\.\-\s]+(js|net|ts)\b/gi, "$1$2")
    .replace(/[^\w\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectarNivelEducacionMaximo(titulos = []) {
  if (!Array.isArray(titulos) || titulos.length === 0) {
    return { codigo: "SIN_EDUCACION", orden: 0, tituloOrigen: "" };
  }

  let mejorOrden = 0;
  let mejorCodigo = "SIN_EDUCACION";
  let mejorTitulo = "";

  for (const item of titulos) {
    const tituloTexto = typeof item === "string" ? item : item?.titulo || "";
    const normalizado = normalizarTexto(tituloTexto);

    for (const { codigo, regex } of PATRONES_NIVEL_TITULO) {
      if (regex.test(normalizado)) {
        const orden = MAPA_ORDEN_EDUCACION[codigo] || 0;
        if (orden > mejorOrden) {
          mejorOrden = orden;
          mejorCodigo = codigo;
          mejorTitulo = tituloTexto;
        }
        break;
      }
    }
  }

  return { codigo: mejorCodigo, orden: mejorOrden, tituloOrigen: mejorTitulo };
}

// Calcula la similitud de coseno entre dos vectores numéricos
function similitudCoseno(vecA, vecB) {
  if (
    !Array.isArray(vecA) ||
    !Array.isArray(vecB) ||
    vecA.length !== vecB.length ||
    vecA.length === 0
  ) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function similitudLexica(strA, strB) {
  const normA = normalizarTexto(strA);
  const normB = normalizarTexto(strB);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.9;

  const tokensA = new Set(normA.split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(normB.split(" ").filter((t) => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let interseccion = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) interseccion++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return interseccion / union;
}

async function obtenerEmbedding(texto) {
  const provider = process.env.CV_PARSER_PROVIDER || "regex";

  // Ollama local
  if (provider === "local") {
    try {
      const baseUrl =
        process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";
      const model = process.env.OLLAMA_MODEL_EMBEDDING || "nomic-embed-text";
      const res = await fetch(`${baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: texto }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.embedding)) return data.embedding;
      }
    } catch {}
  }

  // Google Cloud API
  if (
    provider === "cloud" &&
    (process.env.CLOUD_PROVIDER || "google") === "google" &&
    process.env.GOOGLE_API_KEY
  ) {
    try {
      const apiKey = process.env.GOOGLE_API_KEY;
      const modelName =
        process.env.EMBEDDING_MODEL || "models/text-embedding-004";
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelName}:embedContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          content: { parts: [{ text: texto }] },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.embedding?.values) return data.embedding.values;
      }
    } catch {}
  }

  return null;
}

async function evaluarHabilidades(
  habilidadesRequeridas = [],
  destrezasCandidato = [],
) {
  if (
    !Array.isArray(habilidadesRequeridas) ||
    habilidadesRequeridas.length === 0
  ) {
    return {
      totalRequeridas: 0,
      totalCumplidas: 0,
      cumplidas: [],
      incumplidas: [],
      habilidadesExtraCandidato: destrezasCandidato,
      porcentajeObtenido: 100,
    };
  }

  const requeridasEmbeddings = await Promise.all(
    habilidadesRequeridas.map(async (hab) => ({
      texto: hab,
      vec: await obtenerEmbedding(hab),
    })),
  );

  const candidatoEmbeddings = await Promise.all(
    destrezasCandidato.map(async (des) => ({
      texto: des,
      vec: await obtenerEmbedding(des),
    })),
  );

  const UMBRAL_EXACTO = 0.78;
  const UMBRAL_PARCIAL = 0.6;

  const cumplidas = [];
  const incumplidas = [];
  const destrezasCoincidentesSet = new Set();
  let sumaPuntosHabilidades = 0;

  for (const req of requeridasEmbeddings) {
    let mejorSimilitud = 0;
    let mejorDestreza = null;

    for (const cand of candidatoEmbeddings) {
      let sim = 0;
      if (req.vec && cand.vec) {
        sim = similitudCoseno(req.vec, cand.vec);
      } else {
        sim = similitudLexica(req.texto, cand.texto);
      }

      if (sim > mejorSimilitud) {
        mejorSimilitud = sim;
        mejorDestreza = cand.texto;
      }
    }

    if (mejorSimilitud >= UMBRAL_EXACTO) {
      sumaPuntosHabilidades += 1.0;
      cumplidas.push({
        habilidadRequerida: req.texto,
        habilidadCoincidente: mejorDestreza,
        similitud: Math.round(mejorSimilitud * 100) / 100,
      });
      destrezasCoincidentesSet.add(mejorDestreza);
    } else if (mejorSimilitud >= UMBRAL_PARCIAL) {
      sumaPuntosHabilidades += 0.5;
      cumplidas.push({
        habilidadRequerida: req.texto,
        habilidadCoincidente: `${mejorDestreza} (Parcial)`,
        similitud: Math.round(mejorSimilitud * 100) / 100,
      });
      destrezasCoincidentesSet.add(mejorDestreza);
    } else {
      incumplidas.push(req.texto);
    }
  }

  const habilidadesExtraCandidato = destrezasCandidato.filter(
    (d) => !destrezasCoincidentesSet.has(d),
  );

  const porcentajeObtenido =
    Math.round((sumaPuntosHabilidades / habilidadesRequeridas.length) * 10000) /
    100;

  return {
    totalRequeridas: habilidadesRequeridas.length,
    totalCumplidas: cumplidas.length,
    cumplidas,
    incumplidas,
    habilidadesExtraCandidato,
    porcentajeObtenido: Math.min(100, Math.max(0, porcentajeObtenido)),
  };
}

// Funcion de calculo de nivel de afinidad
async function calcularAfinidad({
  convocatoria,
  datosCv,
  pesosPersonalizados = {},
}) {
  const pesos = {
    pesoEducacion: pesosPersonalizados.pesoEducacion ?? 25,
    pesoExperiencia: pesosPersonalizados.pesoExperiencia ?? 35,
    pesoHabilidades: pesosPersonalizados.pesoHabilidades ?? 40,
  };

  // 1. Manejo seguro de CV no procesado o fallido
  if (!datosCv || datosCv.estadoExtraccion === "FALLIDA") {
    return {
      porcentajeTotal: 0,
      esApto: false,
      motivosNoApto: [
        "El documento del CV no cuenta con datos extraídos válidos o legibles.",
      ],
      educacion: {
        nivelRequerido: convocatoria?.nivel_educacion_min || "N/A",
        nivelDetectado: "NO_DISPONIBLE",
        cumple: false,
        porcentajeObtenido: 0,
        pesoAsignado: pesos.pesoEducacion,
        puntosAportados: 0,
      },
      experiencia: {
        aniosRequeridos: Number(convocatoria?.year_experiencia_min) || 0,
        aniosDetectados: 0,
        cumple: false,
        porcentajeObtenido: 0,
        pesoAsignado: pesos.pesoExperiencia,
        puntosAportados: 0,
      },
      habilidades: {
        totalRequeridas: (convocatoria?.habilidades_clave_requeridas || [])
          .length,
        totalCumplidas: 0,
        cumplidas: [],
        incumplidas: convocatoria?.habilidades_clave_requeridas || [],
        habilidadesExtraCandidato: [],
        porcentajeObtenido: 0,
        pesoAsignado: pesos.pesoHabilidades,
        puntosAportados: 0,
      },
      fechaCalculo: new Date().toISOString(),
    };
  }

  const motivosNoApto = [];

  // 2. Dimensión: Educación
  const nivelMinimoRequerido = convocatoria.nivel_educacion_min || "BACHILLER";
  const ordenRequerido = MAPA_ORDEN_EDUCACION[nivelMinimoRequerido] || 1;
  const nivelCandidato = detectarNivelEducacionMaximo(datosCv.educacion);

  const cumpleEducacion = nivelCandidato.orden >= ordenRequerido;
  const porcentajeEducacion = cumpleEducacion
    ? 100
    : Math.max(0, Math.round((nivelCandidato.orden / ordenRequerido) * 100));

  if (!cumpleEducacion && ordenRequerido >= 2) {
    motivosNoApto.push(
      `No cumple el nivel educativo mínimo requerido (${nivelMinimoRequerido}). Nivel detectado: ${nivelCandidato.codigo}.`,
    );
  }

  // 3. Dimensión: Experiencia Laboral
  const aniosMinimosRequeridos = Number(convocatoria.year_experiencia_min) || 0;
  const aniosCandidato = Number(datosCv.aniosExperienciaEstimados) || 0;

  let porcentajeExperiencia = 100;
  let cumpleExperiencia = true;

  if (aniosMinimosRequeridos > 0) {
    cumpleExperiencia = aniosCandidato >= aniosMinimosRequeridos;
    porcentajeExperiencia = Math.min(
      100,
      (aniosCandidato / aniosMinimosRequeridos) * 100,
    );

    if (aniosMinimosRequeridos >= 2 && aniosCandidato === 0) {
      motivosNoApto.push(
        `La vacante exige al menos ${aniosMinimosRequeridos} años de experiencia laboral y el candidato registra 0 años.`,
      );
    }
  }

  // 4. Dimensión: Habilidades Técnicas
  const habilidadesEvaluadas = await evaluarHabilidades(
    convocatoria.habilidades_clave_requeridas || [],
    datosCv.destrezasTecnicas || [],
  );

  // 5. Ponderación final (0 - 100%)
  const puntosEducacion = (porcentajeEducacion * pesos.pesoEducacion) / 100;
  const puntosExperiencia =
    (porcentajeExperiencia * pesos.pesoExperiencia) / 100;
  const puntosHabilidades =
    (habilidadesEvaluadas.porcentajeObtenido * pesos.pesoHabilidades) / 100;

  let porcentajeTotal =
    Math.round(
      (puntosEducacion + puntosExperiencia + puntosHabilidades) * 100,
    ) / 100;

  // Penalización si incumple requisitos excluyentes
  const esApto = motivosNoApto.length === 0;
  if (!esApto) {
    porcentajeTotal = Math.min(porcentajeTotal, 49.0);
  }

  return {
    porcentajeTotal,
    esApto,
    motivosNoApto,
    educacion: {
      nivelRequerido: nivelMinimoRequerido,
      nivelDetectado: nivelCandidato.codigo,
      cumple: cumpleEducacion,
      porcentajeObtenido: Math.round(porcentajeEducacion * 100) / 100,
      pesoAsignado: pesos.pesoEducacion,
      puntosAportados: Math.round(puntosEducacion * 100) / 100,
    },
    experiencia: {
      aniosRequeridos: aniosMinimosRequeridos,
      aniosDetectados: aniosCandidato,
      cumple: cumpleExperiencia,
      porcentajeObtenido: Math.round(porcentajeExperiencia * 100) / 100,
      pesoAsignado: pesos.pesoExperiencia,
      puntosAportados: Math.round(puntosExperiencia * 100) / 100,
    },
    habilidades: {
      totalRequeridas: habilidadesEvaluadas.totalRequeridas,
      totalCumplidas: habilidadesEvaluadas.totalCumplidas,
      cumplidas: habilidadesEvaluadas.cumplidas,
      incumplidas: habilidadesEvaluadas.incumplidas,
      habilidadesExtraCandidato: habilidadesEvaluadas.habilidadesExtraCandidato,
      porcentajeObtenido: habilidadesEvaluadas.porcentajeObtenido,
      pesoAsignado: pesos.pesoHabilidades,
      puntosAportados: Math.round(puntosHabilidades * 100) / 100,
    },
    fechaCalculo: new Date().toISOString(),
  };
}

module.exports = {
  calcularAfinidad,
  similitudCoseno,
  similitudLexica,
  detectarNivelEducacionMaximo,
};

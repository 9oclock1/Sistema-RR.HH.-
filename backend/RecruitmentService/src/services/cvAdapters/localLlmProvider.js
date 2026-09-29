export const LocalLlmProvider = {
  /**
   * Soporta tanto texto plano como imágenes en base64 para CVs escaneados/gráficos.
   * @param {Object} input
   * @param {string} [input.rawText] - Texto plano extraído
   * @param {string[]} [input.imagesBase64] - Array de strings en base64 si el documento es gráfico/imagen
   */
  async extract({ rawText = "", imagesBase64 = [] }) {
    const baseUrl =
      process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";
    const model = process.env.OLLAMA_MODEL || "gemma-4-E4B-it-Q4_K_M";

    const prompt = `
      Eres un asistente experto en reclutamiento y Recursos Humanos. Analiza el siguiente Currículum Vitae y extrae los datos requeridos estrictamente en formato JSON válido, sin delimitadores adicionales ni texto explicativo.

      Esquema JSON obligatorio:
      {
        "educacion": [
          {
            "institucion": "Nombre de la universidad o entidad",
            "titulo": "Grado o carrera académica",
            "anioFin": 2024
          }
        ],
        "aniosExperienciaEstimados": 2.5,
        "destrezasTecnicas": ["Tecnología 1", "Tecnología 2"]
      }

      ${rawText ? `Contenido textual del CV:\n"""\n${rawText}\n"""` : "Extrae los datos a partir del documento adjunto en imagen."}
      `;

    const requestBody = {
      model,
      prompt,
      format: "json",
      stream: false,
      keep_alive: -1,
      options: {
        temperature: 0.1,
      },
    };

    if (imagesBase64 && imagesBase64.length > 0) {
      requestBody.images = imagesBase64;
    }

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `Error en Ollama (${response.status}): ${response.statusText}`,
      );
    }

    const data = await response.json();
    return JSON.parse(data.response);
  },
};

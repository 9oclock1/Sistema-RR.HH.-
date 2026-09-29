export const LocalLlmProvider = {
  async extract({ rawText = "", imagesBase64 = [] }) {
    const baseUrl =
      process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";
    const model = process.env.OLLAMA_MODEL;

    const prompt = `
      Eres un sistema experto en extracción de datos de hojas de vida y CVs.
      Analiza con suma atención el Currículum Vitae adjunto y devuelve OBLIGATORIAMENTE un JSON con esta estructura exacta:

      {
        "destrezasTecnicas": ["Destreza 1", "Destreza 2"],
        "educacion": [
          {
            "institucion": "Universidad o Instituto",
            "titulo": "Carrera o Grado obtenido",
            "anioFin": "año_final_en_numero"
          }
        ],
        "experienciaLaboral": [
          {
            "puesto": "Cargo o empleo desempeñado",
            "empresa": "Nombre de la empresa",
            "anioInicio": "año_inicial_en_numero",
            "anioFin": "año_final_en_numero",
            "esActual": true o false
          }
        ]
      }

      REGLAS ESTRICTAS:
      1. "educacion": Extrae TODOS los títulos, carreras o maestrías presentes en el documento. No omitas ninguno. "anioFin" debe ser el año final (entero).
      2. "experienciaLaboral": Extrae TODOS los empleos listados en la sección de Experiencia Laboral. Extrae el año de inicio ("anioInicio") y año de fin ("anioFin") tal como aparecen en el texto (ejemplo: si dice 2010-2030, anioInicio=2010 y anioFin=2030).
      3. "destrezasTecnicas": Extrae todas las habilidades y competencias listadas.
      4. Responde ÚNICAMENTE con el objeto JSON válido. Sin markdown, sin explicaciones adicionales.

      ${rawText ? `Texto plano del documento:\n"""\n${rawText}\n"""` : "Extrae los datos desde la imagen del CV adjunta."}
      `;

    const requestBody = {
      model,
      prompt,
      format: "json",
      stream: false,
      keep_alive: -1,
      options: {
        temperature: 0.0,
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

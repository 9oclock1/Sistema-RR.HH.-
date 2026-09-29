const SYSTEM_PROMPT = `
Eres un asistente experto en Recursos Humanos. Analiza el siguiente Currículum Vitae y extrae los datos en formato JSON estrictamente válido, sin texto adicional, sin backticks y sin markdown.

Esquema JSON obligatorio:
{
  "educacion": [
    {
      "institucion": "Nombre de la entidad o universidad",
      "titulo": "Grado o carrera",
      "anioFin": 2024
    }
  ],
  "aniosExperienciaEstimados": 3.0,
  "destrezasTecnicas": ["Tecnología 1", "Tecnología 2"]
}
`;

// Google
const callGoogle = async (rawText, model, apiKey) => {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: `${SYSTEM_PROMPT}\n\nDocumento CV:\n"""\n${rawText}\n"""` },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google API error [${response.status}]: ${errorBody}`);
  }

  const json = await response.json();
  const textOutput = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(textOutput);
};

// OpenAI
const callOpenAI = async (rawText, model, apiKey) => {
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Documento CV:\n"""\n${rawText}\n"""` },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error [${response.status}]: ${errorBody}`);
  }

  const json = await response.json();
  const textOutput = json.choices?.[0]?.message?.content;
  return JSON.parse(textOutput);
};

// Anthropic
const callAnthropic = async (rawText, model, apiKey) => {
  const endpoint = "https://api.anthropic.com/v1/messages";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Documento CV:\n"""\n${rawText}\n"""\n\nResponde ÚNICAMENTE con el objeto JSON solicitado:`,
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error [${response.status}]: ${errorBody}`);
  }

  const json = await response.json();
  const textOutput = json.content?.[0]?.text;
  const cleanJson = textOutput
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
  return JSON.parse(cleanJson);
};

export const CloudLlmProvider = {
  async extract(rawText) {
    const provider = (process.env.CLOUD_PROVIDER || "google").toLowerCase();
    const model = process.env.LLM_MODEL;

    if (!model) {
      throw new Error("La variable LLM_MODEL no está definida en el entorno.");
    }

    if (provider === "google") {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) throw new Error("GOOGLE_API_KEY no configurada.");
      return await callGoogle(rawText, model, apiKey);
    }

    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
      return await callOpenAI(rawText, model, apiKey);
    }

    if (provider === "anthropic") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada.");
      return await callAnthropic(rawText, model, apiKey);
    }

    throw new Error(
      `Proveedor CLOUD_PROVIDER desconocido: '${provider}'. Usa 'google', 'openai' o 'anthropic'.`,
    );
  },
};

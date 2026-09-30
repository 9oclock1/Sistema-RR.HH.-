const { LocalLlmProvider } = require("./cvAdapters/localLlmProvider");
const { CloudLlmProvider } = require("./cvAdapters/cloudLlmProvider");
const { RegexFallbackProvider } = require("./cvAdapters/regexFallbackProvider");
const { DatosExtraidosCvSchema } = require("../utils/cvDataSchema");
const { calcularAniosExperiencia } = require("../utils/experienceCalculator");

const CvParserService = {
  async parseCv({ rawText = "", imagesBase64 = [] }) {
    const provider = process.env.CV_PARSER_PROVIDER || "local";
    let extractedPayload;

    try {
      if (provider === "local") {
        extractedPayload = await LocalLlmProvider.extract({
          rawText,
          imagesBase64,
        });
      } else if (provider === "cloud") {
        extractedPayload = await CloudLlmProvider.extract(rawText);
      } else {
        extractedPayload = await RegexFallbackProvider.extract(rawText);
      }
    } catch (providerError) {
      console.warn(
        `[CvParserService] Fallo en '${provider}', usando fallback regex: ${providerError.message}`,
      );
      extractedPayload = await RegexFallbackProvider.extract(rawText);
    }

    const experiencias = extractedPayload.experienciaLaboral || [];

    const aniosCalculados =
      experiencias.length > 0
        ? calcularAniosExperiencia(experiencias)
        : Number(extractedPayload.aniosExperienciaEstimados) || 0;

    const resultadoConsolidado = {
      estadoExtraccion: "EXITOSA",
      educacion: extractedPayload.educacion || [],
      experienciaLaboral: experiencias,
      aniosExperienciaEstimados: aniosCalculados,
      destrezasTecnicas: extractedPayload.destrezasTecnicas || [],
      esVerificado: false,
      modificadoPor: null,
      fechaVerificacion: null,
      errorDetalle: null,
    };

    return DatosExtraidosCvSchema.parse(resultadoConsolidado);
  },
};

module.exports = { CvParserService };

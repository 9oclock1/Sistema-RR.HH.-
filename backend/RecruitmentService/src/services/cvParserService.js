import { LocalLlmProvider } from "./cvAdapters/localLlmProvider.js";
import { CloudLlmProvider } from "./cvAdapters/cloudLlmProvider.js";
import { RegexFallbackProvider } from "./cvAdapters/regexFallbackProvider.js";
import { DatosExtraidosCvSchema } from "../utils/cvDataSchema.js";

export const CvParserService = {
  /**
   * Orquesta la extracción de datos según el proveedor configurado.
   * @param {Object} params
   * @param {string} params.rawText - Texto plano extraído del documento
   * @param {string[]} [params.imagesBase64] - imágenes en base64 si no hubo texto suficiente
   */
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

    const resultadoConsolidado = {
      estadoExtraccion: "EXITOSA",
      educacion: extractedPayload.educacion || [],
      aniosExperienciaEstimados:
        Number(extractedPayload.aniosExperienciaEstimados) || 0,
      destrezasTecnicas: extractedPayload.destrezasTecnicas || [],
      esVerificado: false,
      modificadoPor: null,
      fechaVerificacion: null,
      errorDetalle: null,
    };

    return DatosExtraidosCvSchema.parse(resultadoConsolidado);
  },
};

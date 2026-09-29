import { TextExtractionService } from "./textExtractionService.js";
import { CvParserService } from "./cvParserService.js";
import { PostulacionModel } from "../models/postulacionModel.js";

export const CvProcessingService = {
  /**
   * Ejecuta el pipeline completo de extracción para una postulación.
   * Si ocurre un error, registra el estado 'FALLIDA' sin lanzar excepción.
   * @param {Object} params
   * @param {string} params.idPostulacion - UUID de la postulación
   * @param {Buffer} params.fileBuffer - Buffer del archivo en memoria
   * @param {string} params.mimetype - Formato MIME del archivo
   * @param {string} params.fileName - Nombre original del archivo
   */
  async procesarDocumentoPostulacion({
    idPostulacion,
    fileBuffer,
    mimetype,
    fileName,
  }) {
    try {
      const { rawText, isTextSufficient } =
        await TextExtractionService.extractText({
          fileInput: fileBuffer,
          mimetype,
          fileName,
        });

      if (!isTextSufficient) {
        console.warn(
          `[CvProcessingService] Contenido de texto insuficiente para postulación: ${idPostulacion}`,
        );
        const payloadFallido = {
          estadoExtraccion: "FALLIDA",
          educacion: [],
          aniosExperienciaEstimados: 0,
          destrezasTecnicas: [],
          esVerificado: false,
          modificadoPor: null,
          fechaVerificacion: null,
          errorDetalle: "DOCUMENT_NOT_PARSEABLE_OR_EMPTY",
        };
        await PostulacionModel.guardarDatosExtraidosCv(
          idPostulacion,
          payloadFallido,
        );
        return payloadFallido;
      }

      const datosParseados = await CvParserService.parseCv({ rawText });

      await PostulacionModel.guardarDatosExtraidosCv(
        idPostulacion,
        datosParseados,
      );
      return datosParseados;
    } catch (error) {
      console.error(
        `[CvProcessingService] Error al procesar CV de postulación ${idPostulacion}:`,
        error.message,
      );

      const payloadFallido = {
        estadoExtraccion: "FALLIDA",
        educacion: [],
        aniosExperienciaEstimados: 0,
        destrezasTecnicas: [],
        esVerificado: false,
        modificadoPor: null,
        fechaVerificacion: null,
        errorDetalle: error.message || "PROCESSING_FAILED",
      };

      await PostulacionModel.guardarDatosExtraidosCv(
        idPostulacion,
        payloadFallido,
      );
      return payloadFallido;
    }
  },
};

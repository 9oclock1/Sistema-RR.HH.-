import { fromBuffer } from "pdf2pic";
import { TextExtractionService } from "./textExtractionService.js";
import { CvParserService } from "./cvParserService.js";
import { PostulacionModel } from "../models/postulacionModel.js";

const convertirPdfPaginaABase64 = async (fileBuffer) => {
  try {
    const options = {
      density: 150,
      saveFilename: "cv_page",
      savePath: "/tmp",
      format: "png",
      width: 1200,
      height: 1600,
    };
    const convert = fromBuffer(fileBuffer, options);
    const pageToConvert = 1;
    const result = await convert(pageToConvert, { responseType: "base64" });
    return result?.base64 || null;
  } catch (err) {
    console.warn(
      `[CvProcessingService] No se pudo renderizar PDF a imagen: ${err.message}`,
    );
    return null;
  }
};

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

      let datosParseados;

      if (isTextSufficient) {
        datosParseados = await CvParserService.parseCv({ rawText });
      } else {
        console.info(
          `[CvProcessingService] Texto plano insuficiente (< 100 caracteres). Intentando análisis por visión ${idPostulacion}`,
        );

        const isPdf =
          mimetype?.includes("pdf") || fileName?.toLowerCase().endsWith(".pdf");
        let base64Image = null;

        if (isPdf) {
          base64Image = await convertirPdfPaginaABase64(fileBuffer);
        }

        if (base64Image) {
          datosParseados = await CvParserService.parseCv({
            rawText: "",
            imagesBase64: [base64Image],
          });
        } else {
          throw new Error("DOCUMENT_NOT_PARSEABLE_OR_EMPTY");
        }
      }

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

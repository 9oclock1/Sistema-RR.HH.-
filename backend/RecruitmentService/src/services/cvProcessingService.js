import { fromBuffer } from "pdf2pic";
import { getDocumentProxy } from "unpdf";
import { TextExtractionService } from "./textExtractionService.js";
import { CvParserService } from "./cvParserService.js";
import { DocxToPdfService } from "./docxToPdfService.js";
import { PostulacionModel } from "../models/postulacionModel.js";

const convertirPdfAPaginasBase64 = async (fileBuffer, maxPages = 4) => {
  try {
    const pdfDoc = await getDocumentProxy(new Uint8Array(fileBuffer));
    const totalPaginas = pdfDoc.numPages || 1;
    const paginasAConvertir = Math.min(totalPaginas, maxPages);

    const options = {
      density: 150,
      saveFilename: "cv_page",
      savePath: "/tmp",
      format: "png",
      width: 1200,
      height: 1600,
    };

    const convert = fromBuffer(fileBuffer, options);
    const base64Images = [];

    for (let page = 1; page <= paginasAConvertir; page++) {
      const result = await convert(page, { responseType: "base64" });
      if (result?.base64) {
        base64Images.push(result.base64);
      }
    }

    return base64Images;
  } catch (err) {
    console.warn(
      `[CvProcessingService] No se pudieron renderizar las páginas a imagen: ${err.message}`,
    );
    return [];
  }
};

export const CvProcessingService = {
  async procesarDocumentoPostulacion({
    idPostulacion,
    fileBuffer,
    mimetype = "",
    fileName = "",
  }) {
    try {
      const lowerName = fileName.toLowerCase();
      const isDocx =
        mimetype.includes("wordprocessingml") ||
        mimetype.includes("msword") ||
        lowerName.endsWith(".docx");

      let pdfBuffer = fileBuffer;

      // si es DOCX, convertir primero a PDF para unificar el análisis visual
      if (isDocx) {
        try {
          pdfBuffer = await DocxToPdfService.convertDocxToPdf(fileBuffer);
        } catch (docxErr) {
          console.warn(
            `[CvProcessingService] Falló conversión de DOCX a PDF, recurriendo a texto plano: ${docxErr.message}`,
          );
          pdfBuffer = null;
        }
      }

      let datosParseados = null;

      // si tenemos buffer PDF y usamos 'local', procesamos por visión multimodal
      if (pdfBuffer && process.env.CV_PARSER_PROVIDER === "local") {
        console.info(
          `[CvProcessingService] Extrayendo páginas como imágenes para postulación ${idPostulacion}`,
        );
        const imagesBase64 = await convertirPdfAPaginasBase64(pdfBuffer, 4);

        if (imagesBase64.length > 0) {
          try {
            datosParseados = await CvParserService.parseCv({
              rawText: "",
              imagesBase64,
            });
          } catch (visionError) {
            console.warn(
              `[CvProcessingService] Falló visión local, recurriendo a texto plano: ${visionError.message}`,
            );
          }
        }
      }

      // fallback a extracción de texto plano
      if (!datosParseados) {
        const { rawText, isTextSufficient } =
          await TextExtractionService.extractText({
            fileInput: fileBuffer,
            mimetype,
            fileName,
          });

        if (isTextSufficient) {
          datosParseados = await CvParserService.parseCv({ rawText });
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
        experienciaLaboral: [],
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

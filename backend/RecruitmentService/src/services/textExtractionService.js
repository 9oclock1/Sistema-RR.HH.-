import path from "path";
import { extractTextFromPdf } from "../utils/pdfExtractor.js";
import { extractTextFromDocx } from "../utils/docxExtractor.js";

const normalizeText = (text) => {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const TextExtractionService = {
  /**
   * Extrae y normaliza el texto de un documento PDF o DOCX.
   * Acepta un Buffer directo o una ruta en disco.
   * @param {Object} params
   * @param {Buffer|string} params.fileInput - Buffer en memoria o ruta física del archivo.
   * @param {string} [params.mimetype] - Mimetype
   * @param {string} [params.fileName] - Nombre del archivo original
   * @returns {Promise<{ rawText: string, charCount: number, isTextSufficient: boolean }>}
   */
  async extractText({ fileInput, mimetype = "", fileName = "" }) {
    const effectiveMime = mimetype.toLowerCase();
    const effectiveExt = (fileName ? path.extname(fileName) : "").toLowerCase();

    let extractedText = "";

    const isPdf = effectiveMime.includes("pdf") || effectiveExt === ".pdf";

    const isDocx =
      effectiveMime.includes("wordprocessingml") ||
      effectiveMime.includes("officedocument") ||
      effectiveExt === ".docx";

    if (isPdf) {
      extractedText = await extractTextFromPdf(fileInput);
    } else if (isDocx) {
      extractedText = await extractTextFromDocx(fileInput);
    } else {
      throw new Error(
        `Tipo de archivo no soportado para extracción: ${mimetype || effectiveExt}`,
      );
    }

    const cleanText = normalizeText(extractedText);
    const charCount = cleanText.length;
    const isTextSufficient = charCount >= 100;

    return {
      rawText: cleanText,
      charCount,
      isTextSufficient,
    };
  },
};

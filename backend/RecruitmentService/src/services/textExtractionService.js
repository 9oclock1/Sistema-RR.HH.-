import { extractText as extractPdfText } from "unpdf";
import mammoth from "mammoth";

export const TextExtractionService = {
  async extractText({ fileInput, mimetype = "", fileName = "" }) {
    if (!Buffer.isBuffer(fileInput)) {
      throw new Error(
        "Formato de entrada no soportado para extracción (se requiere Buffer).",
      );
    }

    const lowerName = fileName.toLowerCase();
    const isDocx =
      mimetype.includes("wordprocessingml") ||
      mimetype.includes("msword") ||
      mimetype.includes("officedocument") ||
      lowerName.endsWith(".docx");

    const isPdf = mimetype.includes("pdf") || lowerName.endsWith(".pdf");

    let rawText = "";

    try {
      if (isDocx) {
        const result = await mammoth.extractRawText({ buffer: fileInput });
        rawText = result.value || "";
      } else if (isPdf) {
        const { text } = await extractPdfText(new Uint8Array(fileInput));
        rawText = Array.isArray(text) ? text.join("\n") : text || "";
      } else {
        throw new Error(
          `Tipo de archivo no soportado: ${mimetype || fileName}`,
        );
      }

      const cleanText = rawText
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      const isTextSufficient = cleanText.length >= 200;

      return {
        rawText: cleanText,
        isTextSufficient,
        charCount: cleanText.length,
      };
    } catch (err) {
      throw new Error(`Fallo en lectura de documento: ${err.message}`);
    }
  },
};

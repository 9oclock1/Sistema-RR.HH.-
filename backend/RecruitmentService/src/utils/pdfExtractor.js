import fs from "fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

/**
 * Extrae texto plano de un documento PDF a partir de un Buffer o una ruta del sistema de archivos
 * @param {Buffer|string} input - Buffer del archivo o ruta del PDF.
 * @returns {Promise<string>} Texto plano contenido en el PDF.
 */
export const extractTextFromPdf = async (input) => {
  try {
    let dataBuffer;
    if (Buffer.isBuffer(input)) {
      dataBuffer = input;
    } else if (typeof input === "string") {
      dataBuffer = await fs.readFile(input);
    } else {
      throw new Error(
        "Formato de entrada no soportado para PDF (se requiere Buffer o ruta string)",
      );
    }

    const data = await pdfParse(dataBuffer);
    return data.text || "";
  } catch (error) {
    throw new Error(`Fallo en lectura de PDF: ${error.message}`);
  }
};

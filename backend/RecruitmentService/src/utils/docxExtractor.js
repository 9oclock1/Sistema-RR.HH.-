import mammoth from "mammoth";
import fs from "fs/promises";

/**
 * Extrae texto plano de un documento DOCX a partir de un Buffer o una ruta del sistema de archivos.
 * @param {Buffer|string} input - Buffer del archivo o ruta del DOCX.
 * @returns {Promise<string>} Texto plano contenido en el DOCX.
 */
export const extractTextFromDocx = async (input) => {
  try {
    let result;
    if (Buffer.isBuffer(input)) {
      result = await mammoth.extractRawText({ buffer: input });
    } else if (typeof input === "string") {
      result = await mammoth.extractRawText({ path: input });
    } else {
      throw new Error(
        "Formato de entrada no soportado para DOCX (se requiere Buffer o ruta string)",
      );
    }

    return result.value || "";
  } catch (error) {
    throw new Error(`Fallo en lectura de DOCX: ${error.message}`);
  }
};

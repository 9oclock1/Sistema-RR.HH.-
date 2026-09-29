import fs from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { v7 as uuidv7 } from "uuid";

const execAsync = promisify(exec);

export const DocxToPdfService = {
  /**
   * Convierte un buffer de archivo DOCX a un buffer PDF usando LibreOffice headless
   * @param {Buffer} docxBuffer
   * @returns {Promise<Buffer>}
   */
  async convertDocxToPdf(docxBuffer) {
    const tempDir = os.tmpdir();
    const tempId = uuidv7();
    const tempDocxPath = path.join(tempDir, `${tempId}.docx`);
    const tempPdfPath = path.join(tempDir, `${tempId}.pdf`);

    try {
      await fs.writeFile(tempDocxPath, docxBuffer);

      await execAsync(
        `soffice --headless --convert-to pdf --outdir "${tempDir}" "${tempDocxPath}"`,
      );

      const pdfBuffer = await fs.readFile(tempPdfPath);
      return pdfBuffer;
    } catch (error) {
      throw new Error(
        `Error convirtiendo DOCX a PDF con LibreOffice: ${error.message}`,
      );
    } finally {
      await fs.unlink(tempDocxPath).catch(() => {});
      await fs.unlink(tempPdfPath).catch(() => {});
    }
  },
};

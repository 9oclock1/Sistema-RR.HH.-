const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");
const { v7: uuidv7 } = require("uuid");

const execAsync = promisify(exec);

const DocxToPdfService = {
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

module.exports = { DocxToPdfService };

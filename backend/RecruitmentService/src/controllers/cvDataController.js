const fs = require("fs/promises");
const { createReadStream } = require("fs");
const { PostulacionModel } = require("../models/postulacionModel");
const { PostulacionService } = require("../services/postulacionService");
const { CvProcessingService } = require("../services/cvProcessingService");
const { ActualizarDatosCvManualSchema } = require("../utils/cvDataSchema");

async function obtenerBufferDeArchivo(fileDetails) {
  if (Buffer.isBuffer(fileDetails)) {
    return fileDetails;
  }
  if (Buffer.isBuffer(fileDetails?.buffer)) {
    return fileDetails.buffer;
  }

  const rutaArchivo =
    fileDetails?.path ||
    fileDetails?.filePath ||
    (typeof fileDetails === "string" ? fileDetails : null);
  if (rutaArchivo) {
    return await fs.readFile(rutaArchivo);
  }

  const stream =
    fileDetails?.stream ||
    (typeof fileDetails?.pipe === "function" ? fileDetails : null);
  if (stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  throw new Error(
    "No se pudo determinar el buffer o la ruta del archivo físico.",
  );
}

const CvDataController = {
  async obtenerDatosCv(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "El parámetro id de postulación es obligatorio.",
        });
      }

      const datosPostulacion =
        await PostulacionModel.obtenerDatosCvPorPostulacionId(id);

      if (!datosPostulacion) {
        return res.status(404).json({
          success: false,
          message: "No se encontró la postulación especificada.",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          idPostulacion: datosPostulacion.idPostulacion,
          cvArchivoUrl: datosPostulacion.cvArchivoUrl,
          cvFormatoMimetype: datosPostulacion.cvFormatoMimetype,
          datosCv: datosPostulacion.datosExtraidosCv || {
            estadoExtraccion: "PENDIENTE",
            educacion: [],
            experienciaLaboral: [],
            aniosExperienciaEstimados: 0,
            destrezasTecnicas: [],
            esVerificado: false,
          },
        },
      });
    } catch (error) {
      console.error("[CvDataController.obtenerDatosCv] Error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Error interno al recuperar los datos del CV.",
      });
    }
  },

  async actualizarDatosCv(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "El parámetro id de postulación es obligatorio.",
        });
      }

      const validacion = ActualizarDatosCvManualSchema.safeParse(req.body);
      if (!validacion.success) {
        console.error(
          "[CvDataController.actualizarDatosCv] Error de validación Zod:",
          JSON.stringify(validacion.error.format(), null, 2),
        );
        return res.status(400).json({
          success: false,
          message: "Los datos enviados no cumplen con el formato requerido.",
          errores: validacion.error.format(),
        });
      }

      const postulacionExistente = await PostulacionModel.obtenerPorId(id);
      if (!postulacionExistente) {
        return res.status(404).json({
          success: false,
          message: "No se encontró la postulación asociada para actualizar.",
        });
      }

      const resultado = await PostulacionModel.actualizarDatosCvManual(
        id,
        validacion.data,
      );

      return res.status(200).json({
        success: true,
        message: "Datos del CV actualizados y verificados correctamente.",
        data: resultado.datos_extraidos_cv,
      });
    } catch (error) {
      console.error(
        "[CvDataController.actualizarDatosCv] Error:",
        error.message,
      );
      return res.status(500).json({
        success: false,
        message: "Error interno al actualizar los datos del CV.",
      });
    }
  },

  async analizarCvExistente(req, res) {
    try {
      const { id } = req.params;
      const postulacion = await PostulacionModel.obtenerPorId(id);

      if (!postulacion || !postulacion.cv_archivo_url) {
        return res.status(404).json({
          success: false,
          message: "La postulación no existe o no cuenta con CV vinculado.",
        });
      }

      const { fileDetails, mimetype, downloadFileName } =
        await PostulacionService.obtenerArchivoCv(id);

      const fileBuffer = await obtenerBufferDeArchivo(fileDetails);

      const finalMimetype = mimetype || postulacion.cv_formato_mimetype || "";
      const isDocx =
        finalMimetype.includes("wordprocessingml") ||
        finalMimetype.includes("officedocument") ||
        postulacion.cv_archivo_url.endsWith(".docx");

      const extension = isDocx ? "docx" : "pdf";
      const resolvedFileName = downloadFileName || `cv_${id}.${extension}`;

      const datosExtraidos =
        await CvProcessingService.procesarDocumentoPostulacion({
          idPostulacion: id,
          fileBuffer,
          mimetype: finalMimetype,
          fileName: resolvedFileName,
        });

      return res.status(200).json({
        success: true,
        message: "CV analizado exitosamente.",
        data: datosExtraidos,
      });
    } catch (error) {
      console.error(
        "[CvDataController.analizarCvExistente] Error:",
        error.message,
      );
      return res.status(500).json({
        success: false,
        message: "Error al procesar el análisis del CV: " + error.message,
      });
    }
  },
};

module.exports = { CvDataController };

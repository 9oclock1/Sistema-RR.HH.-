import { PostulacionModel } from "../models/postulacionModel.js";
import { ActualizarDatosCvManualSchema } from "../utils/cvDataSchema.js";

export const CvDataController = {
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
};

import { PostulacionService } from "../services/postulacionService.js";

export const PostulacionController = {
  async crear(req, res, next) {
    try {
      const { idConvocatoria, idPostulante } = req.body;
      const file = req.file;

      const resultado = await PostulacionService.registrarPostulacionConCv({
        idConvocatoria,
        idPostulante,
        file,
      });

      return res.status(201).json({
        success: true,
        message: "Postulación y CV registrados exitosamente.",
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  },
};

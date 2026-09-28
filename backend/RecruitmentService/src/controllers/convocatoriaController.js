import { ConvocatoriaModel } from "../models/convocatoriaModel.js";

export const ConvocatoriaController = {
  async listar(req, res, next) {
    try {
      const convocatorias = await ConvocatoriaModel.listarActivas();
      return res.json({ success: true, data: convocatorias });
    } catch (error) {
      next(error);
    }
  },

  async listarPostulantes(req, res, next) {
    try {
      const { idConvocatoria } = req.params;
      const postulantes =
        await ConvocatoriaModel.listarPostulantesPorConvocatoria(
          idConvocatoria,
        );
      return res.json({ success: true, data: postulantes });
    } catch (error) {
      next(error);
    }
  },
};

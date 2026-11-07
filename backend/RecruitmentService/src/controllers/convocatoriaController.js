const { ConvocatoriaModel } = require("../models/convocatoriaModel");
const { leerFiltroAfinidad } = require("../utils/filtroAfinidad");

const ConvocatoriaController = {
  async listarPostulantes(req, res, next) {
    try {
      const { idConvocatoria } = req.params;
      const postulantes =
        await ConvocatoriaModel.listarPostulantesPorConvocatoria(
          idConvocatoria,
          leerFiltroAfinidad(req.query),
        );
      return res.json({ success: true, data: postulantes });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = { ConvocatoriaController };

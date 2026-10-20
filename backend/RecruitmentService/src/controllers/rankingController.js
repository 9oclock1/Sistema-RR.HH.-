const rankingService = require("../services/rankingService");
const { ErrorApp } = require("../utils/errores");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getRankingByConvocatoria(req, res, next) {
  try {
    const { id_convocatoria } = req.params;

    if (!id_convocatoria || !UUID_REGEX.test(id_convocatoria.trim())) {
      throw new ErrorApp(
        400,
        "El ID de la convocatoria no tiene un formato UUID válido.",
      );
    }

    const opciones = req.querySanitizada || req.query;

    const resultado = await rankingService.obtenerRankingCandidatos(
      id_convocatoria.trim(),
      opciones,
    );

    return res.status(200).json({
      success: true,
      statusCode: 200,
      data: resultado,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRankingByConvocatoria,
};

const rankingModel = require("../models/rankingModel");
const jobOpeningModel = require("../models/jobOpeningModel");
const { ErrorApp } = require("../utils/errores");

async function obtenerRankingCandidatos(idConvocatoria, opciones = {}) {
  const convocatoria = await jobOpeningModel.findById(idConvocatoria);
  if (!convocatoria) {
    throw new ErrorApp(404, "La convocatoria especificada no existe.");
  }

  const pagina = Math.max(1, parseInt(opciones.pagina, 10) || 1);
  const limite = Math.min(
    100,
    Math.max(1, parseInt(opciones.limite, 10) || 10),
  );

  const { postulantes, totalRegistros } =
    await rankingModel.obtenerRankingPorConvocatoria(idConvocatoria, {
      pagina,
      limite,
    });

  const totalPaginas = Math.ceil(totalRegistros / limite) || 1;

  return {
    convocatoria: {
      id_convocatoria: convocatoria.id_convocatoria,
      codigo_convocatoria: convocatoria.codigo_convocatoria,
      titulo_puesto: convocatoria.titulo_puesto,
      esta_activa: convocatoria.esta_activa,
    },
    paginacion: {
      total_registros: totalRegistros,
      pagina_actual: pagina,
      limite,
      total_paginas: totalPaginas,
      tiene_siguiente: pagina < totalPaginas,
      tiene_anterior: pagina > 1,
    },
    ranking: postulantes,
  };
}

module.exports = {
  obtenerRankingCandidatos,
};

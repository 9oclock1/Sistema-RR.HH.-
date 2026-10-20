const rankingModel = require("../models/rankingModel");
const jobOpeningModel = require("../models/jobOpeningModel");
const { ErrorApp } = require("../utils/errores");

async function obtenerRankingCandidatos(idConvocatoria, opciones = {}) {
  const convocatoria = await jobOpeningModel.findById(idConvocatoria);
  if (!convocatoria) {
    throw new ErrorApp(404, "La convocatoria especificada no existe.");
  }

  const {
    desempate = "experiencia",
    orden_desempate = "desc",
    experiencia_min = null,
    pretension_salarial_max = null,
    etapa = null,
    ciudad = null,
    pagina = 1,
    limite = 10,
  } = opciones;

  const { postulantes, totalRegistros } =
    await rankingModel.obtenerRankingPorConvocatoria(idConvocatoria, {
      desempate,
      orden_desempate,
      experiencia_min,
      pretension_salarial_max,
      etapa,
      ciudad,
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
    criterios_aplicados: {
      orden_primario: "score_afinidad DESC",
      criterio_desempate: desempate,
      sentido_desempate: orden_desempate.toUpperCase(),
      filtros: {
        experiencia_min,
        pretension_salarial_max,
        etapa,
        ciudad,
      },
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

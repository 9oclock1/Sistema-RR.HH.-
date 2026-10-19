const pool = require("../../db/pool");
const convocatoriasModel = require("../models/convocatoriasModel");
const { PostulacionModel } = require("../models/postulacionModel");
const { calcularAfinidad } = require("../utils/affinityCalculator");

const AffinityService = {
  // Individual
  async procesarAfinidadPostulacion(idPostulacion, pesosPersonalizados = null) {
    const postulacion = await PostulacionModel.obtenerPorId(idPostulacion);
    if (!postulacion) {
      throw new Error(`No se encontró la postulación con ID ${idPostulacion}`);
    }

    const convocatoria = await convocatoriasModel.obtenerPorId(
      pool,
      postulacion.id_convocatoria,
    );
    if (!convocatoria) {
      throw new Error(
        `No se encontró la convocatoria vinculada ${postulacion.id_convocatoria}`,
      );
    }

    const datosCv = postulacion.datos_extraidos_cv;

    const desglose = await calcularAfinidad({
      convocatoria,
      datosCv,
      pesosPersonalizados: pesosPersonalizados || {},
    });

    await PostulacionModel.guardarAfinidadPostulacion(idPostulacion, {
      porcentajeAfinidad: desglose.porcentajeTotal,
      afinidadDetalle: desglose,
    });

    await PostulacionModel.actualizarRankingsPorConvocatoria(
      postulacion.id_convocatoria,
    );

    return desglose;
  },

  // Recalculo masivo
  async recalcularAfinidadConvocatoria(
    idConvocatoria,
    pesosPersonalizados = null,
  ) {
    const convocatoria = await convocatoriasModel.obtenerPorId(
      pool,
      idConvocatoria,
    );
    if (!convocatoria) {
      throw new Error(`Convocatoria ${idConvocatoria} no encontrada.`);
    }

    const postulaciones =
      await PostulacionModel.listarPorConvocatoriaParaRecalculo(idConvocatoria);

    for (const pos of postulaciones) {
      if (pos.datos_extraidos_cv) {
        const desglose = await calcularAfinidad({
          convocatoria,
          datosCv: pos.datos_extraidos_cv,
          pesosPersonalizados: pesosPersonalizados || {},
        });

        await PostulacionModel.guardarAfinidadPostulacion(pos.id_postulacion, {
          porcentajeAfinidad: desglose.porcentajeTotal,
          afinidadDetalle: desglose,
        });
      }
    }

    await PostulacionModel.actualizarRankingsPorConvocatoria(idConvocatoria);

    return {
      totalRecalculados: postulaciones.length,
      idConvocatoria,
    };
  },
};

module.exports = { AffinityService };

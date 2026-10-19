const pool = require("../../db/pool");
const convocatoriasModel = require("../models/convocatoriasModel");
const { PostulacionModel } = require("../models/postulacionModel");
const { AffinityService } = require("../services/affinityService");
const { PesosAfinidadSchema } = require("../utils/cvDataSchema");

const AffinityController = {
  async obtenerDesgloseAfinidad(req, res, next) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "El identificador de la postulación es requerido.",
        });
      }

      const postulacion = await PostulacionModel.obtenerPorId(id);
      if (!postulacion) {
        return res.status(404).json({
          success: false,
          message: "No se encontró la postulación indicada.",
        });
      }

      const datosCv = postulacion.datos_extraidos_cv;
      let desglose = datosCv?.afinidadDetalle;

      // Si no tiene desglose previo o el porcentaje no coincide, calcularlo
      if (!desglose || postulacion.porcentaje_afinidad === null) {
        desglose = await AffinityService.procesarAfinidadPostulacion(id);
      }

      return res.status(200).json({
        success: true,
        data: {
          idPostulacion: id,
          idConvocatoria: postulacion.id_convocatoria,
          postulante:
            `${postulacion.nombres || ""} ${postulacion.apellidos || ""}`.trim(),
          puesto: postulacion.titulo_puesto,
          porcentajeAfinidad: desglose.porcentajeTotal,
          esApto: desglose.esApto,
          motivosNoApto: desglose.motivosNoApto || [],
          desglose,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async recalcularAfinidadPostulacion(req, res, next) {
    try {
      const { id } = req.params;
      let pesos = null;

      if (req.body && Object.keys(req.body).length > 0) {
        const validacion = PesosAfinidadSchema.safeParse(req.body);
        if (!validacion.success) {
          return res.status(400).json({
            success: false,
            message:
              "Los pesos especificados son inválidos. Deben sumar exactamente 100%.",
            errores: validacion.error.format(),
          });
        }
        pesos = validacion.data;
      }

      const desglose = await AffinityService.procesarAfinidadPostulacion(
        id,
        pesos,
      );

      return res.status(200).json({
        success: true,
        message: "Afinidad recalculada exitosamente.",
        data: {
          idPostulacion: id,
          porcentajeAfinidad: desglose.porcentajeTotal,
          esApto: desglose.esApto,
          desglose,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async recalcularAfinidadConvocatoria(req, res, next) {
    try {
      const { id } = req.params;
      let pesos = null;

      if (req.body && Object.keys(req.body).length > 0) {
        const validacion = PesosAfinidadSchema.safeParse(req.body);
        if (!validacion.success) {
          return res.status(400).json({
            success: false,
            message:
              "Los pesos especificados son inválidos. Deben sumar exactamente 100%.",
            errores: validacion.error.format(),
          });
        }
        pesos = validacion.data;
      }

      const convocatoria = await convocatoriasModel.obtenerPorId(pool, id);
      if (!convocatoria) {
        return res.status(404).json({
          success: false,
          message: "No se encontró la convocatoria especificada.",
        });
      }

      const resultado = await AffinityService.recalcularAfinidadConvocatoria(
        id,
        pesos,
      );

      return res.status(200).json({
        success: true,
        message: `Se recalcularon los porcentajes de afinidad de ${resultado.totalRecalculados} postulante(s).`,
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = { AffinityController };

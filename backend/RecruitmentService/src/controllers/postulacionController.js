const { PostulacionService } = require("../services/postulacionService");

const PostulacionController = {
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

  async obtenerCv(req, res, next) {
    try {
      const { idPostulacion } = req.params;
      const downloadMode = req.query.download === "true";

      const { fileDetails, mimetype, downloadFileName } =
        await PostulacionService.obtenerArchivoCv(idPostulacion);

      // cabeceras HTTP
      res.setHeader("Content-Type", mimetype);
      const disposition = downloadMode ? "attachment" : "inline";
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${downloadFileName}"`,
      );

      if (fileDetails.type === "local") {
        return res.sendFile(fileDetails.filePath);
      }

      if (fileDetails.type === "stream") {
        return fileDetails.stream.pipe(res);
      }
    } catch (error) {
      next(error);
    }
  },

  async adjuntarCv(req, res, next) {
    try {
      const { idPostulacion } = req.params;
      const file = req.file;

      const resultado = await PostulacionService.vincularCvAPostulacion({
        idPostulacion,
        file,
      });

      return res.status(200).json({
        success: true,
        message: "CV adjuntado y vinculado exitosamente a la postulación.",
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = { PostulacionController };

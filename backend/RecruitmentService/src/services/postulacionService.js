import { v7 as uuidv7 } from "uuid";
import { PostulacionModel } from "../models/postulacionModel.js";
import { saveFile, getFileDetails } from "./storageService.js";

export const PostulacionService = {
  async registrarPostulacionConCv({ idConvocatoria, idPostulante, file }) {
    if (!idConvocatoria || !idPostulante) {
      const error = new Error(
        "Los campos idConvocatoria e idPostulante son obligatorios.",
      );
      error.statusCode = 400;
      throw error;
    }

    if (!file) {
      const error = new Error("Es obligatorio adjuntar el archivo de CV.");
      error.statusCode = 400;
      throw error;
    }

    // Candidato ya postulo para esta vacante?
    const yaPostulo = await PostulacionModel.existePostulacion(
      idConvocatoria,
      idPostulante,
    );
    if (yaPostulo) {
      const error = new Error(
        "El postulante ya cuenta con un registro para esta convocatoria.",
      );
      error.statusCode = 409;
      throw error;
    }

    const idPostulacion = uuidv7();

    const fileExtension = file.originalname.split(".").pop();
    const uniqueFileName = `${idPostulacion}-cv.${fileExtension}`;
    const storageResult = await saveFile(file, uniqueFileName);

    const idEtapa = await PostulacionModel.getEtapaInicial();

    const nuevaPostulacion = await PostulacionModel.crear({
      idPostulacion,
      idConvocatoria,
      idPostulante,
      idEtapa,
      cvArchivoUrl: storageResult.url,
      cvFormatoMimetype: file.mimetype,
    });

    return {
      postulacion: nuevaPostulacion,
      archivo: storageResult,
    };
  },

  async obtenerArchivoCv(idPostulacion) {
    const postulacion = await PostulacionModel.obtenerPorId(idPostulacion);
    if (!postulacion) {
      const error = new Error("La postulación indicada no existe.");
      error.statusCode = 404;
      throw error;
    }

    if (!postulacion.cv_archivo_url) {
      const error = new Error(
        "La postulación no cuenta con un documento de CV vinculado.",
      );
      error.statusCode = 404;
      throw error;
    }

    const fileDetails = await getFileDetails(postulacion.cv_archivo_url);

    // extensión segun el mimetype
    const extension = postulacion.cv_formato_mimetype.includes("pdf")
      ? "pdf"
      : "docx";
    const nombreDescarga =
      `CV_${postulacion.nombres}_${postulacion.apellidos}.${extension}`.replace(
        /\s+/g,
        "_",
      );

    return {
      fileDetails,
      mimetype: postulacion.cv_formato_mimetype,
      downloadFileName: nombreDescarga,
    };
  },
};

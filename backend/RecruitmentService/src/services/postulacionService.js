import { v7 as uuidv7 } from "uuid";
import { PostulacionModel } from "../models/postulacionModel.js";
import { saveFile } from "./storageService.js";

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
};

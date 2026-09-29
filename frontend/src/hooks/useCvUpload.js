import { useState } from "react";
import { postulacionApi } from "../api/postulacion";

const LIMITE_TAMANO_MB = 5;
const LIMITE_TAMANO_BYTES = LIMITE_TAMANO_MB * 1024 * 1024;
const EXTENSIONES_PERMITIDAS = [".pdf", ".docx"];
const TIPOS_MIME_PERMITIDOS = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export function useCvUpload({ idConvocatoria, idPostulante, onExito } = {}) {
  const [archivo, setArchivo] = useState(null);
  const [errorValidacion, setErrorValidacion] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(null);

  const validarArchivo = (file) => {
    if (!file) {
      return "Debe seleccionar un archivo para su currículum vitae.";
    }

    // Validación de tamaño (Criterio 3)
    if (file.size > LIMITE_TAMANO_BYTES) {
      return `El archivo supera el tamaño máximo permitido de ${LIMITE_TAMANO_MB}MB.`;
    }

    // Validación de formato (Criterio 2)
    const nombre = file.name.toLowerCase();
    const extensionValida = EXTENSIONES_PERMITIDAS.some((ext) =>
      nombre.endsWith(ext),
    );
    const mimeValido = TIPOS_MIME_PERMITIDOS.includes(
      file.mimetype || file.type,
    );

    if (!extensionValida && !mimeValido) {
      return "Formato no permitido. Solo se aceptan archivos en formato PDF o DOCX.";
    }

    return null;
  };

  const seleccionarArchivo = (file) => {
    setErrorEnvio(null);
    if (!file) {
      setArchivo(null);
      setErrorValidacion(null);
      return false;
    }

    const error = validarArchivo(file);
    if (error) {
      setErrorValidacion(error);
      setArchivo(null);
      return false;
    }

    setErrorValidacion(null);
    setArchivo(file);
    return true;
  };

  const removerArchivo = () => {
    setArchivo(null);
    setErrorValidacion(null);
    setErrorEnvio(null);
  };

  const enviarPostulacion = async () => {
    if (!archivo) {
      setErrorValidacion("Debe adjuntar un archivo antes de enviar.");
      return null;
    }

    setEnviando(true);
    setErrorEnvio(null);

    try {
      const resultado = await postulacionApi.registrarPostulacionConCv({
        idConvocatoria,
        idPostulante,
        archivoCv: archivo,
      });

      if (onExito) {
        onExito(resultado);
      }
      return resultado;
    } catch (err) {
      const mensaje =
        err.message || "Ocurrió un error al enviar su postulación.";
      setErrorEnvio(mensaje);
      return null;
    } finally {
      setEnviando(false);
    }
  };

  return {
    archivo,
    errorValidacion,
    errorEnvio,
    enviando,
    limiteMb: LIMITE_TAMANO_MB,
    formatosPermitidos: ".pdf, .docx",
    seleccionarArchivo,
    removerArchivo,
    enviarPostulacion,
    setErrorEnvio,
  };
}

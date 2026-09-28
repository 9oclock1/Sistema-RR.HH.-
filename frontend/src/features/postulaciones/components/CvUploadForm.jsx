import { useState } from "react";
import { useCvUpload } from "../../../hooks/useCvUpload";
import FileInput from "../../../components/common/FileInput";
import { Boton, Alerta, useAvisos } from "../../../components/ui";
import { postulacionApi } from "../../../api/postulacion";
import { Send } from "lucide-react";
import "./CvUploadForm.css";

export default function CvUploadForm({
  idPostulacion,
  tituloConvocatoria = "Vacante seleccionada",
  alCompletar,
}) {
  const avisar = useAvisos();
  const [subiendo, setSubiendo] = useState(false);

  const manejarExito = (resultado) => {
    avisar({
      tono: "exito",
      titulo: "CV adjuntado con éxito",
      mensaje: "El documento se vinculó correctamente a la postulación del candidato.",
    });
    if (alCompletar) alCompletar(resultado);
  };

  const {
    archivo,
    errorValidacion,
    errorEnvio,
    formatosPermitidos,
    seleccionarArchivo,
    removerArchivo,
    setErrorEnvio,
  } = useCvUpload();

  const alEnviar = async (e) => {
    e.preventDefault();
    if (!archivo || subiendo || !idPostulacion) return;

    setSubiendo(true);
    setErrorEnvio(null);

    try {
      const resultado = await postulacionApi.adjuntarCvAPostulacion(idPostulacion, archivo);
      avisar({
        tono: "exito",
        titulo: "CV adjuntado con éxito",
        mensaje: "El documento se vinculó correctamente a la postulación del candidato.",
      });
      if (alCompletar) alCompletar(resultado);
    } catch (err) {
      setErrorEnvio(err.message || "Error al subir el currículum.");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <form className="cv-upload-form" onSubmit={alEnviar} noValidate>
      <div className="cv-upload-form__cabecera">
        <h4 className="cv-upload-form__titulo">Adjuntar Hoja de Vida</h4>
        <p className="cv-upload-form__subtitulo">{tituloConvocatoria}</p>
      </div>

      {errorEnvio && (
        <Alerta
          tono="peligro"
          titulo="No se pudo registrar el CV"
          role="alert"
          onCerrar={() => setErrorEnvio(null)}
        >
          {errorEnvio}
        </Alerta>
      )}

      <FileInput
        etiqueta="Currículum Vitae (CV)"
        ayuda="Archivos soportados: PDF o DOCX (máximo 5MB)"
        aceptar={formatosPermitidos}
        archivo={archivo}
        error={errorValidacion}
        deshabilitado={subiendo}
        requerido
        onSeleccionar={seleccionarArchivo}
        onRemover={removerArchivo}
      />

      <div className="cv-upload-form__acciones">
        <Boton
          type="submit"
          variante="primario"
          icono={Send}
          cargando={subiendo}
          disabled={!archivo || Boolean(errorValidacion) || subiendo || !idPostulacion}
        >
          {subiendo ? "Subiendo archivo..." : "Confirmar postulación"}
        </Boton>
      </div>
    </form>
  );
}

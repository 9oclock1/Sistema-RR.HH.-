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
    enviando,
    formatosPermitidos,
    seleccionarArchivo,
    removerArchivo,
    setErrorEnvio,
  } = useCvUpload();

  const alEnviar = async (e) => {
    e.preventDefault();
    if (!archivo) return;
    try {
      const resultado = await postulacionApi.adjuntarCvAPostulacion(idPostulacion, archivo);
      manejarExito(resultado);
    } catch (err) {
      setErrorEnvio(err.message || "Error al subir el CV.");
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
          titulo="No se pudo registrar la postulación"
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
        deshabilitado={enviando}
        requerido
        onSeleccionar={seleccionarArchivo}
        onRemover={removerArchivo}
      />

      <div className="cv-upload-form__acciones">
        <Boton
          type="submit"
          variante="primario"
          icono={Send}
          cargando={enviando}
          disabled={!archivo || Boolean(errorValidacion) || enviando}
        >
          Confirmar postulación
        </Boton>
      </div>
    </form>
  );
}

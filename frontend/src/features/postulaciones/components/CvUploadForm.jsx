import { useCvUpload } from "../../../hooks/useCvUpload";
import FileInput from "../../../components/common/FileInput";
import { Boton, Alerta, useAvisos } from "../../../components/ui";
import { Send } from "lucide-react";
import "./CvUploadForm.css";

export default function CvUploadForm({
  idConvocatoria,
  idPostulante,
  tituloConvocatoria = "Vacante seleccionada",
  alCompletar,
}) {
  const avisar = useAvisos();

  const manejarExito = (resultado) => {
    avisar({
      tono: "exito",
      titulo: "Postulación completada",
      mensaje: "Su currículum vitae ha sido adjuntado y registrado exitosamente.",
    });
    if (alCompletar) {
      alCompletar(resultado);
    }
  };

  const {
    archivo,
    errorValidacion,
    errorEnvio,
    enviando,
    formatosPermitidos,
    seleccionarArchivo,
    removerArchivo,
    enviarPostulacion,
    setErrorEnvio,
  } = useCvUpload({
    idConvocatoria,
    idPostulante,
    onExito: manejarExito,
  });

  const alEnviar = async (e) => {
    e.preventDefault();
    await enviarPostulacion();
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
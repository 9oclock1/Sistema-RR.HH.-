import { useState } from "react";
import { Eye, Download, ExternalLink, FileText } from "lucide-react";
import { Modal, Boton } from "../../../components/ui";
import { postulacionApi } from "../../../api/postulacion";
import "./CvViewer.css";

export default function CvViewer({
  idPostulacion,
  nombreCandidato = "Postulante",
  mimetype = "application/pdf",
}) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [descargando, setDescargando] = useState(false);

  if (!idPostulacion) return null;

  const esPdf = mimetype?.includes("pdf");
  const urlVisualizacion = postulacionApi.obtenerUrlCv(idPostulacion, false);

  const manejarDescarga = async () => {
    try {
      setDescargando(true);
      const extension = esPdf ? "pdf" : "docx";
      const nombreArchivo = `CV_${nombreCandidato.replace(/\s+/g, "_")}.${extension}`;
      await postulacionApi.descargarCvBlob(idPostulacion, nombreArchivo);
    } finally {
      setDescargando(false);
    }
  };

  const abrirEnPestana = () => {
    window.open(urlVisualizacion, "_blank", "noopener,noreferrer");
  };

  const pieModal = (
    <div className="cv-viewer-modal__pie">
      <Boton
        variante="sutil"
        icono={ExternalLink}
        onClick={abrirEnPestana}
      >
        Abrir en pestaña
      </Boton>
      <Boton
        variante="primario"
        icono={Download}
        cargando={descargando}
        onClick={manejarDescarga}
      >
        Descargar original
      </Boton>
    </div>
  );

  return (
    <div className="cv-viewer-acciones">
      <Boton
        variante="predeterminado"
        tamano="sm"
        icono={Eye}
        onClick={() => setModalAbierto(true)}
      >
        Visualizar CV
      </Boton>

      <Boton
        variante="sutil"
        tamano="sm"
        icono={Download}
        soloIcono
        aria-label="Descargar currículum"
        cargando={descargando}
        onClick={manejarDescarga}
      />

      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={`Currículum Vitae — ${nombreCandidato}`}
        tamano="lg"
        pie={pieModal}
      >
        <div className="cv-viewer-modal__cuerpo">
          {esPdf ? (
            <iframe
              src={urlVisualizacion}
              title={`CV de ${nombreCandidato}`}
              className="cv-viewer-modal__iframe"
            />
          ) : (
            <div className="cv-viewer-modal__docx">
              <FileText className="cv-viewer-modal__docx-icono" aria-hidden="true" />
              <p className="cv-viewer-modal__docx-titulo">Documento Microsoft Word (.docx)</p>
              <p className="cv-viewer-modal__docx-desc">
                Los archivos de formato Word no admiten previsualización embebida nativa en el navegador.
                Presione el botón para descargarlo o examinarlo localmente.
              </p>
              <Boton
                variante="primario"
                icono={Download}
                cargando={descargando}
                onClick={manejarDescarga}
              >
                Descargar documento (.docx)
              </Boton>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
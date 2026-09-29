import { useRef, useState, useId } from "react";
import { UploadCloud, FileText, Trash2 } from "lucide-react";
import "./FileInput.css";

export default function FileInput({
  etiqueta = "Currículum Vitae",
  ayuda = "Formatos permitidos: PDF o DOCX (máx. 5MB)",
  error,
  archivo,
  aceptar = ".pdf,.docx",
  requerido = false,
  deshabilitado = false,
  onSeleccionar,
  onRemover,
  className = "",
}) {
  const inputRef = useRef(null);
  const [arrastrando, setArrastrando] = useState(false);
  const idUnico = useId();

  const manejarArrastre = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (deshabilitado) return;
    if (e.type === "dragover" || e.type === "dragenter") {
      setArrastrando(true);
    } else if (e.type === "dragleave" || e.type === "drop") {
      setArrastrando(false);
    }
  };

  const manejarSoltar = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setArrastrando(false);
    if (deshabilitado) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onSeleccionar(e.dataTransfer.files[0]);
    }
  };

  const manejarCambioInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      onSeleccionar(e.target.files[0]);
    }
  };

  const abrirSelector = () => {
    if (!deshabilitado && inputRef.current) {
      inputRef.current.click();
    }
  };

  const formatearTamano = (bytes) => {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
  };

  return (
    <div className={`ds-campo ${className}`}>
      {etiqueta && (
        <label htmlFor={idUnico} className="ds-campo__etiqueta">
          {etiqueta} {requerido && <span className="ds-campo__requerido" aria-hidden="true">*</span>}
        </label>
      )}

      {!archivo ? (
        <div
          className={`file-input-dropzone ${arrastrando ? "file-input-dropzone--activo" : ""} ${
            error ? "file-input-dropzone--error" : ""
          } ${deshabilitado ? "file-input-dropzone--deshabilitado" : ""}`}
          onDragEnter={manejarArrastre}
          onDragOver={manejarArrastre}
          onDragLeave={manejarArrastre}
          onDrop={manejarSoltar}
          onClick={abrirSelector}
          tabIndex={deshabilitado ? -1 : 0}
          role="button"
          aria-label={`${etiqueta}. ${ayuda}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              abrirSelector();
            }
          }}
        >
          <input
            id={idUnico}
            ref={inputRef}
            type="file"
            accept={aceptar}
            onChange={manejarCambioInput}
            disabled={deshabilitado}
            className="file-input-oculto"
            tabIndex={-1}
          />
          <UploadCloud className="ds-icono file-input-dropzone__icono" aria-hidden="true" />
          <p className="file-input-dropzone__texto">
            <span className="file-input-dropzone__link">Haga clic para cargar</span> o arrastre y suelte su archivo aquí
          </p>
          {ayuda && <span className="file-input-dropzone__ayuda">{ayuda}</span>}
        </div>
      ) : (
        <div className="file-input-preview">
          <div className="file-input-preview__info">
            <FileText className="ds-icono file-input-preview__icono" aria-hidden="true" />
            <div className="file-input-preview__detalles">
              <span className="file-input-preview__nombre">{archivo.name}</span>
              <span className="file-input-preview__tamano">{formatearTamano(archivo.size)}</span>
            </div>
          </div>
          <button
            type="button"
            className="file-input-preview__boton-remover ds-foco"
            aria-label="Eliminar archivo seleccionado"
            onClick={onRemover}
            disabled={deshabilitado}
          >
            <Trash2 className="ds-icono" aria-hidden="true" />
          </button>
        </div>
      )}

      {error && (
        <p className="ds-campo__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
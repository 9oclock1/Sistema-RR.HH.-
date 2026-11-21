import { useRef, useState } from "react";
import { CircleAlert, FileImage, FileText, Paperclip, Upload, X } from "lucide-react";
import { Boton, TextoTruncado } from "../../components/ui";
import { MAX_MB, formatearTamano, tipoArchivoDe, validarArchivoRespaldo } from "./formato";

export default function ZonaRespaldo({ id, archivo, onCambiar, error, deshabilitado = false }) {
  const refEntrada = useRef(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [errorLocal, setErrorLocal] = useState(null);
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const mensajeError = errorLocal || error;

  const seleccionar = (lista) => {
    const nuevo = lista?.[0];
    if (!nuevo) return;
    const motivo = validarArchivoRespaldo(nuevo);
    if (motivo) {
      setErrorLocal(motivo);
      return;
    }
    setErrorLocal(null);
    onCambiar(nuevo);
  };

  const quitar = () => {
    setErrorLocal(null);
    onCambiar(null);
    requestAnimationFrame(() => refEntrada.current?.focus());
  };

  const alSoltar = (evento) => {
    evento.preventDefault();
    setArrastrando(false);
    if (!deshabilitado) seleccionar(evento.dataTransfer.files);
  };

  const alArrastrar = (evento) => {
    if (!Array.from(evento.dataTransfer.types).includes("Files")) return;
    evento.preventDefault();
    evento.dataTransfer.dropEffect = deshabilitado ? "none" : "copy";
    setArrastrando(true);
  };

  const alSalir = (evento) => {
    if (!evento.currentTarget.contains(evento.relatedTarget)) setArrastrando(false);
  };

  const clases = [
    "desv-zona",
    arrastrando && "desv-zona--activa",
    mensajeError && "desv-zona--error",
    deshabilitado && "desv-zona--deshabilitada",
  ]
    .filter(Boolean)
    .join(" ");

  const IconoArchivo = archivo && tipoArchivoDe(archivo) === "application/pdf" ? FileText : FileImage;

  return (
    <div className="ds-campo desv-respaldo">
      <span className="ds-campo__etiqueta" id={`${id}-etiqueta`}>
        Documento de respaldo
        <span className="ds-campo__requerido" aria-hidden="true">
          *
        </span>
      </span>

      <div className={clases} onDragEnter={alArrastrar} onDragOver={alArrastrar} onDragLeave={alSalir} onDrop={alSoltar}>
        <Upload className="ds-icono desv-zona__icono" aria-hidden="true" />
        <p className="desv-zona__texto">
          {arrastrando ? "Suelte el documento para adjuntarlo" : "Arrastre el documento aquí o"}
        </p>
        <input
          ref={refEntrada}
          id={id}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="ds-solo-lector"
          aria-labelledby={`${id}-etiqueta ${id}-boton`}
          aria-describedby={[mensajeError && idError, idAyuda].filter(Boolean).join(" ")}
          aria-invalid={mensajeError ? true : undefined}
          aria-required="true"
          disabled={deshabilitado}
          onChange={(evento) => {
            seleccionar(evento.target.files);
            evento.target.value = "";
          }}
        />
        <label
          htmlFor={id}
          id={`${id}-boton`}
          className={`ds-boton ds-boton--predeterminado ds-boton--md desv-zona__boton ${deshabilitado ? "desv-zona__boton--inactivo" : ""}`}
        >
          <Paperclip className="ds-icono" aria-hidden="true" />
          Elegir archivo
        </label>
      </div>

      {mensajeError && (
        <p className="ds-campo__error" id={idError}>
          <CircleAlert className="ds-icono" aria-hidden="true" />
          {mensajeError}
        </p>
      )}

      <p className="ds-campo__ayuda" id={idAyuda}>
        PDF, JPG o PNG. Tamaño máximo {MAX_MB} MB.
      </p>

      {archivo && (
        <ul className="desv-archivos" aria-label="Documento adjunto">
          <li className="desv-archivo">
            <IconoArchivo className="ds-icono desv-archivo__icono" aria-hidden="true" />
            <span className="desv-archivo__nombre">
              <TextoTruncado>{archivo.name}</TextoTruncado>
            </span>
            <span className="desv-archivo__tamano">{formatearTamano(archivo.size)}</span>
            <Boton
              variante="sutil"
              tamano="sm"
              soloIcono
              icono={X}
              aria-label={`Quitar «${archivo.name}»`}
              onClick={quitar}
              disabled={deshabilitado}
            />
          </li>
        </ul>
      )}
    </div>
  );
}

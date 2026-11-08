import { useRef, useState } from "react";
import { CircleAlert, FileImage, FileText, Paperclip, Upload, X } from "lucide-react";
import { Boton, TextoTruncado } from "../../components/ui";
import { MAX_ARCHIVOS, MAX_MB, claveDe, filtrarArchivos, tipoDe } from "../justificaciones/archivos";
import { formatearTamano } from "../justificaciones/formato";

export default function ZonaAdjuntos({ id, archivos, onCambiar, error, anonima, deshabilitado = false }) {
  const refEntrada = useRef(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [descartes, setDescartes] = useState([]);
  const [anuncio, setAnuncio] = useState("");
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const idDescartes = `${id}-descartes`;

  const agregar = (lista) => {
    const nuevos = Array.from(lista ?? []);
    if (nuevos.length === 0) return;
    const { aceptados, descartes: rechazados } = filtrarArchivos(archivos, nuevos);
    const agregados = aceptados.length - archivos.length;
    setDescartes(rechazados);
    setAnuncio(
      [agregados > 0 && `${agregados === 1 ? "Se agregó 1 archivo" : `Se agregaron ${agregados} archivos`}.`, ...rechazados]
        .filter(Boolean)
        .join(" "),
    );
    if (agregados > 0) onCambiar(aceptados);
  };

  const quitar = (archivo) => {
    onCambiar(archivos.filter((a) => a !== archivo));
    setDescartes([]);
    setAnuncio(`Se quitó «${archivo.name}».`);
    requestAnimationFrame(() => refEntrada.current?.focus());
  };

  const alSoltar = (evento) => {
    evento.preventDefault();
    setArrastrando(false);
    if (!deshabilitado) agregar(evento.dataTransfer.files);
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

  const lleno = archivos.length >= MAX_ARCHIVOS;
  const clases = [
    "qj-zona",
    arrastrando && "qj-zona--activa",
    error && "qj-zona--error",
    deshabilitado && "qj-zona--deshabilitada",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="ds-campo">
      <span className="ds-campo__etiqueta" id={`${id}-etiqueta`}>
        Adjuntos (opcional)
      </span>

      <div className={clases} onDragEnter={alArrastrar} onDragOver={alArrastrar} onDragLeave={alSalir} onDrop={alSoltar}>
        <Upload className="ds-icono qj-zona__icono" aria-hidden="true" />
        <p className="qj-zona__texto">{arrastrando ? "Suelte los archivos para adjuntarlos" : "Arrastre los archivos aquí o"}</p>
        <input
          ref={refEntrada}
          id={id}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="ds-solo-lector"
          aria-labelledby={`${id}-etiqueta ${id}-boton`}
          aria-describedby={[error && idError, descartes.length > 0 && idDescartes, idAyuda].filter(Boolean).join(" ")}
          aria-invalid={error ? true : undefined}
          disabled={deshabilitado || lleno}
          onChange={(evento) => {
            agregar(evento.target.files);
            evento.target.value = "";
          }}
        />
        <label
          htmlFor={id}
          id={`${id}-boton`}
          className={`ds-boton ds-boton--predeterminado ds-boton--md qj-zona__boton ${deshabilitado || lleno ? "qj-zona__boton--inactivo" : ""}`}
        >
          <Paperclip className="ds-icono" aria-hidden="true" />
          Elegir archivos
        </label>
      </div>

      {error && (
        <p className="ds-campo__error" id={idError}>
          <CircleAlert className="ds-icono" aria-hidden="true" />
          {error}
        </p>
      )}
      {descartes.length > 0 && (
        <ul className="qj-descartes" id={idDescartes}>
          {descartes.map((texto) => (
            <li key={texto}>{texto}</li>
          ))}
        </ul>
      )}
      <p className="ds-campo__ayuda" id={idAyuda}>
        PDF, JPG o PNG. Hasta {MAX_ARCHIVOS} archivos de {MAX_MB} MB cada uno
        {archivos.length > 0 && ` (${archivos.length} de ${MAX_ARCHIVOS})`}. Se quitan los metadatos de cada archivo
        (autor, ubicación, dispositivo){anonima && " y no se guarda su nombre"}.
      </p>

      {archivos.length > 0 && (
        <ul className="qj-archivos" aria-label="Archivos adjuntos">
          {archivos.map((archivo) => {
            const Icono = tipoDe(archivo) === "application/pdf" ? FileText : FileImage;
            return (
              <li key={claveDe(archivo)} className="qj-archivo">
                <Icono className="ds-icono qj-archivo__icono" aria-hidden="true" />
                <span className="qj-archivo__nombre">
                  <TextoTruncado>{archivo.name}</TextoTruncado>
                </span>
                <span className="qj-archivo__tamano">{formatearTamano(archivo.size)}</span>
                <Boton
                  variante="sutil"
                  tamano="sm"
                  soloIcono
                  icono={X}
                  aria-label={`Quitar «${archivo.name}»`}
                  onClick={() => quitar(archivo)}
                  disabled={deshabilitado}
                />
              </li>
            );
          })}
        </ul>
      )}

      <p className="ds-solo-lector" role="status">
        {anuncio}
      </p>
    </div>
  );
}

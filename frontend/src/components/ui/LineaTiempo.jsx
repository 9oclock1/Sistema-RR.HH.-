import { Circle } from "lucide-react";
import "./utilidades.css";
import "./LineaTiempo.css";

export default function LineaTiempo({ elementos, etiqueta, className = "" }) {
  return (
    <ol className={`ds-linea-tiempo ${className}`} aria-label={etiqueta}>
      {elementos.map(({ id, icono: Icono = Circle, tono = "neutral", titulo, meta, contenido }) => (
        <li key={id} className={`ds-linea-tiempo__paso ds-linea-tiempo__paso--${tono}`}>
          <span className="ds-linea-tiempo__marca" aria-hidden="true">
            <Icono className="ds-icono" />
          </span>
          <div className="ds-linea-tiempo__cuerpo">
            <div className="ds-linea-tiempo__titulo">{titulo}</div>
            {meta && <div className="ds-linea-tiempo__meta">{meta}</div>}
            {contenido && <div className="ds-linea-tiempo__contenido">{contenido}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

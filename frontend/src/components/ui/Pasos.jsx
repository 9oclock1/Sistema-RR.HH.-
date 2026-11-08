import { Check } from "lucide-react";
import "./utilidades.css";
import "./Pasos.css";

// Progreso de un asistente. pasos: [{ id, etiqueta }]; actual: id del paso en curso.
// Con onSeleccionar, los pasos ya completados se pueden abrir de nuevo para corregirlos.
export default function Pasos({ pasos, actual, etiqueta = "Pasos del asistente", onSeleccionar, className = "" }) {
  const indiceActual = pasos.findIndex((paso) => paso.id === actual);

  return (
    <ol className={`ds-pasos ${className}`} aria-label={etiqueta}>
      {pasos.map((paso, indice) => {
        const estado = indice < indiceActual ? "completado" : indice === indiceActual ? "actual" : "pendiente";
        const contenido = (
          <>
            <span className="ds-pasos__marca" aria-hidden="true">
              {estado === "completado" ? <Check className="ds-icono" /> : indice + 1}
            </span>
            <span className="ds-pasos__etiqueta">{paso.etiqueta}</span>
            {estado === "completado" && <span className="ds-solo-lector">(completado)</span>}
          </>
        );

        return (
          <li
            key={paso.id}
            className="ds-pasos__paso"
            data-estado={estado}
            aria-current={estado === "actual" ? "step" : undefined}
          >
            {onSeleccionar && estado === "completado" ? (
              <button
                type="button"
                className="ds-pasos__contenido ds-pasos__boton ds-foco"
                onClick={() => onSeleccionar(paso.id)}
              >
                {contenido}
              </button>
            ) : (
              <span className="ds-pasos__contenido">{contenido}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

import { CircleAlert } from "lucide-react";
import "./utilidades.css";
import "./Campo.css";

// Envoltorio de etiqueta, ayuda y error. Recibe una función que pinta el control con los atributos de accesibilidad.
export default function Campo({ id, etiqueta, ayuda, error, requerido = false, className = "", children }) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const descritoPor = [idError, idAyuda].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`ds-campo ${className}`}>
      {etiqueta && (
        <label className="ds-campo__etiqueta" htmlFor={id}>
          {etiqueta}
          {requerido && (
            <span className="ds-campo__requerido" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children({
        id,
        required: requerido,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": descritoPor,
      })}
      {error && (
        <p className="ds-campo__error" id={idError}>
          <CircleAlert className="ds-icono" aria-hidden="true" />
          {error}
        </p>
      )}
      {ayuda && (
        <p className="ds-campo__ayuda" id={idAyuda}>
          {ayuda}
        </p>
      )}
    </div>
  );
}

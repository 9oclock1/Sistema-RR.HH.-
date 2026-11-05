import { useId } from "react";
import { CircleAlert } from "lucide-react";
import "./utilidades.css";
import "./GrupoRadios.css";

// Opciones excluyentes. opciones: [{ valor, etiqueta, deshabilitada? }]; onChange recibe el valor elegido.
// Con disabled el grupo queda de solo lectura y la opción elegida sigue a la vista.
export default function GrupoRadios({
  id,
  leyenda,
  ayuda,
  error,
  requerido = false,
  opciones,
  value,
  onChange,
  name,
  disabled = false,
  className = "",
}) {
  const idGenerado = useId();
  const idGrupo = id ?? idGenerado;
  const idAyuda = ayuda ? `${idGrupo}-ayuda` : undefined;
  const idError = error ? `${idGrupo}-error` : undefined;
  const descritoPor = [idError, idAyuda].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      id={idGrupo}
      className={`ds-radios ${error ? "ds-radios--error" : ""} ${className}`}
      aria-describedby={descritoPor}
      disabled={disabled}
    >
      <legend className="ds-radios__leyenda">
        {leyenda}
        {requerido && (
          <span className="ds-radios__requerido" aria-hidden="true">
            *
          </span>
        )}
      </legend>
      <div className="ds-radios__opciones">
        {opciones.map((opcion) => (
          <label key={opcion.valor} className="ds-radios__opcion">
            <input
              type="radio"
              className="ds-radios__control"
              name={name ?? idGrupo}
              value={opcion.valor}
              checked={value === opcion.valor}
              disabled={opcion.deshabilitada}
              aria-invalid={error ? true : undefined}
              onChange={() => onChange?.(opcion.valor)}
            />
            <span>{opcion.etiqueta}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={idError} className="ds-radios__error">
          <CircleAlert className="ds-icono" aria-hidden="true" />
          {error}
        </p>
      )}
      {ayuda && (
        <p id={idAyuda} className="ds-radios__ayuda">
          {ayuda}
        </p>
      )}
    </fieldset>
  );
}

import { useId } from "react";
import "./utilidades.css";
import "./Casilla.css";

export default function Casilla({ id, etiqueta, ayuda, className = "", ...props }) {
  const idGenerado = useId();
  const idCasilla = id ?? idGenerado;
  const idAyuda = ayuda ? `${idCasilla}-ayuda` : undefined;

  return (
    <div className={`ds-casilla ${className}`}>
      <input
        type="checkbox"
        id={idCasilla}
        className="ds-casilla__control ds-foco"
        aria-describedby={idAyuda}
        {...props}
      />
      <label htmlFor={idCasilla} className="ds-casilla__etiqueta">
        {etiqueta}
      </label>
      {ayuda && (
        <p id={idAyuda} className="ds-casilla__ayuda">
          {ayuda}
        </p>
      )}
    </div>
  );
}

import "./utilidades.css";
import "./Esqueleto.css";

// forma: texto | circulo | bloque. ancho y alto aceptan cualquier medida CSS o un token, p. ej. "var(--size-avatar)".
export default function Esqueleto({ forma = "texto", ancho, alto, className = "" }) {
  return (
    <span
      className={`ds-esqueleto ds-esqueleto--${forma} ${className}`}
      style={{ width: ancho, height: alto }}
      aria-hidden="true"
    />
  );
}

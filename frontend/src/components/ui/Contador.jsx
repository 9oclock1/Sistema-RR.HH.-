import "./utilidades.css";
import "./Etiqueta.css";

// Píldora gris para cantidades. Pasa aria-label cuando el número solo no se entiende.
export default function Contador({ className = "", children, ...props }) {
  return (
    <span className={`ds-contador ${className}`} {...props}>
      {children}
    </span>
  );
}

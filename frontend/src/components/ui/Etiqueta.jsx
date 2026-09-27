import TextoTruncado from "./TextoTruncado";
import "./utilidades.css";
import "./Etiqueta.css";

// tono: neutral | exito | aviso | peligro | info | morado
export default function Etiqueta({ tono = "neutral", icono: Icono, className = "", children, ...props }) {
  return (
    <span className={`ds-etiqueta ds-etiqueta--${tono} ${className}`} {...props}>
      {Icono && <Icono className="ds-icono" aria-hidden="true" />}
      <TextoTruncado>{children}</TextoTruncado>
    </span>
  );
}

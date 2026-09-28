import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import Boton from "./Boton";
import "./utilidades.css";
import "./Alerta.css";

const ICONOS = { info: Info, exito: CircleCheck, aviso: TriangleAlert, peligro: CircleAlert };

// Mensaje en línea que permanece en la página. tono: info | exito | aviso | peligro.
// Para errores pasa role="alert"; para mover el foco a la alerta, tabIndex={-1} y ref.
export default function Alerta({ tono = "info", titulo, acciones, onCerrar, className = "", children, ...props }) {
  const Icono = ICONOS[tono] ?? Info;

  return (
    <div className={`ds-alerta ds-alerta--${tono} ${className}`} {...props}>
      <Icono className="ds-icono ds-alerta__icono" aria-hidden="true" />
      <div className="ds-alerta__texto">
        {titulo && <p className="ds-alerta__titulo">{titulo}</p>}
        {children && <div className="ds-alerta__cuerpo">{children}</div>}
        {acciones && <div className="ds-alerta__acciones">{acciones}</div>}
      </div>
      {onCerrar && (
        <Boton
          variante="sutil"
          tamano="sm"
          soloIcono
          icono={X}
          aria-label="Cerrar mensaje"
          className="ds-alerta__cerrar"
          onClick={onCerrar}
        />
      )}
    </div>
  );
}

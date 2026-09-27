import { Inbox } from "lucide-react";
import "./utilidades.css";
import "./EstadoVacio.css";

export default function EstadoVacio({ icono: Icono = Inbox, titulo, mensaje, accion, className = "" }) {
  return (
    <div className={`ds-vacio ${className}`}>
      <Icono className="ds-icono ds-vacio__icono" aria-hidden="true" />
      <p className="ds-vacio__titulo">{titulo}</p>
      {mensaje && <p className="ds-vacio__mensaje">{mensaje}</p>}
      {accion && <div className="ds-vacio__accion">{accion}</div>}
    </div>
  );
}

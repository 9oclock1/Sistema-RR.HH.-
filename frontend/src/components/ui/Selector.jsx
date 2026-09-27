import { useId } from "react";
import { ChevronDown } from "lucide-react";
import Campo from "./Campo";
import "./Selector.css";

// opciones: [{ valor, etiqueta, deshabilitada? }]. También acepta <option> como hijos.
export default function Selector({
  id,
  etiqueta,
  ayuda,
  error,
  requerido,
  className,
  opciones,
  textoVacio,
  children,
  ...props
}) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;

  return (
    <Campo id={idCampo} etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={requerido} className={className}>
      {(atributos) => (
        <div className="ds-selector">
          <select className="ds-control ds-selector__control" {...atributos} {...props}>
            {textoVacio !== undefined && <option value="">{textoVacio}</option>}
            {opciones?.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor} disabled={opcion.deshabilitada}>
                {opcion.etiqueta}
              </option>
            ))}
            {children}
          </select>
          <ChevronDown className="ds-icono ds-selector__flecha" aria-hidden="true" />
        </div>
      )}
    </Campo>
  );
}

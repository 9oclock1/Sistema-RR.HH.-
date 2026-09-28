import { useId } from "react";
import Campo from "./Campo";

export default function CampoAreaTexto({
  id,
  etiqueta,
  ayuda,
  error,
  requerido,
  className = "",
  filas = 4,
  ...props
}) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;

  return (
    <Campo id={idCampo} etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={requerido} className={className}>
      {(atributos) => (
        <textarea
          rows={filas}
          className="ds-control ds-control--area"
          {...atributos}
          {...props}
        />
      )}
    </Campo>
  );
}

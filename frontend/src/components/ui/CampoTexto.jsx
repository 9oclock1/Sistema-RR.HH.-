import { useId } from "react";
import Campo from "./Campo";

export default function CampoTexto({ id, etiqueta, ayuda, error, requerido, className, type = "text", ...props }) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;

  return (
    <Campo id={idCampo} etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={requerido} className={className}>
      {(atributos) => <input type={type} className="ds-control" {...atributos} {...props} />}
    </Campo>
  );
}

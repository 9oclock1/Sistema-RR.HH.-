import TextoTruncado from "./TextoTruncado";
import "./utilidades.css";
import "./Tarjeta.css";

// Con onClick la tarjeta es un botón completo; si tiene controles dentro, usa acciones en su lugar.
export default function Tarjeta({
  titulo,
  acciones,
  seleccionada = false,
  interactiva = false,
  onClick,
  className = "",
  children,
  ...props
}) {
  const esBoton = Boolean(onClick);
  const Elemento = esBoton ? "button" : "div";
  const clases = [
    "ds-tarjeta",
    (interactiva || esBoton) && "ds-tarjeta--interactiva",
    seleccionada && "ds-tarjeta--seleccionada",
    esBoton && "ds-foco",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Elemento
      className={clases}
      onClick={onClick}
      {...(esBoton && { type: "button", "aria-pressed": seleccionada })}
      {...props}
    >
      {(titulo || acciones) && (
        <div className="ds-tarjeta__encabezado">
          {titulo && (
            <TextoTruncado as={esBoton ? "span" : "h3"} className="ds-tarjeta__titulo">
              {titulo}
            </TextoTruncado>
          )}
          {acciones && <div className="ds-tarjeta__acciones">{acciones}</div>}
        </div>
      )}
      {children}
    </Elemento>
  );
}

import TextoTruncado from "./TextoTruncado";
import "./utilidades.css";
import "./Tarjeta.css";

// Con onClick la tarjeta es un botón completo; con "as" (p. ej. Link del router) y "to", un enlace completo.
// Si tiene controles dentro, usa acciones en su lugar.
export default function Tarjeta({
  as: Enlace,
  titulo,
  nivelTitulo = 3,
  acciones,
  seleccionada = false,
  interactiva = false,
  onClick,
  className = "",
  children,
  ...props
}) {
  const esBoton = !Enlace && Boolean(onClick);
  const esEnlace = Boolean(Enlace);
  const Elemento = Enlace ?? (esBoton ? "button" : "div");
  const clases = [
    "ds-tarjeta",
    (interactiva || esBoton || esEnlace) && "ds-tarjeta--interactiva",
    seleccionada && "ds-tarjeta--seleccionada",
    (esBoton || esEnlace) && "ds-foco",
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
            <TextoTruncado as={esBoton ? "span" : `h${nivelTitulo}`} className="ds-tarjeta__titulo">
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

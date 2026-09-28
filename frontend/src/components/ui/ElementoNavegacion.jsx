import Contador from "./Contador";
import TextoTruncado from "./TextoTruncado";
import "./utilidades.css";
import "./ElementoNavegacion.css";

// Con "as" (p. ej. NavLink del router) o "href" es un enlace; si no, un botón. NavLink marca el activo solo.
export default function ElementoNavegacion({ as: Elemento, icono: Icono, etiqueta, contador, activo, ...props }) {
  const contenido = (
    <>
      {Icono && <Icono className="ds-icono" aria-hidden="true" />}
      <TextoTruncado className="ds-nav-item__etiqueta">{etiqueta}</TextoTruncado>
      {contador !== undefined && <Contador>{contador}</Contador>}
    </>
  );

  if (Elemento) {
    return (
      <Elemento className="ds-nav-item ds-foco" {...props}>
        {contenido}
      </Elemento>
    );
  }

  const Base = props.href ? "a" : "button";
  return (
    <Base
      {...(Base === "button" && { type: "button" })}
      className={`ds-nav-item ds-foco ${activo ? "active" : ""}`}
      aria-current={activo ? "page" : undefined}
      {...props}
    >
      {contenido}
    </Base>
  );
}

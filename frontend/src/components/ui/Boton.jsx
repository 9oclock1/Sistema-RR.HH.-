import { LoaderCircle } from "lucide-react";
import "./utilidades.css";
import "./Boton.css";

export default function Boton({
  as: Enlace,
  variante = "predeterminado",
  tamano = "md",
  icono: Icono,
  soloIcono = false,
  cargando = false,
  disabled = false,
  type = "button",
  className = "",
  children,
  ...props
}) {
  const contenido = (
    <>
      {cargando ? (
        <LoaderCircle className="ds-icono ds-boton__giro" aria-hidden="true" />
      ) : (
        Icono && <Icono className="ds-icono" aria-hidden="true" />
      )}
      {!soloIcono && children}
    </>
  );
  const clases = [
    "ds-boton",
    "ds-foco",
    `ds-boton--${variante}`,
    `ds-boton--${tamano}`,
    soloIcono && "ds-boton--solo-icono",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Con href, o con "as" (p. ej. Link del router) y "to", se pinta como enlace con aspecto de botón.
  if (Enlace || props.href) {
    const Base = Enlace ?? "a";
    return (
      <Base className={clases} {...props}>
        {contenido}
      </Base>
    );
  }

  return (
    <button
      type={type}
      className={clases}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...props}
    >
      {contenido}
    </button>
  );
}

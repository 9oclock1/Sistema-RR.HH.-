import "./utilidades.css";
import "./EncabezadoPagina.css";

// migas: [{ etiqueta, href? }]; la página actual no va en migas, es el título.
// enlace: componente para las migas con href (p. ej. Link del router, que recibe "to").
export default function EncabezadoPagina({
  migas = [],
  enlace: Enlace = "a",
  titulo,
  idTitulo,
  descripcion,
  acciones,
  children,
  className = "",
}) {
  return (
    <header className={`ds-encabezado ${className}`}>
      {migas.length > 0 && (
        <nav aria-label="Ruta de navegación">
          <ol className="ds-encabezado__migas">
            {migas.map((miga) => (
              <li key={miga.etiqueta}>
                {miga.href ? (
                  <Enlace className="ds-foco" {...(Enlace === "a" ? { href: miga.href } : { to: miga.href })}>
                    {miga.etiqueta}
                  </Enlace>
                ) : (
                  miga.etiqueta
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="ds-encabezado__fila">
        <h1 id={idTitulo} className="ds-encabezado__titulo">
          {titulo}
        </h1>
        {acciones && <div className="ds-encabezado__acciones">{acciones}</div>}
      </div>
      {descripcion && <p className="ds-encabezado__descripcion">{descripcion}</p>}
      {children && <div className="ds-encabezado__pestanas">{children}</div>}
    </header>
  );
}

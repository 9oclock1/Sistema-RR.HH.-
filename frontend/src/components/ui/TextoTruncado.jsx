import "./utilidades.css";

// Corta el texto con puntos suspensivos y muestra el texto completo al pasar el cursor solo si no cabe.
export default function TextoTruncado({ as: Elemento = "span", className = "", children, ...props }) {
  const alEntrar = (evento) => {
    const nodo = evento.currentTarget;
    if (nodo.scrollWidth > nodo.clientWidth) nodo.title = nodo.textContent;
    else nodo.removeAttribute("title");
  };

  return (
    <Elemento className={`ds-truncar ${className}`} onMouseEnter={alEntrar} {...props}>
      {children}
    </Elemento>
  );
}

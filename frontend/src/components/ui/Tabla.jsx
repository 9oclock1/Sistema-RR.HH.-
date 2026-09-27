import Esqueleto from "./Esqueleto";
import TextoTruncado from "./TextoTruncado";
import "./utilidades.css";
import "./Tabla.css";

// columnas: [{ clave, titulo, ancho?, alinear?: "inicio" | "fin", celda?: (fila) => nodo }]
export default function Tabla({
  columnas,
  filas,
  claveFila = "id",
  descripcion,
  cargando = false,
  filasCargando = 5,
  vacio,
  className = "",
}) {
  const sinFilas = !cargando && filas.length === 0;

  return (
    // Contenedor enfocable para poder desplazar la tabla con el teclado en pantallas angostas.
    <div
      className={`ds-tabla-contenedor ds-foco ${className}`}
      role="region"
      aria-label={descripcion}
      tabIndex={0}
    >
      <table className="ds-tabla" aria-busy={cargando || undefined}>
        {descripcion && <caption className="ds-solo-lector">{descripcion}</caption>}
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th
                key={columna.clave}
                scope="col"
                style={{ width: columna.ancho }}
                className={columna.alinear === "fin" ? "ds-tabla__fin" : undefined}
              >
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cargando &&
            Array.from({ length: filasCargando }, (_, indice) => (
              <tr key={indice}>
                {columnas.map((columna) => (
                  <td key={columna.clave}>
                    <Esqueleto />
                  </td>
                ))}
              </tr>
            ))}
          {!cargando &&
            filas.map((fila) => (
              <tr key={fila[claveFila]}>
                {columnas.map((columna) => (
                  <td key={columna.clave} className={columna.alinear === "fin" ? "ds-tabla__fin" : undefined}>
                    {columna.celda ? columna.celda(fila) : <TextoTruncado>{fila[columna.clave]}</TextoTruncado>}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
      {sinFilas && vacio}
    </div>
  );
}

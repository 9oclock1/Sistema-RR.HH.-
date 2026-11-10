import { CircleAlert } from "lucide-react";
import { anchoBarra, describirBarra, formatearPuntaje, puntajeOGuion } from "./desempenoGlobal";

// Barras horizontales de 0 a 100 con la línea del umbral de brecha. Quien queda bajo el umbral se resalta con color,
// icono y la palabra «Brecha» (nunca solo con color). Cada barra se anuncia completa a los lectores de pantalla.
// items: [{ id, nombre, puntaje, es_brecha, sin_datos, puntos_bajo_umbral }]
export default function GraficoBarras({ items, umbral, etiqueta }) {
  return (
    <figure className="dg-figura">
      <figcaption className="dg-leyenda">
        <span className="dg-leyenda__item">
          <span className="dg-leyenda__linea" aria-hidden="true" />
          Umbral de brecha: {formatearPuntaje(umbral)}
        </span>
        <span className="dg-leyenda__item">
          <span className="dg-leyenda__muestra dg-leyenda__muestra--brecha" aria-hidden="true" />
          Bajo el umbral
        </span>
        <span className="dg-leyenda__item">
          <span className="dg-leyenda__muestra" aria-hidden="true" />
          Sobre el umbral
        </span>
      </figcaption>
      <ul className="dg-barras" aria-label={etiqueta}>
        {items.map((item) => (
          <li key={item.id} className={`dg-barra${item.es_brecha ? " dg-barra--brecha" : ""}`}>
            <span className="dg-barra__nombre">{item.nombre}</span>
            <span className="dg-barra__pista" role="img" aria-label={describirBarra(item, umbral)}>
              {!item.sin_datos && <span className="dg-barra__relleno" style={{ width: anchoBarra(item.puntaje) }} />}
              <span className="dg-barra__umbral" style={{ left: anchoBarra(umbral) }} aria-hidden="true" />
            </span>
            <span className="dg-barra__valor">
              {item.sin_datos ? <span className="dg-sutil">Sin datos</span> : puntajeOGuion(item.puntaje)}
              {item.es_brecha && (
                <span className="dg-barra__alerta">
                  <CircleAlert className="ds-icono" aria-hidden="true" />
                  Brecha
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

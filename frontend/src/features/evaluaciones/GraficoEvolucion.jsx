import { useState } from "react";
import { describirVariacion, formatearPuntaje, posicionX } from "./formato";

// Evolución del puntaje consolidado por periodo (0-100). Una sola serie: sin leyenda, el título la nombra.
// La línea va en un SVG estirado (los trazos no se deforman con vector-effect); los puntos, ejes y el
// tooltip son HTML posicionado en %, así los círculos y el texto conservan su tamaño en cualquier ancho.

const MARCAS_Y = [0, 25, 50, 75, 100];
export default function GraficoEvolucion({ evolucion }) {
  const [activo, setActivo] = useState(null);
  const puntos = evolucion
    .map((periodo, indice) => ({ ...periodo, x: posicionX(indice, evolucion.length), y: 100 - (periodo.puntaje ?? 0) }))
    .filter((p) => p.puntaje !== null);
  const seleccionado = activo === null ? null : puntos[activo];

  return (
    <div className="ev-grafico">
      <div className="ev-grafico__eje-y" aria-hidden="true">
        {MARCAS_Y.map((marca) => (
          <span key={marca} style={{ top: `${100 - marca}%` }}>
            {marca}
          </span>
        ))}
      </div>
      <div className="ev-grafico__area" onMouseLeave={() => setActivo(null)}>
        <svg className="ev-grafico__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {MARCAS_Y.map((marca) => (
            <line
              key={marca}
              className={marca === 0 ? "ev-grafico__base" : "ev-grafico__guia"}
              x1="0"
              x2="100"
              y1={100 - marca}
              y2={100 - marca}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {seleccionado && (
            <line className="ev-grafico__cruz" x1={seleccionado.x} x2={seleccionado.x} y1="0" y2="100" vectorEffect="non-scaling-stroke" />
          )}
          {puntos.length > 1 && (
            <polyline
              className="ev-grafico__linea"
              points={puntos.map((p) => `${p.x},${p.y}`).join(" ")}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {puntos.map((punto, indice) => (
          <button
            key={punto.id_periodo}
            type="button"
            className={`ev-grafico__punto${activo === indice ? " ev-grafico__punto--activo" : ""}`}
            style={{ left: `${punto.x}%`, top: `${punto.y}%` }}
            aria-label={`${punto.nombre}: ${formatearPuntaje(punto.puntaje)} de 100. ${describirVariacion(punto.variacion)}.`}
            onMouseEnter={() => setActivo(indice)}
            onFocus={() => setActivo(indice)}
            onBlur={() => setActivo(null)}
          >
            <span className="ev-grafico__marca" />
          </button>
        ))}
        {puntos.length > 0 && !seleccionado && (
          <span
            className="ev-grafico__etiqueta"
            style={{ left: `${puntos.at(-1).x}%`, top: `${puntos.at(-1).y}%` }}
            aria-hidden="true"
          >
            {formatearPuntaje(puntos.at(-1).puntaje)}
          </span>
        )}
        {seleccionado && (
          <div
            className={`ev-grafico__tooltip${seleccionado.x > 60 ? " ev-grafico__tooltip--izquierda" : ""}`}
            style={{ left: `${seleccionado.x}%`, top: `${seleccionado.y}%` }}
            aria-hidden="true"
          >
            <strong>{seleccionado.nombre}</strong>
            <span>
              Puntaje <strong>{formatearPuntaje(seleccionado.puntaje)}</strong> de 100
            </span>
            <span className="ev-sutil">{describirVariacion(seleccionado.variacion)}</span>
            {seleccionado.cantidad_ciclos > 1 && <span className="ev-sutil">Promedio de {seleccionado.cantidad_ciclos} ciclos</span>}
          </div>
        )}
      </div>
      <div className="ev-grafico__eje-x" aria-hidden="true">
        {puntos.map((punto) => (
          <span key={punto.id_periodo} style={{ left: `${punto.x}%` }}>
            {punto.nombre}
          </span>
        ))}
      </div>
    </div>
  );
}

import { ChartColumn } from "lucide-react";
import { EstadoVacio } from "../../components/ui";
import { alturaRelativa, formatearDecimal, formatearRango, pluralEvaluaciones } from "./dashboardDesempeno";

const describirRango = (rango, ultimo) =>
  `De ${formatearDecimal(rango.desde)} ${ultimo ? "a" : "a menos de"} ${formatearDecimal(rango.hasta)}: ${pluralEvaluaciones(rango.cantidad)} (${formatearDecimal(rango.porcentaje)} %)`;

export default function HistogramaCalificaciones({ histograma, meta }) {
  if (histograma.total === 0) {
    return (
      <EstadoVacio
        icono={ChartColumn}
        titulo="Sin calificaciones para mostrar"
        mensaje="No hay evaluaciones enviadas con los filtros elegidos."
      />
    );
  }

  const maximo = Math.max(...histograma.rangos.map((rango) => rango.cantidad));
  const ultimo = histograma.rangos.length - 1;

  return (
    <figure className="dd-figura">
      <figcaption className="dd-leyenda">
        <span className="dd-leyenda__item">
          <span className="dd-leyenda__muestra" aria-hidden="true" />
          En la meta ({formatearDecimal(meta)}) o sobre ella
        </span>
        <span className="dd-leyenda__item">
          <span className="dd-leyenda__muestra dd-leyenda__muestra--bajo" aria-hidden="true" />
          Bajo la meta
        </span>
      </figcaption>
      <ol className="dd-histograma" aria-label="Distribución de calificaciones, de 1 a 5">
        {histograma.rangos.map((rango, indice) => (
          <li key={rango.desde} className="dd-columna">
            <span className="dd-columna__cantidad">{rango.cantidad}</span>
            <span className="dd-columna__pista" role="img" aria-label={describirRango(rango, indice === ultimo)}>
              <span
                className={`dd-columna__barra${rango.desde < meta ? " dd-columna__barra--bajo" : ""}`}
                style={{ height: `${alturaRelativa(rango.cantidad, maximo)}%` }}
              />
            </span>
            <span className="dd-columna__rango">{formatearRango(rango)}</span>
          </li>
        ))}
      </ol>
      <p className="dd-sutil">
        {pluralEvaluaciones(histograma.total)} enviadas, agrupadas en rangos de medio punto sobre la escala de 1 a 5.
      </p>
    </figure>
  );
}

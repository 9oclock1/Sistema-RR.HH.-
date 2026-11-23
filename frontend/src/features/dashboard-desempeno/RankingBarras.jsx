import { CircleAlert, Trophy } from "lucide-react";
import { EstadoVacio } from "../../components/ui";
import { formatearDecimal, pluralEvaluaciones, porcentajeEnEscala } from "./dashboardDesempeno";

const MAXIMO = 5;

const describirItem = (item, meta) => {
  if (item.puntaje === null) return `${item.nombre}: sin evaluaciones enviadas`;
  const base = `Puesto ${item.posicion}, ${item.nombre}: ${formatearDecimal(item.puntaje)} de 5, meta ${formatearDecimal(meta)}`;
  return item.puntaje < meta ? `${base}. Bajo la meta` : base;
};

export default function RankingBarras({ items, meta, etiqueta, mensajeVacio }) {
  if (items.length === 0) {
    return <EstadoVacio icono={Trophy} titulo="Sin datos para el ranking" mensaje={mensajeVacio} />;
  }

  return (
    <figure className="dd-figura">
      <figcaption className="dd-leyenda">
        <span className="dd-leyenda__item">
          <span className="dd-leyenda__linea" aria-hidden="true" />
          Meta: {formatearDecimal(meta)}
        </span>
        <span className="dd-leyenda__item">
          <span className="dd-leyenda__muestra dd-leyenda__muestra--critica" aria-hidden="true" />
          Bajo la meta
        </span>
        <span className="dd-leyenda__item">
          <span className="dd-leyenda__muestra" aria-hidden="true" />
          En la meta o sobre ella
        </span>
      </figcaption>
      <ol className="dd-ranking" aria-label={etiqueta}>
        {items.map((item) => {
          const bajo = item.puntaje !== null && item.puntaje < meta;
          return (
            <li key={item.id} className={`dd-fila${bajo ? " dd-fila--bajo" : ""}`}>
              <span className="dd-fila__puesto" aria-hidden="true">
                {item.posicion ?? "—"}
              </span>
              <span className="dd-fila__nombre" title={item.nombre}>
                {item.nombre}
              </span>
              <span className="dd-fila__pista" role="img" aria-label={describirItem(item, meta)}>
                {item.puntaje !== null && (
                  <span className="dd-fila__relleno" style={{ width: `${porcentajeEnEscala(item.puntaje, 0, MAXIMO)}%` }} />
                )}
                <span className="dd-fila__meta" style={{ left: `${porcentajeEnEscala(meta, 0, MAXIMO)}%` }} aria-hidden="true" />
              </span>
              <span className="dd-fila__valor">
                {item.puntaje === null ? <span className="dd-sutil">Sin datos</span> : formatearDecimal(item.puntaje)}
                {bajo && (
                  <span className="dd-fila__alerta">
                    <CircleAlert className="ds-icono" aria-hidden="true" />
                    Bajo la meta
                  </span>
                )}
                <span className="dd-sutil">{pluralEvaluaciones(item.evaluaciones_enviadas)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

import { Tabla } from "../../components/ui";
import {
  describirTendencia,
  estadoDe,
  formatearNumero,
  formatearPorcentaje,
  nombrePeriodo,
  nombrePeriodoCorto,
  escalaEje,
} from "./formato";
import useAncho from "./useAncho";

const ALTO = 240;
const MARGEN = { arriba: 16, derecha: 28, abajo: 32, izquierda: 48 };

const COLUMNAS = [
  { clave: "mes", titulo: "Mes", celda: (f) => nombrePeriodo(f.periodo) },
  { clave: "valor", titulo: "Rotación", alinear: "fin", celda: (f) => formatearPorcentaje(f.valor) },
  { clave: "estado", titulo: "Semáforo", celda: (f) => estadoDe(f.estado).texto },
  { clave: "bajas", titulo: "Bajas", alinear: "fin" },
  { clave: "ingresos", titulo: "Ingresos", alinear: "fin" },
  { clave: "plantilla_promedio", titulo: "Plantilla", alinear: "fin", celda: (f) => formatearNumero(f.plantilla_promedio) },
];

// Línea de la tasa de rotación mensual con la línea punteada de la meta.
export default function GraficoTendencia({ tendencia, meta }) {
  const [ref, ancho] = useAncho();
  const { tope, divisiones } = escalaEje(tendencia.map((p) => p.valor), meta);
  const anchoUtil = Math.max(ancho - MARGEN.izquierda - MARGEN.derecha, 1);
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const paso = tendencia.length > 1 ? anchoUtil / (tendencia.length - 1) : 0;
  const x = (i) => MARGEN.izquierda + i * paso;
  const y = (valor) => MARGEN.arriba + altoUtil * (1 - Math.min(valor, tope) / tope);
  // En pantallas angostas se rotula un mes de cada dos.
  const cadaCuanto = anchoUtil / tendencia.length < 44 ? 2 : 1;

  const tramos = [];
  let actual = [];
  tendencia.forEach((p, i) => {
    if (p.valor === null) {
      if (actual.length) tramos.push(actual);
      actual = [];
    } else {
      actual.push(`${x(i)},${y(p.valor)}`);
    }
  });
  if (actual.length) tramos.push(actual);

  return (
    <figure className="rp-figura">
      <div ref={ref} className="rp-lienzo">
        <svg width={ancho} height={ALTO} role="img" aria-label={describirTendencia(tendencia)} className="rp-svg">
          {Array.from({ length: divisiones + 1 }, (_, i) => {
            const valor = (tope / divisiones) * i;
            return (
              <g key={i}>
                <line className="rp-eje__guia" x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(valor)} y2={y(valor)} />
                <text className="rp-eje__texto" x={MARGEN.izquierda - 8} y={y(valor)} textAnchor="end" dominantBaseline="middle">
                  {formatearPorcentaje(valor)}
                </text>
              </g>
            );
          })}
          <line className="rp-meta" x1={MARGEN.izquierda} x2={ancho - MARGEN.derecha} y1={y(meta)} y2={y(meta)} />
          {tramos.map((puntos, i) =>
            puntos.length > 1 ? <polyline key={i} className="rp-linea" points={puntos.join(" ")} /> : null
          )}
          {tendencia.map((p, i) =>
            p.valor === null ? null : (
              <circle key={p.periodo} className={`rp-punto rp-punto--${p.estado}`} cx={x(i)} cy={y(p.valor)} r={4}>
                <title>{`${nombrePeriodo(p.periodo)}: ${formatearPorcentaje(p.valor)} (${estadoDe(p.estado).texto})`}</title>
              </circle>
            )
          )}
          {tendencia.map((p, i) =>
            (tendencia.length - 1 - i) % cadaCuanto === 0 ? (
              <text key={p.periodo} className="rp-eje__texto" x={x(i)} y={ALTO - 8} textAnchor="middle">
                {nombrePeriodoCorto(p.periodo)}
              </text>
            ) : null
          )}
        </svg>
      </div>
      <figcaption className="rp-leyenda">
        <span className="rp-leyenda__item">
          <span className="rp-leyenda__linea" aria-hidden="true" />
          Rotación mensual
        </span>
        <span className="rp-leyenda__item">
          <span className="rp-leyenda__linea rp-leyenda__linea--meta" aria-hidden="true" />
          Meta: ≤ {formatearPorcentaje(meta)}
        </span>
      </figcaption>
      <details className="rp-datos">
        <summary className="ds-foco">Ver datos de la tendencia</summary>
        <Tabla columnas={COLUMNAS} filas={tendencia} claveFila="periodo" descripcion="Rotación mensual de los últimos 12 meses, con bajas, ingresos y plantilla promedio de cada mes" />
      </details>
    </figure>
  );
}

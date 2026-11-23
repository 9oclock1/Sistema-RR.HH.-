import { claseCausal, formatearPorcentaje, segmentosAnillo } from "./formato";

const LADO = 168;
const GROSOR = 28;
const RADIO = (LADO - GROSOR) / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

// Anillo con la distribución porcentual de las bajas por causal; la leyenda repite cada valor en texto.
export default function GraficoMotivos({ motivos }) {
  const segmentos = segmentosAnillo(motivos.items, CIRCUNFERENCIA);
  const resumen = motivos.items.map((i) => `${i.nombre}: ${formatearPorcentaje(i.porcentaje)} (${i.cantidad})`).join("; ");

  return (
    <figure className="rp-motivos">
      <svg
        width={LADO}
        height={LADO}
        viewBox={`0 0 ${LADO} ${LADO}`}
        role="img"
        aria-label={`Motivos de baja, ${motivos.total} en total. ${resumen}.`}
        className="rp-anillo"
      >
        <circle className="rp-anillo__fondo" cx={LADO / 2} cy={LADO / 2} r={RADIO} strokeWidth={GROSOR} />
        <g transform={`rotate(-90 ${LADO / 2} ${LADO / 2})`}>
          {segmentos.map((s) => (
            <circle
              key={s.codigo}
              cx={LADO / 2}
              cy={LADO / 2}
              r={RADIO}
              className={`rp-anillo__segmento ${s.clase}`}
              strokeWidth={GROSOR}
              strokeDasharray={`${s.largo} ${CIRCUNFERENCIA - s.largo}`}
              strokeDashoffset={s.desplazamiento}
            />
          ))}
        </g>
        <text className="rp-anillo__total" x={LADO / 2} y={LADO / 2 - 6} textAnchor="middle">
          {motivos.total}
        </text>
        <text className="rp-anillo__rotulo" x={LADO / 2} y={LADO / 2 + 14} textAnchor="middle">
          {motivos.total === 1 ? "baja" : "bajas"}
        </text>
      </svg>
      <figcaption>
        <ul className="rp-motivos__lista">
          {motivos.items.map((item, indice) => {
            const clase = item.cantidad > 0 ? claseCausal(item.codigo, indice) : "rp-causal--vacia";
            return (
              <li key={item.codigo} className="rp-motivos__item">
                <span className={`rp-motivos__muestra ${clase}`} aria-hidden="true" />
                <span className="rp-motivos__nombre">{item.nombre}</span>
                <span className="rp-motivos__valor">
                  {formatearPorcentaje(item.porcentaje)}
                  <span className="rp-sutil"> · {item.cantidad}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </figcaption>
    </figure>
  );
}

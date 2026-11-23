import { diaCorto, nivelDeCalor } from "./formato";

// Criterio 4: faltas justificadas/injustificadas y atrasos por día de la sucursal elegida.
export default function HeatmapDiario({ dias }) {
  const totalDe = (d) => d.faltas_justificadas + d.faltas_injustificadas + d.atrasos;
  const maximo = Math.max(0, ...dias.map(totalDe));

  return (
    <div className="da-heatmap" role="group" aria-label="Mapa de calor de faltas y atrasos por día">
      {dias.map((d) => {
        const total = totalDe(d);
        const nivel = nivelDeCalor(total, maximo);
        return (
          <div
            key={d.fecha}
            className={`da-heatmap__dia da-heatmap__dia--${nivel}`}
            title={`${diaCorto(d.fecha)}: ${d.faltas_injustificadas} falta(s) injustificada(s), ${d.faltas_justificadas} justificada(s), ${d.atrasos} atraso(s)`}
          >
            <span className="da-heatmap__fecha">{diaCorto(d.fecha)}</span>
            <span className="da-heatmap__total">{total}</span>
          </div>
        );
      })}
    </div>
  );
}

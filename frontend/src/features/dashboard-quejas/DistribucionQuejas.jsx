import { Inbox } from "lucide-react";
import { EstadoVacio } from "../../components/ui";
import { alturaRelativa, formatearDecimal, formatearPorcentaje } from "../dashboard-desempeno/dashboardDesempeno";
import { pluralQuejas } from "./dashboardQuejas";

const describirGrupo = (grupo) =>
  `${grupo.nombre}: ${pluralQuejas(grupo.quejas_recibidas)} recibidas, ${formatearPorcentaje(grupo.porcentaje_del_total)} del total`;

export default function DistribucionQuejas({ grupos, etiqueta }) {
  const conQuejas = grupos.filter((grupo) => grupo.quejas_recibidas > 0);
  if (conQuejas.length === 0) {
    return (
      <EstadoVacio icono={Inbox} titulo="Sin quejas recibidas" mensaje="No se recibieron quejas en el periodo con los filtros elegidos." />
    );
  }

  const maximo = Math.max(...conQuejas.map((grupo) => grupo.quejas_recibidas));

  return (
    <ol className="dq-distribucion" aria-label={etiqueta}>
      {conQuejas.map((grupo) => (
        <li key={grupo.id ?? grupo.nombre} className="dq-grupo">
          <span className="dq-grupo__nombre" title={grupo.nombre}>
            {grupo.nombre}
          </span>
          <span className="dd-fila__pista" role="img" aria-label={describirGrupo(grupo)}>
            <span className="dd-fila__relleno" style={{ width: `${alturaRelativa(grupo.quejas_recibidas, maximo)}%` }} />
          </span>
          <span className="dq-grupo__valor">
            <span className="dd-numero">{grupo.quejas_recibidas}</span>
            <span className="dd-sutil">{formatearPorcentaje(grupo.porcentaje_del_total)} del total</span>
          </span>
          <span className="dq-grupo__detalle dd-sutil">
            Resueltas: {grupo.quejas_resueltas} · Tasa: {formatearPorcentaje(grupo.tasa_resolucion)} · Tiempo:{" "}
            {grupo.tiempo_promedio_dias === null ? "—" : `${formatearDecimal(grupo.tiempo_promedio_dias)} días`}
          </span>
        </li>
      ))}
    </ol>
  );
}


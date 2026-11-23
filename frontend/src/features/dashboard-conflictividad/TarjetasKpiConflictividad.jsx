import { Etiqueta } from "../../components/ui";
import { estadoSemaforo, porcentajeEnEscala } from "../dashboard-desempeno/dashboardDesempeno";
import { formatearIndice, formatearMinutos } from "./dashboardConflictividad";

function Medidor({ valor, maximo, meta, descripcion, variante }) {
  return (
    <span className="dd-medidor" role="img" aria-label={descripcion}>
      <span className={`dd-medidor__relleno dd-medidor__relleno--${variante}`} style={{ width: `${porcentajeEnEscala(valor, 0, maximo)}%` }} />
      <span className="dd-medidor__meta" style={{ left: `${porcentajeEnEscala(meta, 0, maximo)}%` }} aria-hidden="true" />
    </span>
  );
}

function TarjetaKpi({ kpi, valor, detalle }) {
  const estado = estadoSemaforo(kpi.semaforo);
  const sinDatos = kpi.valor === null;
  const maximo = Math.max(kpi.meta * 2, kpi.valor ?? 0);
  return (
    <li className={`dd-kpi dd-kpi--${estado.variante}`}>
      <div className="dd-kpi__encabezado">
        <p className="dd-kpi__nombre">
          <span className="dd-kpi__codigo">{kpi.codigo}</span> {kpi.nombre}
        </p>
        <Etiqueta tono={estado.tono} icono={estado.icono}>
          {estado.texto}
        </Etiqueta>
      </div>
      <p className="dd-kpi__valor">{valor}</p>
      <Medidor
        valor={kpi.valor}
        maximo={maximo}
        meta={kpi.meta}
        variante={estado.variante}
        descripcion={sinDatos ? `${kpi.nombre}: sin datos` : `${kpi.nombre}: ${valor}. ${estado.texto}`}
      />
      <p className="dd-sutil">{detalle}</p>
    </li>
  );
}

// Las metas son mensuales: con un periodo de más de un mes, el valor es su equivalente mensual.
const porMes = (detalle) =>
  detalle.meses_periodo > 1 ? ` · equivalente mensual (${detalle.meses_periodo.toLocaleString("es-BO")} meses)` : "";

// Criterio 1: KPI-03 (índice de quejas) y KPI-06 (minutos de atraso promedio), con su semáforo.
export default function TarjetasKpiConflictividad({ indiceQuejas, minutosAtraso }) {
  return (
    <ul className="dd-kpis" aria-label="Indicadores del periodo">
      <TarjetaKpi
        kpi={indiceQuejas}
        valor={formatearIndice(indiceQuejas.valor)}
        detalle={`Meta: ≤ ${formatearIndice(indiceQuejas.meta)} al mes · ${indiceQuejas.detalle.quejas} quejas sobre ${indiceQuejas.detalle.empleados_activos} empleados activos${porMes(indiceQuejas.detalle)}`}
      />
      <TarjetaKpi
        kpi={minutosAtraso}
        valor={formatearMinutos(minutosAtraso.valor)}
        detalle={`Meta: ≤ ${formatearMinutos(minutosAtraso.meta)} al mes · ${minutosAtraso.detalle.minutos_atraso} min de atraso sobre ${minutosAtraso.detalle.empleados_activos} empleados activos${porMes(minutosAtraso.detalle)}`}
      />
    </ul>
  );
}

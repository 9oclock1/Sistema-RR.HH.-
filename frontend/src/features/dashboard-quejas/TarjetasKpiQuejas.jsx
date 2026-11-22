import { Etiqueta } from "../../components/ui";
import { estadoSemaforo, formatearDecimal, formatearPorcentaje, porcentajeEnEscala } from "../dashboard-desempeno/dashboardDesempeno";
import { escalaMedidor, formatearDias, pluralQuejas } from "./dashboardQuejas";

function Medidor({ valor, maximo, meta, descripcion, variante }) {
  return (
    <span className="dd-medidor" role="img" aria-label={descripcion}>
      <span className={`dd-medidor__relleno dd-medidor__relleno--${variante}`} style={{ width: `${porcentajeEnEscala(valor, 0, maximo)}%` }} />
      <span className="dd-medidor__meta" style={{ left: `${porcentajeEnEscala(meta, 0, maximo)}%` }} aria-hidden="true" />
    </span>
  );
}

function TarjetaKpi({ kpi, valor, meta, maximo, detalle }) {
  const estado = estadoSemaforo(kpi.semaforo);
  const sinDatos = kpi.valor === null;
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
        descripcion={sinDatos ? `${kpi.nombre}: sin datos` : `${kpi.nombre}: ${valor}. Meta ${meta}. ${estado.texto}`}
      />
      <p className="dd-sutil">Meta: {meta}</p>
      <p className="dd-sutil">{detalle}</p>
    </li>
  );
}

export default function TarjetasKpiQuejas({ tasa, tiempo }) {
  return (
    <ul className="dd-kpis" aria-label="Indicadores del periodo">
      <TarjetaKpi
        kpi={tasa}
        valor={formatearPorcentaje(tasa.valor)}
        meta={`≥ ${formatearPorcentaje(tasa.meta)}`}
        maximo={escalaMedidor(tasa.valor, tasa.meta, 100)}
        detalle={
          tasa.valor === null
            ? "No se recibieron quejas en el periodo con estos filtros"
            : `${pluralQuejas(tasa.quejas_resueltas)} resueltas de ${pluralQuejas(tasa.quejas_recibidas)} recibidas`
        }
      />
      <TarjetaKpi
        kpi={tiempo}
        valor={formatearDias(tiempo.valor)}
        meta={`≤ ${formatearDecimal(tiempo.meta)} días`}
        maximo={escalaMedidor(tiempo.valor, tiempo.meta)}
        detalle={
          tiempo.valor === null
            ? "No se resolvió ninguna queja en el periodo con estos filtros"
            : `Promedio de ${pluralQuejas(tiempo.quejas_resueltas)} resueltas`
        }
      />
    </ul>
  );
}

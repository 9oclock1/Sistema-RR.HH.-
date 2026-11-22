import { Etiqueta } from "../../components/ui";
import { estadoSemaforo, formatearDecimal, formatearPorcentaje, pluralEvaluaciones, porcentajeEnEscala } from "./dashboardDesempeno";

function Medidor({ valor, minimo, maximo, meta, descripcion, variante }) {
  return (
    <span className="dd-medidor" role="img" aria-label={descripcion}>
      <span
        className={`dd-medidor__relleno dd-medidor__relleno--${variante}`}
        style={{ width: `${porcentajeEnEscala(valor, minimo, maximo)}%` }}
      />
      <span className="dd-medidor__meta" style={{ left: `${porcentajeEnEscala(meta, minimo, maximo)}%` }} aria-hidden="true" />
    </span>
  );
}

function TarjetaKpi({ kpi, valor, unidad, meta, medidor, detalle }) {
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
      <p className="dd-kpi__valor">
        {valor}
        {!sinDatos && unidad && <span className="dd-kpi__unidad">{unidad}</span>}
      </p>
      <Medidor
        valor={kpi.valor}
        minimo={medidor.minimo}
        maximo={medidor.maximo}
        meta={kpi.meta}
        variante={estado.variante}
        descripcion={
          sinDatos
            ? `${kpi.nombre}: sin datos`
            : `${kpi.nombre}: ${valor}${unidad ?? ""}. Meta ${meta}. ${estado.texto}`
        }
      />
      <p className="dd-sutil">Meta: {meta}</p>
      <p className="dd-sutil">{detalle}</p>
    </li>
  );
}

export default function TarjetasKpi({ puntaje, cumplimiento }) {
  const detallePuntaje = `${pluralEvaluaciones(puntaje.evaluaciones_cerradas)} ${puntaje.evaluaciones_cerradas === 1 ? "cerrada" : "cerradas"} · ${formatearDecimal(puntaje.puntaje_sobre_100)} sobre 100`;
  const detalleCumplimiento = `${cumplimiento.evaluaciones_enviadas} de ${cumplimiento.evaluaciones_asignadas} enviadas · ${cumplimiento.evaluaciones_vencidas} ${cumplimiento.evaluaciones_vencidas === 1 ? "vencida" : "vencidas"}`;

  return (
    <ul className="dd-kpis" aria-label="Indicadores del ciclo">
      <TarjetaKpi
        kpi={puntaje}
        valor={formatearDecimal(puntaje.valor)}
        unidad=" de 5"
        meta={`≥ ${formatearDecimal(puntaje.meta)}`}
        medidor={{ minimo: puntaje.escala.minimo, maximo: puntaje.escala.maximo }}
        detalle={puntaje.valor === null ? "Sin evaluaciones enviadas con estos filtros" : detallePuntaje}
      />
      <TarjetaKpi
        kpi={cumplimiento}
        valor={formatearPorcentaje(cumplimiento.valor)}
        meta={`≥ ${formatearPorcentaje(cumplimiento.meta)}`}
        medidor={{ minimo: 0, maximo: 100 }}
        detalle={cumplimiento.valor === null ? "Sin evaluaciones asignadas con estos filtros" : detalleCumplimiento}
      />
    </ul>
  );
}

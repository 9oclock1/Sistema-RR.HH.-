import { ChartColumn } from "lucide-react";
import { EstadoVacio, Etiqueta, Tabla } from "../../components/ui";
import { alturaRelativa, estadoSemaforo, formatearPorcentaje } from "../dashboard-desempeno/dashboardDesempeno";
import { etiquetaMes, etiquetaMesCorta, formatearDias, pluralQuejas } from "./dashboardQuejas";

const describirMes = (mes) =>
  `${etiquetaMes(mes.mes)}: ${pluralQuejas(mes.quejas_recibidas)} recibidas y ${pluralQuejas(mes.quejas_resueltas)} resueltas`;

function ValorConSemaforo({ valor, codigo }) {
  const estado = estadoSemaforo(codigo);
  return (
    <div className="dd-celda">
      <span className="dd-numero">{valor}</span>
      {codigo && (
        <Etiqueta tono={estado.tono} icono={estado.icono}>
          {estado.corto}
        </Etiqueta>
      )}
    </div>
  );
}

const COLUMNAS = [
  {
    clave: "mes",
    titulo: "Mes",
    ancho: "20%",
    celda: (mes) => etiquetaMes(mes.mes),
  },
  { clave: "quejas_recibidas", titulo: "Recibidas", ancho: "15%", alinear: "fin", celda: (mes) => <span className="dd-numero">{mes.quejas_recibidas}</span> },
  { clave: "quejas_resueltas", titulo: "Resueltas", ancho: "15%", alinear: "fin", celda: (mes) => <span className="dd-numero">{mes.quejas_resueltas}</span> },
  {
    clave: "tasa",
    titulo: "Tasa de resolución",
    ancho: "25%",
    alinear: "fin",
    celda: (mes) => <ValorConSemaforo valor={formatearPorcentaje(mes.tasa_resolucion)} codigo={mes.semaforo_tasa} />,
  },
  {
    clave: "tiempo",
    titulo: "Tiempo promedio",
    ancho: "25%",
    alinear: "fin",
    celda: (mes) => <ValorConSemaforo valor={formatearDias(mes.tiempo_promedio_dias)} codigo={mes.semaforo_tiempo} />,
  },
];

export default function TendenciaMensual({ meses }) {
  const hayQuejas = meses.some((mes) => mes.quejas_recibidas > 0 || mes.quejas_resueltas > 0);
  if (!hayQuejas) {
    return (
      <EstadoVacio
        icono={ChartColumn}
        titulo="Sin quejas en el periodo"
        mensaje="No hay quejas recibidas ni resueltas con los filtros elegidos."
      />
    );
  }

  const maximo = Math.max(...meses.flatMap((mes) => [mes.quejas_recibidas, mes.quejas_resueltas]));

  return (
    <div className="dd-apilado">
      <figure className="dd-figura">
        <figcaption className="dd-leyenda">
          <span className="dd-leyenda__item">
            <span className="dd-leyenda__muestra" aria-hidden="true" />
            Quejas recibidas
          </span>
          <span className="dd-leyenda__item">
            <span className="dd-leyenda__muestra dq-muestra--resueltas" aria-hidden="true" />
            Quejas resueltas
          </span>
        </figcaption>
        <div className="dq-desplazable">
          <ol className="dq-meses" aria-label="Quejas recibidas y resueltas por mes" style={{ "--dq-meses": meses.length }}>
            {meses.map((mes) => (
              <li key={mes.mes} className="dq-mes">
                <span className="dq-mes__pista" role="img" aria-label={describirMes(mes)}>
                  <span className="dq-mes__barra" style={{ height: `${alturaRelativa(mes.quejas_recibidas, maximo)}%` }}>
                    <span className="dq-mes__cantidad">{mes.quejas_recibidas}</span>
                  </span>
                  <span
                    className="dq-mes__barra dq-mes__barra--resueltas"
                    style={{ height: `${alturaRelativa(mes.quejas_resueltas, maximo)}%` }}
                  >
                    <span className="dq-mes__cantidad">{mes.quejas_resueltas}</span>
                  </span>
                </span>
                <span className="dq-mes__nombre">{etiquetaMesCorta(mes.mes)}</span>
              </li>
            ))}
          </ol>
        </div>
      </figure>
      <Tabla
        className="dd-tabla"
        columnas={COLUMNAS}
        filas={meses}
        claveFila="mes"
        descripcion="Detalle mensual de quejas recibidas, resueltas, tasa de resolución y tiempo promedio"
      />
    </div>
  );
}

import { CalendarRange } from "lucide-react";
import { EstadoVacio, Etiqueta, Tabla, TextoTruncado } from "../../components/ui";
import {
  TENDENCIAS,
  describirVariacion,
  estadoSemaforo,
  formatearDecimal,
  formatearPorcentaje,
} from "./dashboardDesempeno";

function ValorConSemaforo({ valor, codigo }) {
  const estado = estadoSemaforo(codigo);
  return (
    <div className="dd-celda">
      <span className="dd-numero">{valor}</span>
      <Etiqueta tono={estado.tono} icono={estado.icono}>
        {estado.corto}
      </Etiqueta>
    </div>
  );
}

const COLUMNAS = [
  {
    clave: "nombre",
    titulo: "Ciclo",
    ancho: "26%",
    celda: (ciclo) => (
      <div className="dd-celda">
        <TextoTruncado>{ciclo.nombre}</TextoTruncado>
        <span className="dd-sutil">
          Periodo {ciclo.periodo}
          {ciclo.seleccionado && " · Ciclo seleccionado"}
        </span>
      </div>
    ),
  },
  {
    clave: "puntaje_promedio",
    titulo: "Puntaje promedio",
    ancho: "17%",
    alinear: "fin",
    celda: (ciclo) => <ValorConSemaforo valor={formatearDecimal(ciclo.puntaje_promedio)} codigo={ciclo.semaforo_puntaje} />,
  },
  {
    clave: "variacion",
    titulo: "Variación",
    ancho: "14%",
    alinear: "fin",
    celda: (ciclo) => {
      const tendencia = TENDENCIAS[ciclo.tendencia];
      if (!tendencia) return <span className="dd-sutil">Primer ciclo con datos</span>;
      return (
        <div className="dd-celda">
          <span className="dd-numero">{describirVariacion(ciclo.variacion)}</span>
          <Etiqueta tono={tendencia.tono} icono={tendencia.icono}>
            {tendencia.texto}
          </Etiqueta>
        </div>
      );
    },
  },
  {
    clave: "cumplimiento",
    titulo: "Cumplimiento",
    ancho: "16%",
    alinear: "fin",
    celda: (ciclo) => <ValorConSemaforo valor={formatearPorcentaje(ciclo.cumplimiento)} codigo={ciclo.semaforo_cumplimiento} />,
  },
  {
    clave: "alto_desempeno",
    titulo: "Alto desempeño",
    ancho: "15%",
    alinear: "fin",
    celda: (ciclo) => (
      <ValorConSemaforo valor={formatearPorcentaje(ciclo.alto_desempeno)} codigo={ciclo.semaforo_alto_desempeno} />
    ),
  },
  {
    clave: "evaluaciones",
    titulo: "Enviadas",
    ancho: "12%",
    alinear: "fin",
    celda: (ciclo) => (
      <span className="dd-numero">
        {ciclo.evaluaciones_enviadas} de {ciclo.evaluaciones_asignadas}
      </span>
    ),
  },
];

export default function ComparativoCiclos({ ciclos }) {
  return (
    <div className="dd-apilado">
      <p className="dd-sutil">
        Ciclos cerrados en orden cronológico. La variación compara el puntaje promedio (escala de 1 a 5) con el del ciclo anterior,
        con los mismos filtros de área y sucursal.
      </p>
      <Tabla
        className="dd-tabla"
        columnas={COLUMNAS}
        filas={ciclos}
        claveFila="id_ciclo"
        descripcion="Comparativo del puntaje promedio entre ciclos cerrados"
        vacio={<EstadoVacio icono={CalendarRange} titulo="Aún no hay ciclos cerrados" />}
      />
    </div>
  );
}

import { Building2 } from "lucide-react";
import { Alerta, EstadoVacio, Etiqueta, Tabla, TextoTruncado } from "../../components/ui";
import GraficoBarras from "./GraficoBarras";
import { describirDiferencia, estadoGrupo, formatearMinutos, formatearPuntaje, puntajeOGuion } from "./desempenoGlobal";

const TEXTOS = {
  departamento: { singular: "área", plural: "áreas", titulo: "Área", vacio: "No hay áreas con evaluaciones en este ciclo." },
  sucursal: { singular: "sucursal", plural: "sucursales", titulo: "Sucursal", vacio: "No hay sucursales con evaluaciones en este ciclo." },
};

const columnas = (titulo) => [
  {
    clave: "nombre",
    titulo,
    ancho: "17%",
    celda: (grupo) => <TextoTruncado>{grupo.nombre}</TextoTruncado>,
  },
  {
    clave: "puntaje",
    titulo: "Promedio",
    ancho: "10%",
    alinear: "fin",
    celda: (grupo) => <span className="dg-numero">{puntajeOGuion(grupo.puntaje)}</span>,
  },
  {
    clave: "diferencia",
    titulo: "Vs. promedio global",
    ancho: "12%",
    alinear: "fin",
    celda: (grupo) => <span className="dg-numero">{describirDiferencia(grupo.diferencia_global)}</span>,
  },
  {
    clave: "evaluados",
    titulo: "Evaluados",
    ancho: "11%",
    alinear: "fin",
    celda: (grupo) => (
      <div className="dg-celda">
        <span className="dg-numero">
          {grupo.evaluados} de {grupo.asignados}
        </span>
        {grupo.evaluaciones_vencidas > 0 && <span className="dg-sutil">{grupo.evaluaciones_vencidas} vencida(s)</span>}
      </div>
    ),
  },
  {
    clave: "competencia",
    titulo: "Competencia más baja",
    ancho: "17%",
    celda: (grupo) =>
      grupo.competencia_mas_baja ? (
        <div className="dg-celda">
          <span>{grupo.competencia_mas_baja.competencia}</span>
          <span className="dg-sutil">{formatearPuntaje(grupo.competencia_mas_baja.puntaje)}</span>
        </div>
      ) : (
        "—"
      ),
  },
  {
    clave: "crm",
    titulo: "Métricas del CRM",
    ancho: "18%",
    celda: (grupo) =>
      grupo.crm.colaboradores_con_metricas === 0 ? (
        <span className="dg-sutil">Sin métricas</span>
      ) : (
        <div className="dg-celda">
          <span>
            {grupo.crm.cantidad_quejas} quejas · {grupo.crm.cantidad_felicitaciones} felicitaciones
          </span>
          <span className="dg-sutil">
            {grupo.crm.colaboradores_con_metricas} colaborador(es) · {formatearMinutos(grupo.crm.minutos_resolucion_promedio)} de resolución
          </span>
        </div>
      ),
  },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "15%",
    celda: (grupo) => {
      const estado = estadoGrupo(grupo);
      return (
        <Etiqueta tono={estado.tono} icono={estado.icono}>
          {estado.texto}
        </Etiqueta>
      );
    },
  },
];

// Comparativa entre áreas o sucursales de un ciclo cerrado: gráfico con el umbral, aviso de brechas y detalle.
export default function ComparativaGrupos({ grupos, tipo, umbral, promedioGlobal }) {
  const texto = TEXTOS[tipo];
  if (grupos.length === 0) {
    return <EstadoVacio icono={Building2} titulo={texto.vacio} mensaje="Se muestran cuando el ciclo tiene evaluaciones." />;
  }

  const brechas = grupos.filter((grupo) => grupo.es_brecha);

  return (
    <div className="dg-apilado">
      {brechas.length > 0 ? (
        <Alerta
          tono="peligro"
          titulo={`Brecha de productividad en ${brechas.length} ${brechas.length === 1 ? texto.singular : texto.plural}`}
        >
          <ul className="dg-lista-brechas">
            {brechas.map((grupo) => (
              <li key={grupo.id}>
                <strong>{grupo.nombre}</strong>: promedio {formatearPuntaje(grupo.puntaje)}, {formatearPuntaje(grupo.puntos_bajo_umbral)}{" "}
                puntos bajo el umbral de {formatearPuntaje(umbral)}.
              </li>
            ))}
          </ul>
        </Alerta>
      ) : (
        <Alerta tono="exito" titulo={`Ninguna ${texto.singular} quedó bajo el umbral de ${formatearPuntaje(umbral)}`} />
      )}

      <GraficoBarras items={grupos} umbral={umbral} etiqueta={`Promedio por ${texto.singular}`} />

      <p className="dg-sutil">Promedio global del ciclo: {puntajeOGuion(promedioGlobal)}</p>
      <Tabla
        className="dg-tabla dg-tabla--ancha"
        descripcion={`Comparativa de desempeño por ${texto.singular}`}
        columnas={columnas(texto.titulo)}
        filas={grupos}
        claveFila="id"
      />
    </div>
  );
}

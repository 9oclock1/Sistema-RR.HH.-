import { Shapes } from "lucide-react";
import { EstadoVacio, Tabla, TextoTruncado } from "../../components/ui";
import GraficoBarras from "./GraficoBarras";
import { formatearPuntaje, puntajeOGuion } from "./desempenoGlobal";

// El servicio devuelve la competencia como { id_competencia, competencia, puntaje, es_brecha }; el gráfico espera
// { id, nombre, ... } y los puntos que faltan para llegar al umbral.
const comoBarra = (competencia, umbral) => ({
  id: competencia.id_competencia,
  nombre: competencia.competencia,
  puntaje: competencia.puntaje,
  es_brecha: competencia.es_brecha,
  sin_datos: competencia.puntaje === null,
  puntos_bajo_umbral: competencia.es_brecha ? Math.round((umbral - competencia.puntaje) * 100) / 100 : 0,
});

function Celda({ competencia }) {
  if (!competencia) return <span className="dg-sutil">—</span>;
  return (
    <span className={`dg-celda-puntaje${competencia.es_brecha ? " dg-celda-puntaje--brecha" : ""}`}>
      {puntajeOGuion(competencia.puntaje)}
      {competencia.es_brecha && <span className="ds-solo-lector"> (bajo el umbral)</span>}
    </span>
  );
}

// Promedio de cada competencia en todo el ciclo y matriz área × competencia para ubicar dónde está la brecha.
export default function MatrizCompetencias({ competencias, departamentos, umbral }) {
  if (competencias.length === 0) {
    return (
      <EstadoVacio
        icono={Shapes}
        titulo="Aún no hay competencias evaluadas"
        mensaje="Aparecen cuando el ciclo tiene evaluaciones enviadas."
      />
    );
  }

  const columnas = [
    {
      clave: "area",
      titulo: "Área",
      ancho: "22%",
      celda: (grupo) => <TextoTruncado>{grupo.nombre}</TextoTruncado>,
    },
    ...competencias.map((competencia) => ({
      clave: competencia.id_competencia,
      titulo: competencia.competencia,
      alinear: "fin",
      celda: (grupo) => (
        <Celda competencia={grupo.competencias.find((c) => c.id_competencia === competencia.id_competencia)} />
      ),
    })),
  ];

  return (
    <div className="dg-apilado">
      <GraficoBarras items={competencias.map((c) => comoBarra(c, umbral))} umbral={umbral} etiqueta="Promedio por competencia" />
      <h3 className="dg-subtitulo">Competencias por área</h3>
      <p className="dg-sutil">
        Las celdas en rojo quedan por debajo del umbral de {formatearPuntaje(umbral)}. Una celda vacía significa que el área no tuvo
        respuestas para esa competencia.
      </p>
      <Tabla className="dg-tabla" descripcion="Puntaje por competencia de cada área" columnas={columnas} filas={departamentos} claveFila="id" />
    </div>
  );
}

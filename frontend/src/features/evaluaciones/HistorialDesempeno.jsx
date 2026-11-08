import { useState } from "react";
import { Link } from "react-router";
import { LineChart, Table2 } from "lucide-react";
import { Boton, EstadoVacio, Etiqueta, Tabla, Tarjeta } from "../../components/ui";
import { formatearFecha } from "../solicitud-vacaciones/formato";
import { formatearFechaHora } from "../justificaciones/formato";
import { describirVariacion, formatearPuntaje } from "./formato";
import GraficoEvolucion from "./GraficoEvolucion";
import { CAMPOS_RETROALIMENTACION, tieneContenido } from "./retroalimentacion";
import { rutaMiResultado } from "./ruta";

// Consulta de evaluaciones individuales: puntaje histórico por periodo y consolidado de cada ciclo cerrado
// (puntaje final, desglose por competencia y retroalimentación de cada evaluador). Solo lectura.

const puntajeOGuion = (valor) => (valor === null || valor === undefined ? "—" : formatearPuntaje(valor));

const COLUMNAS_EVOLUCION = [
  { clave: "periodo", titulo: "Periodo", celda: (p) => p.nombre },
  { clave: "puntaje", titulo: "Puntaje", ancho: "20%", alinear: "fin", celda: (p) => puntajeOGuion(p.puntaje) },
  {
    clave: "variacion",
    titulo: "Variación",
    ancho: "30%",
    alinear: "fin",
    celda: (p) => (p.variacion === null ? "—" : `${p.variacion > 0 ? "+" : p.variacion < 0 ? "−" : ""}${formatearPuntaje(Math.abs(p.variacion))}`),
  },
];

const COLUMNAS_COMPETENCIA = [
  { clave: "competencia", titulo: "Competencia" },
  { clave: "peso", titulo: "Peso", ancho: "20%", alinear: "fin", celda: (c) => `${puntajeOGuion(c.peso_porcentual)} %` },
  {
    clave: "puntaje",
    titulo: "Puntaje",
    ancho: "30%",
    alinear: "fin",
    celda: (c) => (
      <span className="ev-barra-celda">
        <span className="ev-barra" aria-hidden="true">
          <span className="ev-barra__relleno" style={{ width: `${c.puntaje ?? 0}%` }} />
        </span>
        {puntajeOGuion(c.puntaje)}
      </span>
    ),
  },
];

function Resumen({ resumen }) {
  const datos = [
    { etiqueta: "Puntaje del último periodo", valor: puntajeOGuion(resumen.puntaje_actual), nota: describirVariacion(resumen.variacion) },
    { etiqueta: "Promedio histórico", valor: puntajeOGuion(resumen.promedio_historico), nota: "Sobre 100, de todos sus ciclos cerrados" },
    { etiqueta: "Ciclos evaluados", valor: resumen.cantidad_ciclos, nota: "Ciclos cerrados con resultado" },
  ];
  return (
    <dl className="ev-indicadores">
      {datos.map(({ etiqueta, valor, nota }) => (
        <div key={etiqueta} className="ev-indicador">
          <dt>{etiqueta}</dt>
          <dd className="ev-indicador__valor">{valor}</dd>
          <dd className="ev-sutil">{nota}</dd>
        </div>
      ))}
    </dl>
  );
}

function Evolucion({ evolucion }) {
  const [comoTabla, setComoTabla] = useState(false);
  return (
    <Tarjeta
      nivelTitulo={2}
      titulo="Evolución del puntaje por periodo"
      acciones={
        <Boton tamano="sm" icono={comoTabla ? LineChart : Table2} onClick={() => setComoTabla((v) => !v)} aria-pressed={comoTabla}>
          {comoTabla ? "Ver gráfico" : "Ver como tabla"}
        </Boton>
      }
    >
      {comoTabla ? (
        <Tabla descripcion="Puntaje consolidado por periodo" columnas={COLUMNAS_EVOLUCION} filas={evolucion} claveFila="id_periodo" />
      ) : (
        <figure className="ev-figura">
          <GraficoEvolucion evolucion={evolucion} />
          <figcaption className="ev-sutil">
            Puntaje consolidado (0 a 100) de cada periodo. Pase el cursor o enfoque un punto para ver el detalle.
          </figcaption>
        </figure>
      )}
    </Tarjeta>
  );
}

function RetroalimentacionEvaluador({ evaluacion }) {
  const { retroalimentacion: retro } = evaluacion;
  return (
    <article className="ev-retro-ciclo">
      <header className="ev-retro-ciclo__encabezado">
        <h4 className="ev-criterio__titulo">{evaluacion.evaluador.nombre_completo}</h4>
        <span className="ev-sutil">
          Puntaje {puntajeOGuion(evaluacion.puntaje_final)} · enviada {formatearFechaHora(evaluacion.enviada_en)}
        </span>
      </header>
      {tieneContenido(retro) ? (
        <>
          <dl className="ev-retro__textos">
            {CAMPOS_RETROALIMENTACION.filter(({ clave }) => retro[clave]).map(({ clave, etiqueta }) => (
              <div key={clave}>
                <dt>{etiqueta}</dt>
                <dd className="ev-retro__texto">{retro[clave]}</dd>
              </div>
            ))}
          </dl>
          {retro.compromisos.length > 0 && (
            <ul className="ev-compromisos__lista">
              {retro.compromisos.map((compromiso) => (
                <li key={compromiso.id_compromiso} className="ev-compromiso ev-compromiso--lectura">
                  <p className="ev-retro__texto">{compromiso.descripcion}</p>
                  <p className="ev-sutil">Fecha objetivo: {formatearFecha(compromiso.fecha_objetivo)}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="ev-sutil">El evaluador no registró comentarios cualitativos.</p>
      )}
      <div>
        <Boton as={Link} to={rutaMiResultado(evaluacion.id_evaluacion)} tamano="sm">
          Ver evaluación completa
        </Boton>
      </div>
    </article>
  );
}

function CicloConsolidado({ ciclo }) {
  return (
    <Tarjeta nivelTitulo={3} titulo={ciclo.nombre} acciones={<Etiqueta>{ciclo.periodo.nombre}</Etiqueta>} className="ev-ciclo-consolidado">
      <dl className="ev-datos">
        <div>
          <dt>Puntaje final</dt>
          <dd>
            <strong>{puntajeOGuion(ciclo.puntaje_final)}</strong> de 100
          </dd>
        </div>
        <div>
          <dt>Evaluaciones</dt>
          <dd>{ciclo.cantidad_evaluaciones === 1 ? "1 evaluador" : `Promedio de ${ciclo.cantidad_evaluaciones} evaluadores`}</dd>
        </div>
        <div>
          <dt>Ciclo cerrado</dt>
          <dd>{ciclo.cerrado_en ? formatearFechaHora(ciclo.cerrado_en) : "—"}</dd>
        </div>
      </dl>
      <Tabla
        descripcion={`Puntaje por competencia de ${ciclo.nombre}`}
        columnas={COLUMNAS_COMPETENCIA}
        filas={ciclo.competencias}
        claveFila="competencia"
      />
      <section className="ev-retro-ciclos" aria-label={`Retroalimentación de ${ciclo.nombre}`}>
        <h4 className="ev-criterio__titulo">Retroalimentación</h4>
        {ciclo.evaluaciones.map((evaluacion) => (
          <RetroalimentacionEvaluador key={evaluacion.id_evaluacion} evaluacion={evaluacion} />
        ))}
      </section>
    </Tarjeta>
  );
}

export default function HistorialDesempeno({ historial }) {
  if (historial.ciclos.length === 0) {
    return (
      <Tarjeta nivelTitulo={2} titulo="Historial de desempeño">
        <EstadoVacio
          icono={LineChart}
          titulo="Aún no tiene ciclos cerrados"
          mensaje="Cuando cierre un ciclo de evaluación con resultados suyos, verá aquí su puntaje consolidado y su evolución."
        />
      </Tarjeta>
    );
  }
  return (
    <>
      <Resumen resumen={historial.resumen} />
      <Evolucion evolucion={historial.evolucion} />
      <section className="ev-ciclos-consolidados" aria-labelledby="ev-consolidado-titulo">
        <h2 id="ev-consolidado-titulo" className="ev-seccion-titulo">
          Resultados consolidados por ciclo
        </h2>
        {historial.ciclos.map((ciclo) => (
          <CicloConsolidado key={ciclo.id_ciclo} ciclo={ciclo} />
        ))}
      </section>
    </>
  );
}

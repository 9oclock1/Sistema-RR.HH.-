import { useCallback, useState } from "react";
import { Link } from "react-router";
import { ChartColumn, RefreshCw } from "lucide-react";
import { obtenerDashboardDesempeno } from "../../api/dashboardDesempeno";
import { obtenerRotacionTemprana } from "../../api/rotacionTemprana";
import { Alerta, Boton, EncabezadoPagina, EstadoVacio, Esqueleto, Selector, Tarjeta } from "../../components/ui";
import { useRol } from "../../context/sesion";
import { formatearDia, formatearMomento } from "../ciclos-evaluacion/ciclo";
import useRecurso from "../quejas/casos/useRecurso";
import ComparativoCiclos from "./ComparativoCiclos";
import HistogramaCalificaciones from "./HistogramaCalificaciones";
import RankingBarras from "./RankingBarras";
import TarjetasKpi from "./TarjetasKpi";
import { FILTROS_VACIOS, hayFiltrosActivos } from "./dashboardDesempeno";
import "./dashboardDesempeno.css";

const etiquetaCiclo = (ciclo) => `${ciclo.nombre} · ${ciclo.periodo}`;

const opcionesDe = (lista) => lista.map((elemento) => ({ valor: elemento.id, etiqueta: elemento.nombre }));

function Cargando() {
  return (
    <div className="dd-apilado" aria-busy="true" aria-label="Cargando el dashboard">
      <Esqueleto forma="bloque" alto="4rem" />
      <Esqueleto forma="bloque" alto="9rem" />
      <Esqueleto forma="bloque" alto="16rem" />
    </div>
  );
}

export default function DashboardDesempenoPage() {
  const rol = useRol();
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const cargar = useCallback(() => obtenerDashboardDesempeno(rol, filtros), [rol, filtros]);
  const { datos, error, cargando, reintentar } = useRecurso(cargar);

  // KPI-12: el periodo es el del ciclo elegido; área y sucursal, las mismas del resto del dashboard.
  const desde = datos?.ciclo?.periodo?.desde;
  const hasta = datos?.ciclo?.periodo?.hasta;
  const { departamento, sucursal } = filtros;
  const cargarRotacion = useCallback(
    () => (desde && hasta ? obtenerRotacionTemprana(rol, { desde, hasta, departamento, sucursal }) : Promise.resolve(null)),
    [rol, desde, hasta, departamento, sucursal],
  );
  const rotacion = useRecurso(cargarRotacion);

  const actualizar = () => {
    reintentar();
    rotacion.reintentar();
  };

  const cambiarFiltro = (evento) => setFiltros((actuales) => ({ ...actuales, [evento.target.name]: evento.target.value }));

  const ciclosElegibles = datos ? [...datos.comparativo_ciclos].reverse() : [];

  return (
    <section className="dd-pagina" aria-labelledby="dd-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Dashboards" }]}
        enlace={Link}
        titulo="Dashboard de desempeño"
        idTitulo="dd-titulo"
        descripcion="Indicadores consolidados del desempeño laboral y la rotación temprana por ciclo, área y sucursal: puntaje promedio, cumplimiento de evaluaciones, alto desempeño, rotación temprana, distribución de calificaciones y comparativo entre ciclos."
        acciones={
          <Boton icono={RefreshCw} onClick={actualizar} cargando={cargando && Boolean(datos)}>
            Actualizar
          </Boton>
        }
      />

      {error && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudo cargar el dashboard"
          acciones={
            <Boton tamano="sm" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          {error.message}
        </Alerta>
      )}

      {!datos && !error && <Cargando />}

      {datos && !datos.ciclo && (
        <Tarjeta>
          <EstadoVacio
            icono={ChartColumn}
            titulo="Aún no hay ciclos cerrados"
            mensaje="El dashboard se calcula con los ciclos de evaluación que ya terminaron su plazo."
          />
        </Tarjeta>
      )}

      {datos?.ciclo && (
        <div className="dd-apilado" aria-busy={cargando}>
          <Tarjeta nivelTitulo={2} titulo="Filtros">
            <div className="dd-filtros">
              <Selector
                name="ciclo"
                etiqueta="Ciclo cerrado"
                value={filtros.ciclo || datos.ciclo.id_ciclo}
                onChange={cambiarFiltro}
                opciones={ciclosElegibles.map((ciclo) => ({ valor: ciclo.id_ciclo, etiqueta: etiquetaCiclo(ciclo) }))}
              />
              <Selector
                name="departamento"
                etiqueta="Área"
                value={filtros.departamento}
                onChange={cambiarFiltro}
                textoVacio="Todas las áreas"
                opciones={opcionesDe(datos.opciones.departamentos)}
              />
              <Selector
                name="sucursal"
                etiqueta="Sucursal"
                value={filtros.sucursal}
                onChange={cambiarFiltro}
                textoVacio="Todas las sucursales"
                opciones={opcionesDe(datos.opciones.sucursales)}
              />
              {hayFiltrosActivos(filtros) && (
                <Boton onClick={() => setFiltros(FILTROS_VACIOS)}>Limpiar filtros</Boton>
              )}
            </div>
            <p className="dd-sutil">
              {datos.ciclo.nombre} · cerrado el {formatearMomento(datos.ciclo.cerrado_en)}
              {desde && hasta && ` · La rotación temprana se calcula con el periodo ${datos.ciclo.periodo.nombre} (${formatearDia(desde)} al ${formatearDia(hasta)})`}
            </p>
          </Tarjeta>

          <div className={cargando ? "dd-apilado dd-actualizando" : "dd-apilado"}>
            <TarjetasKpi
              puntaje={datos.kpis.puntaje_promedio}
              cumplimiento={datos.kpis.cumplimiento_evaluaciones}
              altoDesempeno={datos.kpis.alto_desempeno}
              rotacion={rotacion}
            />

            <div className="dd-rejilla">
              <Tarjeta nivelTitulo={2} titulo="Distribución de calificaciones">
                <HistogramaCalificaciones histograma={datos.histograma} meta={datos.kpis.puntaje_promedio.meta} />
              </Tarjeta>
              <Tarjeta nivelTitulo={2} titulo="Ranking de áreas">
                <RankingBarras
                  items={datos.ranking_areas}
                  meta={datos.kpis.puntaje_promedio.meta}
                  etiqueta="Áreas ordenadas por puntaje promedio"
                  mensajeVacio="No hay áreas con evaluaciones en este ciclo."
                />
              </Tarjeta>
            </div>

            <Tarjeta nivelTitulo={2} titulo="Ranking de sucursales">
              <RankingBarras
                items={datos.ranking_sucursales}
                meta={datos.kpis.puntaje_promedio.meta}
                etiqueta="Sucursales ordenadas por puntaje promedio"
                mensajeVacio="No hay sucursales con evaluaciones en este ciclo."
              />
            </Tarjeta>

            <Tarjeta nivelTitulo={2} titulo="Comparativo entre ciclos">
              <ComparativoCiclos ciclos={datos.comparativo_ciclos} />
            </Tarjeta>
          </div>
        </div>
      )}
    </section>
  );
}

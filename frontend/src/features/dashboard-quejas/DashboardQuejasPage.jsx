import { useCallback, useState } from "react";
import { Link } from "react-router";
import { FileDown, FilterX, MessageSquareWarning, RefreshCw } from "lucide-react";
import { exportarDashboardQuejas, obtenerDashboardQuejas } from "../../api/dashboardQuejas";
import {
  Alerta,
  Boton,
  CampoTexto,
  EncabezadoPagina,
  EstadoVacio,
  Esqueleto,
  Pestanas,
  Selector,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import { useRol } from "../../context/sesion";
import { descargarArchivo } from "../quejas/historial/historial";
import useRecurso from "../quejas/casos/useRecurso";
import DistribucionQuejas from "./DistribucionQuejas";
import TarjetasKpiQuejas from "./TarjetasKpiQuejas";
import TendenciaMensual from "./TendenciaMensual";
import {
  FILTROS_VACIOS,
  MENSAJE_SIN_PERMISO,
  SIN_SUCURSAL,
  hayFiltrosActivos,
  nombreArchivoPdf,
  pluralQuejas,
  validarRango,
} from "./dashboardQuejas";
import "../dashboard-desempeno/dashboardDesempeno.css";
import "./dashboardQuejas.css";

const sinPermiso = (error) => error?.estado === 401 || error?.estado === 403;

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

function ResumenQuejas({ resumen }) {
  const datos = [
    { etiqueta: "Recibidas", valor: resumen.quejas_recibidas },
    { etiqueta: "Resueltas", valor: resumen.quejas_resueltas },
    { etiqueta: "Anónimas", valor: resumen.quejas_anonimas },
    { etiqueta: "Identificadas", valor: resumen.quejas_identificadas },
  ];
  return (
    <div className="dd-apilado">
      <dl className="dq-resumen">
        {datos.map(({ etiqueta, valor }) => (
          <div key={etiqueta} className="dq-resumen__dato">
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      <p className="dd-sutil">Las quejas anónimas se cuentan en todos los indicadores sin identificar a quien las presentó.</p>
    </div>
  );
}

export default function DashboardQuejasPage() {
  const rol = useRol();
  const avisar = useAvisos();
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState(FILTROS_VACIOS);
  const [pestana, setPestana] = useState("categoria");
  const [exportando, setExportando] = useState(false);
  const [errorExportacion, setErrorExportacion] = useState(null);

  const cargar = useCallback(() => obtenerDashboardQuejas(rol, aplicados), [rol, aplicados]);
  const { datos, error, cargando, reintentar } = useRecurso(cargar);
  const errores = validarRango(filtros);

  const cambiarFiltro = (campo) => (evento) => {
    const nuevos = { ...filtros, [campo]: evento.target.value };
    setFiltros(nuevos);
    setErrorExportacion(null);
    if (!validarRango(nuevos).hasta) setAplicados(nuevos);
  };

  const limpiarFiltros = () => {
    setFiltros(FILTROS_VACIOS);
    setAplicados(FILTROS_VACIOS);
    setErrorExportacion(null);
  };

  const exportar = async () => {
    setErrorExportacion(null);
    setExportando(true);
    try {
      const archivo = await exportarDashboardQuejas(rol, aplicados);
      descargarArchivo(archivo, nombreArchivoPdf(datos.periodo));
      avisar({ tono: "exito", titulo: "Dashboard exportado", mensaje: "El PDF incluye los indicadores del periodo filtrado." });
    } catch (fallo) {
      setErrorExportacion(sinPermiso(fallo) ? MENSAJE_SIN_PERMISO : "No se pudo generar el PDF. Intente nuevamente.");
    } finally {
      setExportando(false);
    }
  };

  const puedeExportar = Boolean(datos) && !errores.hasta && !cargando;

  return (
    <section className="dd-pagina" aria-labelledby="dq-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Dashboards" }]}
        enlace={Link}
        titulo="Dashboard de quejas internas"
        idTitulo="dq-titulo"
        descripcion="Tasa de resolución y tiempo promedio de atención de las quejas, con su tendencia mensual y las categorías, áreas y sucursales con más incidencia."
        acciones={
          <>
            <Boton icono={RefreshCw} onClick={reintentar} cargando={cargando && Boolean(datos)}>
              Actualizar
            </Boton>
            <Boton icono={FileDown} variante="primario" onClick={exportar} cargando={exportando} disabled={!puedeExportar}>
              Exportar PDF
            </Boton>
          </>
        }
      />

      {errorExportacion && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo exportar el dashboard" onCerrar={() => setErrorExportacion(null)}>
          {errorExportacion}
        </Alerta>
      )}

      {error && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudo cargar el dashboard"
          acciones={
            sinPermiso(error) ? undefined : (
              <Boton tamano="sm" onClick={reintentar}>
                Reintentar
              </Boton>
            )
          }
        >
          {sinPermiso(error) ? MENSAJE_SIN_PERMISO : error.message}
        </Alerta>
      )}

      {!datos && !error && <Cargando />}

      {datos && (
        <div className="dd-apilado" aria-busy={cargando}>
          <Tarjeta nivelTitulo={2} titulo="Filtros">
            <div className="dd-filtros dq-filtros">
              <CampoTexto
                type="date"
                name="desde"
                etiqueta="Desde"
                value={filtros.desde || datos.periodo.desde}
                max={filtros.hasta || datos.periodo.hasta}
                onChange={cambiarFiltro("desde")}
              />
              <CampoTexto
                type="date"
                name="hasta"
                etiqueta="Hasta"
                value={filtros.hasta || datos.periodo.hasta}
                min={filtros.desde || datos.periodo.desde}
                onChange={cambiarFiltro("hasta")}
                error={errores.hasta}
              />
              <Selector
                name="categoria"
                etiqueta="Categoría"
                value={filtros.categoria}
                onChange={cambiarFiltro("categoria")}
                textoVacio="Todas las categorías"
                opciones={datos.opciones.categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
              />
              <Selector
                name="sucursal"
                etiqueta="Sucursal"
                value={filtros.sucursal}
                onChange={cambiarFiltro("sucursal")}
                textoVacio="Todas las sucursales"
                opciones={[{ valor: SIN_SUCURSAL, etiqueta: "Sin sucursal" }, ...opcionesDe(datos.opciones.sucursales)]}
              />
              {hayFiltrosActivos(filtros) && (
                <Boton icono={FilterX} onClick={limpiarFiltros}>
                  Limpiar filtros
                </Boton>
              )}
            </div>
            <p className="dd-sutil">
              Se muestran {pluralQuejas(datos.resumen.quejas_recibidas)} recibidas en el periodo. Por defecto, los últimos 6 meses.
            </p>
          </Tarjeta>

          <div className={cargando ? "dd-apilado dd-actualizando" : "dd-apilado"}>
            <TarjetasKpiQuejas tasa={datos.kpis.tasa_resolucion} tiempo={datos.kpis.tiempo_promedio} />
            <ResumenQuejas resumen={datos.resumen} />

            <Tarjeta nivelTitulo={2} titulo="Tendencia mensual">
              <TendenciaMensual meses={datos.tendencia_mensual} />
            </Tarjeta>

            <Tarjeta nivelTitulo={2} titulo="Incidencia de quejas">
              <Pestanas
                etiqueta="Quejas por categoría, área y sucursal"
                activa={pestana}
                onCambiar={setPestana}
                pestanas={[
                  {
                    id: "categoria",
                    etiqueta: "Categorías",
                    contenido: <DistribucionQuejas grupos={datos.por_categoria} etiqueta="Quejas por categoría" />,
                  },
                  {
                    id: "area",
                    etiqueta: "Áreas",
                    contenido: <DistribucionQuejas grupos={datos.por_area} etiqueta="Quejas por área" />,
                  },
                  {
                    id: "sucursal",
                    etiqueta: "Sucursales",
                    contenido: <DistribucionQuejas grupos={datos.por_sucursal} etiqueta="Quejas por sucursal" />,
                  },
                ]}
              />
            </Tarjeta>
          </div>
        </div>
      )}

      {!datos && error && sinPermiso(error) && (
        <EstadoVacio icono={MessageSquareWarning} titulo="Acceso restringido" mensaje={MENSAJE_SIN_PERMISO} />
      )}
    </section>
  );
}

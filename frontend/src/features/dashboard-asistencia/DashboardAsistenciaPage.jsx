import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeftRight, CalendarX2, Gauge } from "lucide-react";
import { obtenerDashboardAsistencia } from "../../api/dashboardAsistencia";
import { obtenerAlcanceReportes } from "../../api/reportesAsistencia";
import {
  Alerta,
  Boton,
  CampoTexto,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Selector,
  Tarjeta,
} from "../../components/ui";
import { useRol } from "../../context/sesion";
import { puedeAcceder } from "../../utils/permisos";
import IdentificacionEmpleado from "../marcaje/IdentificacionEmpleado";
import { guardarEmpleado, leerEmpleado, olvidarEmpleado } from "../marcaje/sesionEmpleado";
import ComparativoSucursales from "./ComparativoSucursales";
import HeatmapDiario from "./HeatmapDiario";
import TarjetaKpi from "./TarjetaKpi";
import { fechaCorta, filtrosIniciales } from "./formato";
import "../reportes-asistencia/reportesAsistencia.css";
import "./dashboardAsistencia.css";

const esRechazoDeIdentidad = (error) => error.estado === 401 || error.estado === 403;

// RF-73 (KAN-93): dashboard de ausentismo y puntualidad por sucursal, con KPI-04/KPI-05, su semáforo,
// comparativo entre sucursales y, con una sucursal en el alcance, el detalle diario de faltas y atrasos.
export default function DashboardAsistenciaPage() {
  const rol = useRol();
  const esRrhh = puedeAcceder(rol, ["gerente"]);
  const [idSupervisor, setIdSupervisor] = useState(leerEmpleado);
  const [errorIdentificacion, setErrorIdentificacion] = useState(null);
  const identidad = esRrhh ? { idEmpleado: null, rol } : { idEmpleado: idSupervisor, rol };
  const claveAlcance = esRrhh ? `rrhh:${rol}` : idSupervisor ? `supervisor:${idSupervisor}` : null;

  const [alcance, setAlcance] = useState({ clave: null, datos: null, error: null });
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [consulta, setConsulta] = useState({ clave: null, datos: null, error: null });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!claveAlcance) return undefined;
    let vigente = true;
    obtenerAlcanceReportes(esRrhh ? { idEmpleado: null, rol } : { idEmpleado: idSupervisor, rol })
      .then((datos) => {
        if (!vigente) return;
        if (!esRrhh) guardarEmpleado(idSupervisor);
        setAlcance({ clave: claveAlcance, datos, error: null });
      })
      .catch((error) => {
        if (!vigente) return;
        if (!esRrhh && esRechazoDeIdentidad(error)) {
          olvidarEmpleado();
          setIdSupervisor(null);
          setErrorIdentificacion(error.message);
          return;
        }
        setAlcance({ clave: claveAlcance, datos: null, error: error.message });
      });
    return () => {
      vigente = false;
    };
  }, [claveAlcance, esRrhh, idSupervisor, rol]);

  const cargandoAlcance = Boolean(claveAlcance) && alcance.clave !== claveAlcance;
  const datosAlcance = alcance.clave === claveAlcance ? alcance.datos : null;
  const errorAlcance = alcance.clave === claveAlcance ? alcance.error : null;
  // El supervisor no elige la sucursal: queda fijada en la suya (criterio 2).
  const sucursalElegida = datosAlcance?.sucursal_fija ?? filtros.id_sucursal;

  // Clave de la consulta vigente: solo cambia cuando hay algo nuevo que pedir (alcance listo y sin error).
  // El dashboard y el estado de carga se derivan comparándola con la de la última respuesta (mismo patrón que
  // el reporte contable), así el efecto nunca necesita un setState síncrono solo para marcar "cargando".
  const claveConsulta =
    claveAlcance && !cargandoAlcance && !errorAlcance
      ? [claveAlcance, sucursalElegida, filtros.id_departamento, filtros.desde, filtros.hasta, intento].join("|")
      : null;

  useEffect(() => {
    if (!claveConsulta) return undefined;
    let vigente = true;
    obtenerDashboardAsistencia({ ...filtros, id_sucursal: sucursalElegida }, identidad)
      .then((datos) => vigente && setConsulta({ clave: claveConsulta, datos, error: null }))
      .catch((e) => vigente && setConsulta({ clave: claveConsulta, datos: null, error: e }));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveConsulta]);

  const dashboard = consulta.clave === claveConsulta ? consulta.datos : null;
  const error = consulta.clave === claveConsulta ? consulta.error : null;
  const cargando = Boolean(claveConsulta) && consulta.clave !== claveConsulta;

  const cambiar = (campo) => (evento) => setFiltros((actual) => ({ ...actual, [campo]: evento.target.value }));

  const identificar = (id) => {
    setErrorIdentificacion(null);
    setIdSupervisor(id.trim().toLowerCase());
  };

  const cambiarSupervisor = () => {
    olvidarEmpleado();
    setIdSupervisor(null);
  };

  const opcionesSucursal = (datosAlcance?.sucursales ?? []).map((s) => ({ valor: s.id_sucursal, etiqueta: s.nombre }));
  const opcionesArea = (datosAlcance?.areas ?? []).map((a) => ({ valor: a.id_departamento, etiqueta: a.nombre }));

  return (
    <section className="rep" aria-labelledby="dashboard-asistencia-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Dashboards" }]}
        enlace={Link}
        titulo="Dashboard de ausentismo y puntualidad"
        idTitulo="dashboard-asistencia-titulo"
        descripcion="KPI-04 (ausentismo) y KPI-05 (puntualidad) por sucursal, con semáforo según su meta."
        acciones={
          !esRrhh &&
          idSupervisor && (
            <Boton variante="sutil" icono={ArrowLeftRight} onClick={cambiarSupervisor}>
              Cambiar supervisor
            </Boton>
          )
        }
      />

      <div className="rep-columna">
        {!esRrhh && !idSupervisor && (
          <IdentificacionEmpleado
            error={errorIdentificacion}
            procesando={false}
            enfocar={false}
            onIdentificar={identificar}
            onEditar={() => setErrorIdentificacion(null)}
          />
        )}

        {errorAlcance && (
          <Alerta tono="peligro" role="alert" titulo="No se pudieron cargar los filtros">
            {errorAlcance}
          </Alerta>
        )}

        {datosAlcance?.tipo === "SUPERVISOR" && (
          <Alerta tono="info" titulo={`Personal a cargo de ${datosAlcance.supervisor.nombre_completo}`}>
            Solo ve los indicadores de {datosAlcance.sucursales[0].nombre} (
            {datosAlcance.personal_a_cargo} {datosAlcance.personal_a_cargo === 1 ? "persona" : "personas"}).
          </Alerta>
        )}

        {claveAlcance && !errorAlcance && (
          <Tarjeta titulo="Filtros del dashboard" nivelTitulo={2} className="rep-tarjeta">
            {cargandoAlcance ? (
              <div className="rep-filtros" aria-busy="true">
                <Esqueleto forma="bloque" />
                <Esqueleto forma="bloque" />
              </div>
            ) : (
              <div className="rep-filtros">
                <Selector
                  etiqueta="Sucursal"
                  value={sucursalElegida}
                  onChange={cambiar("id_sucursal")}
                  opciones={opcionesSucursal}
                  textoVacio={datosAlcance?.sucursal_fija ? undefined : "Todas las sucursales"}
                  disabled={Boolean(datosAlcance?.sucursal_fija)}
                />
                <Selector
                  etiqueta="Área"
                  value={filtros.id_departamento}
                  onChange={cambiar("id_departamento")}
                  opciones={opcionesArea}
                  textoVacio="Todas las áreas"
                />
                <CampoTexto
                  type="date"
                  etiqueta="Desde"
                  value={filtros.desde}
                  max={filtros.hasta || undefined}
                  onChange={cambiar("desde")}
                />
                <CampoTexto
                  type="date"
                  etiqueta="Hasta"
                  value={filtros.hasta}
                  min={filtros.desde || undefined}
                  onChange={cambiar("hasta")}
                />
              </div>
            )}
          </Tarjeta>
        )}

        {error && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo generar el dashboard" acciones={<Boton onClick={() => setIntento((n) => n + 1)}>Reintentar</Boton>}>
            {error.message}
          </Alerta>
        )}

        {cargando && !dashboard && !error && (
          <div className="da-kpis" aria-busy="true" aria-label="Cargando indicadores">
            <Esqueleto forma="bloque" alto="140px" />
            <Esqueleto forma="bloque" alto="140px" />
          </div>
        )}

        {dashboard && (
          <>
            {dashboard.filtros.hasta_efectiva < dashboard.filtros.hasta && (
              <Alerta tono="info" titulo="Solo jornadas cerradas">
                El dashboard incluye hasta el {fechaCorta(dashboard.filtros.hasta_efectiva)}: los días que aún no
                terminan se consolidan después.
              </Alerta>
            )}

            <section className="da-kpis" aria-label="Indicadores" aria-busy={cargando || undefined}>
              <TarjetaKpi
                titulo="KPI-04 · Tasa de ausentismo"
                kpi={dashboard.kpis.ausentismo}
                metaTexto="Meta: ≤ 3 % · Horas no laboradas por faltas sobre horas programadas"
              />
              <TarjetaKpi
                titulo="KPI-05 · Índice de puntualidad"
                kpi={dashboard.kpis.puntualidad}
                metaTexto="Meta: ≥ 95 % · Marcajes de entrada dentro de la tolerancia"
                detalle={
                  dashboard.kpis.minutos_atraso.total > 0
                    ? `${dashboard.kpis.minutos_atraso.total} min de atraso acumulados (${dashboard.kpis.minutos_atraso.promedio_por_atraso} min en promedio)`
                    : "Sin atrasos en el periodo"
                }
              />
            </section>

            <Tarjeta titulo="Comparativo entre sucursales" nivelTitulo={2} className="rep-tarjeta">
              {dashboard.comparativo_sucursales.length === 0 ? (
                <EstadoVacio icono={Gauge} titulo="Sin personal" mensaje="No hay personal en la sucursal y el área elegidas." />
              ) : (
                <ComparativoSucursales sucursales={dashboard.comparativo_sucursales} />
              )}
            </Tarjeta>

            {dashboard.detalle_diario !== null && (
              <Tarjeta
                titulo={`Detalle diario · ${sucursalElegida ? opcionesSucursal.find((s) => s.valor === sucursalElegida)?.etiqueta ?? datosAlcance?.sucursales?.[0]?.nombre : "Su sucursal"}`}
                nivelTitulo={2}
                className="rep-tarjeta"
              >
                {dashboard.detalle_diario.length === 0 ? (
                  <EstadoVacio icono={CalendarX2} titulo="Sin novedades" mensaje="No hubo faltas ni atrasos en el periodo elegido." />
                ) : (
                  <HeatmapDiario dias={dashboard.detalle_diario} />
                )}
              </Tarjeta>
            )}
          </>
        )}
      </div>
    </section>
  );
}

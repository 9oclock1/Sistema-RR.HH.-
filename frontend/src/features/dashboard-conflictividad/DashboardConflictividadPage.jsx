import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeftRight, MessageSquareWarning, RefreshCw } from "lucide-react";
import { getSucursales } from "../../api/sucursalesApi";
import departamentosApi from "../../api/departamentosApi";
import { obtenerDashboardConflictividad } from "../../api/dashboardConflictividad";
import { Alerta, Boton, CampoTexto, EncabezadoPagina, EstadoVacio, Esqueleto, Selector, Tarjeta } from "../../components/ui";
import { useRol } from "../../context/sesion";
import { puedeAcceder } from "../../utils/permisos";
import IdentificacionEmpleado from "../marcaje/IdentificacionEmpleado";
import { guardarEmpleado, leerEmpleado, olvidarEmpleado } from "../marcaje/sesionEmpleado";
import ComparativoAreaSucursal from "./ComparativoAreaSucursal";
import TarjetasKpiConflictividad from "./TarjetasKpiConflictividad";
import { MENSAJE_SIN_PERMISO, filtrosIniciales, validarRango } from "./dashboardConflictividad";
import "../dashboard-desempeno/dashboardDesempeno.css";
import "./dashboardConflictividad.css";

const sinPermiso = (error) => error?.estado === 401 || error?.estado === 403;

function Cargando() {
  return (
    <div className="dd-apilado" aria-busy="true" aria-label="Cargando el dashboard">
      <Esqueleto forma="bloque" alto="4rem" />
      <Esqueleto forma="bloque" alto="9rem" />
      <Esqueleto forma="bloque" alto="16rem" />
    </div>
  );
}

// RF-72/RF-73 (KAN-506): índice de quejas (KPI-03) y minutos de atraso promedio (KPI-06) por área y
// sucursal, con semáforo según su meta. El Administrador de RRHH ve toda la empresa; el Supervisor, solo la
// suya (la restricción la aplica Asistencia al resolver el reporte de atrasos que este dashboard reutiliza).
export default function DashboardConflictividadPage() {
  const rol = useRol();
  const esRrhh = puedeAcceder(rol, ["gerente"]);
  const [idSupervisor, setIdSupervisor] = useState(leerEmpleado);
  const [errorIdentificacion, setErrorIdentificacion] = useState(null);
  const identidad = esRrhh ? { idEmpleado: null, rol } : { idEmpleado: idSupervisor, rol };
  const claveIdentidad = esRrhh ? `rrhh:${rol}` : idSupervisor ? `supervisor:${idSupervisor}` : null;

  const [sucursales, setSucursales] = useState([]);
  const [areas, setAreas] = useState([]);
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [consulta, setConsulta] = useState({ clave: null, datos: null, error: null });
  const [intento, setIntento] = useState(0);
  const errores = validarRango(filtros);

  useEffect(() => {
    getSucursales()
      .then((lista) => setSucursales(Array.isArray(lista) ? lista : []))
      .catch(() => setSucursales([]));
    departamentosApi
      .listarActivas()
      .then((lista) => setAreas(Array.isArray(lista) ? lista : []))
      .catch(() => setAreas([]));
  }, []);

  // El supervisor no elige la sucursal: Asistencia ya la fija a la suya (criterio 3); una vez que la primera
  // respuesta la revela, el selector queda bloqueado en ese valor.
  const sucursalFija = consulta.datos?.alcance?.tipo === "SUPERVISOR" ? consulta.datos.filtros.sucursal?.id_sucursal : null;
  const sucursalElegida = sucursalFija ?? filtros.id_sucursal;

  const claveConsulta =
    claveIdentidad && !errores.hasta
      ? [claveIdentidad, sucursalElegida, filtros.id_departamento, filtros.desde, filtros.hasta, intento].join("|")
      : null;

  useEffect(() => {
    if (!claveConsulta) return undefined;
    let vigente = true;
    obtenerDashboardConflictividad({ ...filtros, id_sucursal: sucursalElegida }, identidad)
      .then((datos) => {
        if (!vigente) return;
        if (!esRrhh) guardarEmpleado(idSupervisor);
        setConsulta({ clave: claveConsulta, datos, error: null });
      })
      .catch((error) => {
        if (!vigente) return;
        if (!esRrhh && (error.estado === 401 || (sucursalElegida === "" && error.estado === 403))) {
          olvidarEmpleado();
          setIdSupervisor(null);
          setErrorIdentificacion(error.message);
          return;
        }
        setConsulta({ clave: claveConsulta, datos: null, error });
      });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveConsulta]);

  const dashboard = consulta.clave === claveConsulta ? consulta.datos : null;
  const error = consulta.clave === claveConsulta ? consulta.error : null;
  const cargando = Boolean(claveConsulta) && consulta.clave !== claveConsulta;

  const cambiarFiltro = (campo) => (evento) => setFiltros((actual) => ({ ...actual, [campo]: evento.target.value }));

  const identificar = (id) => {
    setErrorIdentificacion(null);
    setIdSupervisor(id.trim().toLowerCase());
  };

  const cambiarSupervisor = () => {
    olvidarEmpleado();
    setIdSupervisor(null);
  };

  const opcionesSucursal = sucursales.map((s) => ({ valor: s.id_sucursal, etiqueta: s.nombre }));
  const opcionesArea = areas.map((a) => ({ valor: a.id_departamento, etiqueta: a.nombre }));

  return (
    <section className="dd-pagina" aria-labelledby="dc-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Dashboards" }]}
        enlace={Link}
        titulo="Conflictividad y puntualidad"
        idTitulo="dc-titulo"
        descripcion="Índice de quejas por cada 100 empleados y minutos de atraso promedio, para comparar áreas y sucursales."
        acciones={
          <>
            {!esRrhh && idSupervisor && (
              <Boton variante="sutil" icono={ArrowLeftRight} onClick={cambiarSupervisor}>
                Cambiar supervisor
              </Boton>
            )}
            <Boton icono={RefreshCw} onClick={() => setIntento((n) => n + 1)} cargando={cargando && Boolean(dashboard)}>
              Actualizar
            </Boton>
          </>
        }
      />

      {!esRrhh && !idSupervisor && (
        <IdentificacionEmpleado
          error={errorIdentificacion}
          procesando={false}
          enfocar={false}
          onIdentificar={identificar}
          onEditar={() => setErrorIdentificacion(null)}
        />
      )}

      {error && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudo cargar el dashboard"
          acciones={sinPermiso(error) ? undefined : <Boton tamano="sm" onClick={() => setIntento((n) => n + 1)}>Reintentar</Boton>}
        >
          {sinPermiso(error) ? MENSAJE_SIN_PERMISO : error.message}
        </Alerta>
      )}

      {claveIdentidad && !dashboard && !error && <Cargando />}

      {dashboard && (
        <div className="dd-apilado" aria-busy={cargando}>
          <Tarjeta nivelTitulo={2} titulo="Filtros">
            <div className="dd-filtros dq-filtros">
              <CampoTexto type="date" etiqueta="Desde" value={filtros.desde} max={filtros.hasta} onChange={cambiarFiltro("desde")} />
              <CampoTexto
                type="date"
                etiqueta="Hasta"
                value={filtros.hasta}
                min={filtros.desde}
                onChange={cambiarFiltro("hasta")}
                error={errores.hasta}
              />
              <Selector
                etiqueta="Sucursal"
                value={sucursalElegida}
                onChange={cambiarFiltro("id_sucursal")}
                opciones={opcionesSucursal}
                textoVacio={sucursalFija ? undefined : "Todas las sucursales"}
                disabled={Boolean(sucursalFija)}
                ayuda={sucursalFija ? "Como supervisor, ve solo su sucursal." : undefined}
              />
              <Selector
                etiqueta="Área"
                value={filtros.id_departamento}
                onChange={cambiarFiltro("id_departamento")}
                opciones={opcionesArea}
                textoVacio="Todas las áreas"
              />
            </div>
          </Tarjeta>

          <div className={cargando ? "dd-apilado dd-actualizando" : "dd-apilado"}>
            <TarjetasKpiConflictividad indiceQuejas={dashboard.kpis.indice_quejas} minutosAtraso={dashboard.kpis.minutos_atraso} />

            <Tarjeta nivelTitulo={2} titulo="Comparativo por área y sucursal">
              {dashboard.comparativo.length === 0 ? (
                <EstadoVacio
                  icono={MessageSquareWarning}
                  titulo="Sin personal"
                  mensaje="No hay personal en la sucursal y el área elegidas."
                />
              ) : (
                <ComparativoAreaSucursal grupos={dashboard.comparativo} />
              )}
            </Tarjeta>
          </div>
        </div>
      )}

      {!dashboard && error && sinPermiso(error) && (
        <EstadoVacio icono={MessageSquareWarning} titulo="Acceso restringido" mensaje={MENSAJE_SIN_PERMISO} />
      )}
    </section>
  );
}

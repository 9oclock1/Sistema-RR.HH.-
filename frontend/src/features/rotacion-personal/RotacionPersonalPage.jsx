import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Info, LogIn, UsersRound } from "lucide-react";
import { obtenerTableroRotacion } from "../../api/rotacion";
import { getSucursales } from "../../api/sucursalesApi";
import departamentosApi from "../../api/departamentosApi";
import { Alerta, Boton, EncabezadoPagina, Esqueleto, EstadoVacio, Selector, Tarjeta } from "../../components/ui";
import { abrirInicioSesion, fijarSesion, useSesion } from "../../context/sesion";
import GraficoMotivos from "./GraficoMotivos";
import GraficoTendencia from "./GraficoTendencia";
import TarjetaKpi from "./TarjetaKpi";
import { hoyLaPaz, nombrePeriodo, opcionesPeriodo } from "./formato";
import "./rotacion.css";

// 401: la sesión venció o se cerró en otra pestaña; la página vuelve a pedir inicio de sesión.
const sinSesion = (error) => {
  if (error?.estado !== 401) return false;
  fijarSesion(null);
  return true;
};

function TableroRotacion() {
  const hoy = hoyLaPaz();
  const mesActual = hoy.slice(0, 7);
  const periodos = useMemo(() => opcionesPeriodo(hoy), [hoy]);

  const [filtros, setFiltros] = useState({ periodo: mesActual, id_sucursal: "", id_departamento: "" });
  const [sucursales, setSucursales] = useState([]);
  const [areas, setAreas] = useState([]);
  const [tablero, setTablero] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(0);
  const ultimaConsulta = useRef(0);

  useEffect(() => {
    getSucursales()
      .then((lista) => setSucursales(Array.isArray(lista) ? lista : []))
      .catch(() => setSucursales([]));
    departamentosApi
      .listarActivas()
      .then((lista) => setAreas(Array.isArray(lista) ? lista : []))
      .catch(() => setAreas([]));
  }, []);

  useEffect(() => {
    const consulta = ++ultimaConsulta.current;
    // Solo cuenta la respuesta de la última consulta: un filtro cambiado rápido no pisa al siguiente.
    obtenerTableroRotacion(filtros)
      .then((datos) => {
        if (consulta !== ultimaConsulta.current) return;
        setTablero(datos);
        setError(null);
      })
      .catch((e) => {
        if (consulta !== ultimaConsulta.current || sinSesion(e)) return;
        setTablero(null);
        setError(e);
      })
      .finally(() => {
        if (consulta === ultimaConsulta.current) setCargando(false);
      });
  }, [filtros, intento]);

  const cambiar = (campo) => (evento) => {
    setCargando(true);
    setFiltros((previos) => ({ ...previos, [campo]: evento.target.value }));
  };

  const reintentar = () => {
    setCargando(true);
    setError(null);
    setIntento((n) => n + 1);
  };

  const sucursalFija = tablero?.alcance?.sucursal_fija === true;
  const idSucursalVista = sucursalFija ? tablero.filtros.id_sucursal : filtros.id_sucursal;
  const opcionesSucursal = sucursales
    .filter((s) => !sucursalFija || s.id_sucursal === idSucursalVista)
    .map((s) => ({ valor: s.id_sucursal, etiqueta: s.nombre }));
  const opcionesArea = areas.map((a) => ({ valor: a.id_departamento, etiqueta: a.nombre }));
  const esMesActual = filtros.periodo === mesActual;
  const sinPersonal =
    tablero && tablero.kpis.every((k) => k.valor === null) && tablero.tendencia.every((p) => p.valor === null);
  const kpi10 = tablero?.kpis.find((k) => k.codigo === "KPI-10");

  return (
    <>
      <div className="rp-filtros" role="group" aria-label="Filtros del dashboard">
        <Selector etiqueta="Periodo" value={filtros.periodo} onChange={cambiar("periodo")} opciones={periodos} />
        <Selector
          etiqueta="Sucursal"
          value={idSucursalVista ?? ""}
          onChange={cambiar("id_sucursal")}
          opciones={opcionesSucursal}
          textoVacio={sucursalFija ? undefined : "Todas"}
          disabled={sucursalFija}
          ayuda={sucursalFija ? "Como supervisor, ve solo su sucursal." : undefined}
        />
        <Selector
          etiqueta="Área"
          value={filtros.id_departamento}
          onChange={cambiar("id_departamento")}
          opciones={opcionesArea}
          textoVacio="Todas"
        />
      </div>

      {error && (
        <Alerta
          tono="peligro"
          titulo={error.estado === 403 ? "Acceso restringido" : "No se pudieron cargar los indicadores"}
          acciones={error.estado === 403 ? undefined : <Boton onClick={reintentar}>Reintentar</Boton>}
          role="alert"
        >
          {error.message}
        </Alerta>
      )}

      {cargando && !tablero && !error && (
        <div className="rp-kpis" aria-busy="true" aria-label="Cargando indicadores">
          {[1, 2, 3].map((n) => (
            <Tarjeta key={n}>
              <Esqueleto ancho="60%" />
              <Esqueleto forma="bloque" alto="40px" />
              <Esqueleto ancho="80%" />
            </Tarjeta>
          ))}
        </div>
      )}

      {tablero && sinPersonal && (
        <EstadoVacio
          icono={UsersRound}
          titulo="Sin personal para estos filtros"
          mensaje="No hay colaboradores registrados en la sucursal y el área elegidas durante los últimos 12 meses."
        />
      )}

      {tablero && !sinPersonal && (
        <div className="rp-contenido" aria-busy={cargando || undefined}>
          {tablero.avisos?.bajas_sin_registro > 0 && (
            <Alerta tono="info" titulo="Bajas sin fecha de retiro">
              {tablero.avisos.bajas_sin_registro === 1
                ? "1 colaborador está dado de baja sin proceso de desvinculación registrado; no entra en los cálculos."
                : `${tablero.avisos.bajas_sin_registro} colaboradores están dados de baja sin proceso de desvinculación registrado; no entran en los cálculos.`}
            </Alerta>
          )}

          <section className="rp-kpis" aria-label="Indicadores">
            {tablero.kpis.map((kpi) => (
              <TarjetaKpi key={kpi.codigo} kpi={kpi} periodo={tablero.periodo} esMesActual={esMesActual} />
            ))}
          </section>

          <div className="rp-graficos">
            <Tarjeta titulo="Tendencia de rotación – últimos 12 meses" nivelTitulo={2} className="rp-grafico">
              <GraficoTendencia tendencia={tablero.tendencia} meta={kpi10?.meta ?? 3} />
            </Tarjeta>
            <Tarjeta titulo="Motivos de baja" nivelTitulo={2} className="rp-grafico">
              <p className="rp-sutil">
                {esMesActual ? "Últimos 12 meses, al día de hoy" : `12 meses hasta ${nombrePeriodo(tablero.periodo)}`}
              </p>
              {tablero.motivos.total === 0 ? (
                <EstadoVacio icono={Info} titulo="Sin bajas" mensaje="No hay bajas registradas en este rango." />
              ) : (
                <GraficoMotivos motivos={tablero.motivos} />
              )}
            </Tarjeta>
          </div>
        </div>
      )}
    </>
  );
}

// RF-75: Gerente de talento, Administrador de RRHH y supervisores (solo su sucursal). Exige sesión real: el alcance
// sale del JWT, no del usuario de prueba.
export default function RotacionPersonalPage() {
  const sesion = useSesion();

  return (
    <div className="rp-pagina">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Dashboards" }]}
        enlace={Link}
        titulo="Rotación de personal"
        descripcion="Rotación mensual, retención y rotación temprana del personal, con su tendencia y los motivos de baja."
      />
      {sesion === undefined && <Esqueleto forma="bloque" alto="calc(var(--size-row) * 4)" />}
      {sesion === null && (
        <EstadoVacio
          icono={LogIn}
          titulo="Inicie sesión para ver la rotación de personal"
          mensaje="Los indicadores se muestran con su propia cuenta, no con el usuario de prueba: un supervisor ve solo su sucursal."
          accion={
            <Boton variante="primario" icono={LogIn} onClick={() => abrirInicioSesion()}>
              Iniciar sesión
            </Boton>
          }
        />
      )}
      {sesion && <TableroRotacion key={sesion.id_empleado} />}
    </div>
  );
}

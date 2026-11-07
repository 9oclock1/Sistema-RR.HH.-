import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, RefreshCw, Settings2, TriangleAlert } from "lucide-react";
import { consultarCalendarioAusencias, obtenerAlcanceCalendario } from "../../api/calendarioAusencias";
import { Alerta, Boton, EncabezadoPagina, Esqueleto, EstadoVacio, Selector, Tarjeta } from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import { puedeAcceder } from "../../utils/permisos";
import Revisor from "../marcaje/Revisor";
import useRevisor from "../marcaje/useRevisor";
import Cuadricula from "./Cuadricula";
import DetalleAusencia from "./DetalleAusencia";
import UmbralesCobertura from "./UmbralesCobertura";
import VistaDia from "./VistaDia";
import {
  VISTAS,
  diasDelRango,
  filtrarTipos,
  hoyEnBolivia,
  indexarDias,
  indexarPorDia,
  moverAncla,
  plural,
  rangoDeVista,
  tituloDeVista,
  visualDeTipo,
} from "./calendario";
import "../marcaje/marcaje.css";
import "./calendarioAusencias.css";

const CLAVE_SUCURSAL = "rrhh.calendario.sucursal";
const MAX_BLOQUES_MES = 3;

function leerSucursal() {
  try {
    return localStorage.getItem(CLAVE_SUCURSAL) ?? "";
  } catch {
    return "";
  }
}

function guardarSucursal(id) {
  try {
    localStorage.setItem(CLAVE_SUCURSAL, id);
  } catch {
    // Sin almacenamiento local solo se pierde la preferencia.
  }
}

function Leyenda({ tipos, ocultos, onAlternar }) {
  return (
    <div className="cal-leyenda" role="group" aria-label="Tipos de ausencia (active o desactive para mostrarlos u ocultarlos)">
      {tipos.map((tipo) => {
        const visual = visualDeTipo(tipo.codigo);
        const oculto = ocultos.has(tipo.codigo);
        return (
          <button
            key={tipo.codigo}
            type="button"
            className={`cal-leyenda__tipo cal-tipo--${visual.clase} ds-foco ${oculto ? "cal-leyenda__tipo--oculto" : ""}`}
            aria-pressed={!oculto}
            onClick={() => onAlternar(tipo.codigo)}
          >
            <span className="cal-leyenda__muestra" aria-hidden="true" />
            {tipo.nombre}
          </button>
        );
      })}
    </div>
  );
}

// RF-35: cronograma general de ausencias aprobadas por sucursal y área, con aviso de baja cobertura.
export default function CalendarioAusenciasPage() {
  const rol = useRol();
  const usuario = useUsuario();
  // RRHH (administrador y gerente) elige cualquier sucursal; el supervisor se identifica y ve solo la suya.
  const esRrhh = puedeAcceder(rol, ["gerente"]);
  const { revisor, verificando, identificar, cambiar: cambiarSupervisor } = useRevisor();
  const idSupervisor = revisor?.id ?? null;
  const identidad = useMemo(
    () => (esRrhh ? { idEmpleado: usuario, rol } : { idEmpleado: idSupervisor, rol }),
    [esRrhh, idSupervisor, rol, usuario]
  );
  const claveIdentidad = esRrhh ? `rrhh:${rol}` : idSupervisor ? `supervisor:${idSupervisor}` : null;

  const [alcance, setAlcance] = useState({ clave: null, datos: null, error: null });
  const [idSucursal, setIdSucursal] = useState(leerSucursal);
  const [idDepartamento, setIdDepartamento] = useState("");
  const [vista, setVista] = useState("mes");
  const [ancla, setAncla] = useState(() => hoyEnBolivia());
  const [ocultos, setOcultos] = useState(() => new Set());
  const [resultado, setResultado] = useState({ clave: null });
  const [intento, setIntento] = useState(0);
  const [ausenciaAbierta, setAusenciaAbierta] = useState(null);
  const [umbralesAbiertos, setUmbralesAbiertos] = useState(false);

  const hoy = hoyEnBolivia();

  useEffect(() => {
    if (!claveIdentidad) return undefined;
    let vigente = true;
    obtenerAlcanceCalendario(identidad)
      .then((datos) => vigente && setAlcance({ clave: claveIdentidad, datos, error: null }))
      .catch((error) => {
        if (!vigente) return;
        // Un supervisor rechazado se vuelve a identificar.
        if (!esRrhh && (error.estado === 401 || error.estado === 403)) cambiarSupervisor();
        setAlcance({ clave: claveIdentidad, datos: null, error: error.message });
      });
    return () => {
      vigente = false;
    };
  }, [claveIdentidad, identidad, esRrhh]); // eslint-disable-line react-hooks/exhaustive-deps

  const datosAlcance = alcance.clave === claveIdentidad ? alcance.datos : null;
  const errorAlcance = alcance.clave === claveIdentidad ? alcance.error : null;
  const cargandoAlcance = Boolean(claveIdentidad) && alcance.clave !== claveIdentidad;

  // El supervisor no elige la sucursal; RRHH recuerda la última y la descarta si ya no existe.
  const sucursalElegida =
    datosAlcance?.sucursal_fija ?? (datosAlcance?.sucursales.some((s) => s.id_sucursal === idSucursal) ? idSucursal : "");

  const rango = useMemo(() => rangoDeVista(vista, ancla), [vista, ancla]);
  const clave = datosAlcance && sucursalElegida ? [claveIdentidad, sucursalElegida, idDepartamento, rango.desde, rango.hasta, intento].join("|") : null;

  useEffect(() => {
    if (!clave) return undefined;
    let vigente = true;
    consultarCalendarioAusencias(
      { id_sucursal: sucursalElegida, id_departamento: idDepartamento, desde: rango.desde, hasta: rango.hasta },
      identidad
    )
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error: error.message }));
    return () => {
      vigente = false;
    };
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  const vistaActual = resultado.clave === clave ? resultado : {};
  const datos = vistaActual.datos;

  // Se indexa una sola vez por consulta y por filtro de leyenda, no en cada render.
  const { porDia, estadoDias } = useMemo(() => {
    if (!datos) return { porDia: new Map(), estadoDias: new Map() };
    return {
      porDia: indexarPorDia(filtrarTipos(datos.ausencias, ocultos), rango.desde, rango.hasta),
      estadoDias: indexarDias(datos.dias),
    };
  }, [datos, ocultos, rango.desde, rango.hasta]);

  const dias = useMemo(() => diasDelRango(rango.desde, rango.hasta), [rango]);
  const alternarTipo = (codigo) =>
    setOcultos((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(codigo)) siguiente.delete(codigo);
      else siguiente.add(codigo);
      return siguiente;
    });

  const abrirDia = (fecha) => {
    setAncla(fecha);
    setVista("dia");
  };
  const cambiarSucursal = (evento) => {
    guardarSucursal(evento.target.value);
    setIdSucursal(evento.target.value);
  };

  const opcionesSucursal = (datosAlcance?.sucursales ?? []).map((s) => ({ valor: s.id_sucursal, etiqueta: s.nombre }));
  const opcionesArea = (datosAlcance?.areas ?? []).map((a) => ({ valor: a.id_departamento, etiqueta: a.nombre }));
  const mesDeReferencia = vista === "mes" ? ancla.slice(0, 7) : null;
  const cargando = Boolean(clave) && !vistaActual.datos && !vistaActual.error;

  return (
    <section className="cal" aria-labelledby="cal-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Asistencia" }]}
        enlace={Link}
        titulo="Calendario de ausencias"
        idTitulo="cal-titulo"
        descripcion="Vacaciones, permisos y licencias aprobadas por sucursal y área, para cuidar la cobertura de los turnos."
        acciones={
          <>
            {datosAlcance?.puede_configurar && (
              <Boton icono={Settings2} onClick={() => setUmbralesAbiertos(true)}>
                Umbrales de cobertura
              </Boton>
            )}
            {clave && (
              <Boton icono={RefreshCw} onClick={() => setIntento((n) => n + 1)}>
                Actualizar
              </Boton>
            )}
          </>
        }
      />

      {!esRrhh && !verificando && (
        <div className="cal-identidad">
          {revisor ? (
            <Revisor revisor={revisor} etiqueta="Supervisor" onCambiar={cambiarSupervisor} />
          ) : (
            <Revisor etiqueta="Supervisor" onIdentificado={identificar} />
          )}
        </div>
      )}

      {errorAlcance && (
        <Alerta tono="peligro" role="alert" titulo="No se pudieron cargar los filtros">
          {errorAlcance}
        </Alerta>
      )}

      {claveIdentidad && !errorAlcance && (
        <Tarjeta className="cal-filtros" nivelTitulo={2} titulo="Filtros">
          {cargandoAlcance ? (
            <div className="cal-filtros__campos" aria-busy="true">
              <Esqueleto forma="bloque" />
              <Esqueleto forma="bloque" />
            </div>
          ) : (
            <div className="cal-filtros__campos">
              <Selector
                etiqueta="Sucursal"
                value={sucursalElegida}
                onChange={cambiarSucursal}
                opciones={opcionesSucursal}
                textoVacio={datosAlcance?.sucursal_fija ? undefined : "Seleccione…"}
                disabled={Boolean(datosAlcance?.sucursal_fija)}
              />
              <Selector
                etiqueta="Departamento"
                value={idDepartamento}
                onChange={(evento) => setIdDepartamento(evento.target.value)}
                opciones={opcionesArea}
                textoVacio="Todos los departamentos"
              />
            </div>
          )}
        </Tarjeta>
      )}

      {datosAlcance && !sucursalElegida && (
        <EstadoVacio titulo="Elija la sucursal" mensaje="Se mostrarán las vacaciones, permisos y licencias aprobadas de su personal." />
      )}

      {clave && (
        <Tarjeta className="cal-tarjeta" nivelTitulo={2} titulo={tituloDeVista(vista, ancla)}>
          <div className="cal-barra">
            <div className="cal-barra__navegacion" role="group" aria-label="Navegación del calendario">
              <Boton soloIcono icono={ChevronLeft} aria-label="Anterior" onClick={() => setAncla(moverAncla(vista, ancla, -1))} />
              <Boton onClick={() => setAncla(hoy)}>Hoy</Boton>
              <Boton soloIcono icono={ChevronRight} aria-label="Siguiente" onClick={() => setAncla(moverAncla(vista, ancla, 1))} />
            </div>
            <div className="cal-barra__vistas" role="group" aria-label="Vista del calendario">
              {Object.values(VISTAS).map((opcion) => (
                <Boton
                  key={opcion.id}
                  variante={vista === opcion.id ? "primario" : "predeterminado"}
                  aria-pressed={vista === opcion.id}
                  onClick={() => setVista(opcion.id)}
                >
                  {opcion.etiqueta}
                </Boton>
              ))}
            </div>
          </div>

          {datosAlcance && <Leyenda tipos={datosAlcance.tipos} ocultos={ocultos} onAlternar={alternarTipo} />}

          {vistaActual.error && (
            <Alerta
              tono="peligro"
              role="alert"
              titulo="No se pudo cargar el calendario"
              acciones={
                <Boton tamano="sm" onClick={() => setIntento((n) => n + 1)}>
                  Reintentar
                </Boton>
              }
            >
              {vistaActual.error}
            </Alerta>
          )}

          {cargando && (
            <div aria-busy="true">
              <p className="ds-solo-lector" role="status">
                Cargando el calendario…
              </p>
              <Esqueleto forma="bloque" alto="20rem" />
            </div>
          )}

          {datos && (
            <>
              <p className="cal-resumen" role="status">
                {plural(datos.resumen.colaboradores_ausentes, "colaborador ausente", "colaboradores ausentes")} de {datos.equipo.activos} en el
                periodo
                {datos.resumen.dias_con_baja_cobertura > 0 && (
                  <span className="cal-resumen__alerta">
                    <TriangleAlert className="ds-icono" aria-hidden="true" />
                    {plural(datos.resumen.dias_con_baja_cobertura, "día con baja cobertura", "días con baja cobertura")}
                  </span>
                )}
              </p>

              {vista === "dia" ? (
                <VistaDia fecha={ancla} ausencias={porDia.get(ancla) ?? []} estado={estadoDias.get(ancla)} onAbrirAusencia={setAusenciaAbierta} />
              ) : (
                <Cuadricula
                  dias={dias}
                  porDia={porDia}
                  estadoDias={estadoDias}
                  hoy={hoy}
                  mesDeReferencia={mesDeReferencia}
                  maxBloques={vista === "mes" ? MAX_BLOQUES_MES : 0}
                  onAbrirDia={abrirDia}
                  onAbrirAusencia={setAusenciaAbierta}
                  etiqueta={`Ausencias aprobadas, ${tituloDeVista(vista, ancla)}`}
                />
              )}
            </>
          )}
        </Tarjeta>
      )}

      <DetalleAusencia ausencia={ausenciaAbierta} onCerrar={() => setAusenciaAbierta(null)} />

      {datosAlcance?.puede_configurar && umbralesAbiertos && (
        <UmbralesCobertura
          abierto
          alcance={datosAlcance}
          identidad={identidad}
          onCerrar={() => setUmbralesAbiertos(false)}
          onCambio={() => setIntento((n) => n + 1)}
        />
      )}
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  AlarmClock,
  CalendarOff,
  CircleCheck,
  Clock,
  FileCheck,
  Hourglass,
  LogOut,
  RefreshCw,
  TimerOff,
  UserX,
  UsersRound,
} from "lucide-react";
import { consultarPanel } from "../../api/alertasAsistencia";
import { listarAreas, listarSucursales } from "../../api/rolesTurno";
import {
  Alerta,
  Boton,
  Casilla,
  CampoTexto,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Selector,
  Tabla,
  Tarjeta,
} from "../../components/ui";
import { formatearFecha, formatearHora, formatearMinutos, hoyEnBolivia } from "./formato";
import "./alertasAsistencia.css";

const INTERVALO_MS = 60 * 1000;
const CLAVE_SUCURSAL = "rrhh.alertas.sucursal";

const ESTADOS = {
  INASISTENCIA: { tono: "peligro", icono: UserX },
  INASISTENCIA_JUSTIFICADA: { tono: "info", icono: FileCheck },
  SIN_MARCAR: { tono: "aviso", icono: Clock },
  ATRASO: { tono: "aviso", icono: AlarmClock },
  ATRASO_JUSTIFICADO: { tono: "info", icono: FileCheck },
  POR_LLEGAR: { tono: "info", icono: Hourglass },
  PUNTUAL: { tono: "exito", icono: CircleCheck },
  DESCANSO: { tono: "neutral", icono: CalendarOff },
  SIN_TURNO: { tono: "neutral", icono: CalendarOff },
};

const justificada = (fila, tipo) => fila.justificadas.includes(tipo);
const salidaSinJustificar = (f) => f.minutos_salida_anticipada !== null && !justificada(f, "SALIDA_ANTICIPADA");

// Indicadores del día; cada uno filtra la tabla.
const INDICADORES = [
  { clave: "INASISTENCIA", etiqueta: "Faltas", campo: "inasistencias", coincide: (f) => f.estado.codigo === "INASISTENCIA" },
  { clave: "SIN_MARCAR", etiqueta: "Sin marcar", campo: "sin_marcar", coincide: (f) => f.estado.codigo === "SIN_MARCAR" },
  { clave: "ATRASO", etiqueta: "Atrasos", campo: "atrasos", coincide: (f) => f.estado.codigo === "ATRASO" },
  {
    clave: "SALIDA_ANTICIPADA",
    etiqueta: "Salidas anticipadas",
    campo: "salidas_anticipadas",
    tono: "aviso",
    icono: LogOut,
    coincide: salidaSinJustificar,
  },
  {
    clave: "OMISION_SALIDA",
    etiqueta: "Sin salida",
    campo: "omisiones_salida",
    tono: "aviso",
    icono: TimerOff,
    coincide: (f) => f.omision_salida,
  },
  {
    clave: "JUSTIFICADA",
    etiqueta: "Justificadas",
    campo: "justificadas",
    tono: "info",
    icono: FileCheck,
    coincide: (f) => f.justificadas.length > 0,
  },
  { clave: "PUNTUAL", etiqueta: "Puntuales", campo: "puntuales", coincide: (f) => f.estado.codigo === "PUNTUAL" },
  { clave: "POR_LLEGAR", etiqueta: "Por llegar", campo: "por_llegar", soloHoy: true, coincide: (f) => f.estado.codigo === "POR_LLEGAR" },
].map((indicador) => ({ ...ESTADOS[indicador.clave], ...indicador }));

const ESTADOS_CON_ALERTA = ["INASISTENCIA", "SIN_MARCAR", "ATRASO"];
const tieneAlerta = (f) => ESTADOS_CON_ALERTA.includes(f.estado.codigo) || salidaSinJustificar(f) || f.omision_salida;

function leerSucursalGuardada() {
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

function Indicadores({ resumen, esHoy, filtro, onFiltrar }) {
  const visibles = INDICADORES.filter((i) => !i.soloHoy || esHoy);
  return (
    <ul className="aa-indicadores" aria-label="Resumen del día">
      {visibles.map(({ clave, etiqueta, campo, tono, icono: Icono }) => (
        <li key={clave}>
          <button
            type="button"
            className={`aa-indicador aa-indicador--${tono} ds-foco`}
            aria-pressed={filtro === clave}
            onClick={() => onFiltrar(filtro === clave ? null : clave)}
          >
            <span className="aa-indicador__etiqueta">
              <Icono className="ds-icono aa-indicador__icono" aria-hidden="true" />
              {etiqueta}
            </span>
            <span className="aa-indicador__valor">{resumen[campo]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function CargandoIndicadores() {
  return (
    <div className="aa-indicadores" aria-hidden="true">
      {INDICADORES.slice(0, 6).map((i) => (
        <Esqueleto key={i.clave} forma="bloque" alto="var(--size-touch)" />
      ))}
    </div>
  );
}

const Hora = ({ marcaje }) =>
  marcaje ? (
    <time dateTime={marcaje.fecha_hora_marcaje}>{formatearHora(marcaje.fecha_hora_marcaje)}</time>
  ) : (
    <>
      <span className="aa-sutil" aria-hidden="true">
        —
      </span>
      <span className="ds-solo-lector">Sin registro</span>
    </>
  );

function detallesDe(fila) {
  const detalles = [];
  const nota = (tipo, texto) =>
    justificada(fila, tipo) ? `${texto}, ${tipo === "INASISTENCIA" ? "justificadas" : "justificado"}` : texto;
  if (fila.minutos_atraso !== null) detalles.push(nota("ATRASO", `${formatearMinutos(fila.minutos_atraso)} de atraso`));
  if (fila.minutos_inasistencia !== null) {
    detalles.push(nota("INASISTENCIA", `${formatearMinutos(fila.minutos_inasistencia)} no trabajadas`));
  }
  if (fila.estado.codigo === "SIN_MARCAR") {
    detalles.push(`Tolerancia vencida a las ${formatearHora(fila.turno.limite_puntualidad)}`);
  }
  if (fila.minutos_salida_anticipada !== null) {
    detalles.push(nota("SALIDA_ANTICIPADA", `Salió ${formatearMinutos(fila.minutos_salida_anticipada)} antes del fin`));
  }
  if (fila.omision_salida) detalles.push("No marcó la salida");
  return detalles;
}

const COLUMNAS = [
  {
    clave: "colaborador",
    titulo: "Colaborador",
    ancho: "21%",
    celda: (f) => (
      <div className="aa-celda">
        <span className="aa-celda__principal">{f.nombre_completo}</span>
        {(f.cargo || f.area) && (
          <span className="aa-celda__secundario">{[f.cargo, f.area].filter(Boolean).join(" · ")}</span>
        )}
      </div>
    ),
  },
  {
    clave: "turno",
    titulo: "Turno",
    ancho: "19%",
    celda: (f) =>
      f.turno ? (
        <div className="aa-celda">
          <span className="aa-celda__principal">
            {f.turno.hora_inicio}–{f.turno.hora_fin}
          </span>
          <span className="aa-celda__secundario">
            {f.turno.nombre} · {f.turno.minutos_tolerancia} min de tolerancia
          </span>
        </div>
      ) : (
        <span className="aa-sutil">{f.descanso ? "Descanso" : "Sin turno"}</span>
      ),
  },
  { clave: "entrada", titulo: "Entrada", ancho: "8%", celda: (f) => (f.turno ? <Hora marcaje={f.entrada} /> : "—") },
  { clave: "salida", titulo: "Salida", ancho: "8%", celda: (f) => (f.turno ? <Hora marcaje={f.salida} /> : "—") },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "18%",
    celda: (f) => (
      <Etiqueta tono={ESTADOS[f.estado.codigo].tono} icono={ESTADOS[f.estado.codigo].icono}>
        {f.estado.nombre}
      </Etiqueta>
    ),
  },
  {
    clave: "detalle",
    titulo: "Detalle",
    ancho: "15%",
    celda: (f) => {
      const detalles = detallesDe(f);
      return detalles.length ? (
        <ul className="aa-detalles">
          {detalles.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : (
        <span className="aa-sutil">—</span>
      );
    },
  },
  {
    clave: "mes",
    titulo: "Atraso del mes",
    ancho: "11%",
    alinear: "fin",
    celda: (f) =>
      f.atraso_del_mes.cantidad ? (
        <span title={`${f.atraso_del_mes.cantidad} atraso(s) en el mes`}>
          {formatearMinutos(f.atraso_del_mes.minutos)} ({f.atraso_del_mes.cantidad})
        </span>
      ) : (
        <span className="aa-sutil">0 min</span>
      ),
  },
];

export default function AlertasAsistenciaPage() {
  const [catalogos, setCatalogos] = useState(null);
  const [errorCatalogos, setErrorCatalogos] = useState(null);
  const [intentoCatalogos, setIntentoCatalogos] = useState(0);
  const [filtros, setFiltros] = useState(() => ({
    id_sucursal: leerSucursalGuardada(),
    id_departamento: "",
    fecha: hoyEnBolivia(),
  }));
  const [filtroEstado, setFiltroEstado] = useState(null);
  const [automatico, setAutomatico] = useState(true);
  // El resultado se guarda con la clave de los filtros que lo pidieron; si no coincide, se está cargando.
  const [resultado, setResultado] = useState({ clave: null });
  const [intento, setIntento] = useState(0);
  const [actualizando, setActualizando] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const manual = useRef(false);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarSucursales(), listarAreas()])
      .then(([sucursales, areas]) => vigente && setCatalogos({ sucursales, areas }))
      .catch((error) => vigente && setErrorCatalogos(error.message));
    return () => {
      vigente = false;
    };
  }, [intentoCatalogos]);

  // Una sucursal guardada que ya no existe no se usa.
  const sucursalValida =
    filtros.id_sucursal && (!catalogos || catalogos.sucursales.some((s) => s.id_sucursal === filtros.id_sucursal));
  const clave = catalogos && sucursalValida ? `${filtros.id_sucursal}|${filtros.id_departamento}|${filtros.fecha}` : null;
  const esHoy = filtros.fecha === hoyEnBolivia();

  useEffect(() => {
    if (!clave) return undefined;
    let vigente = true;
    const [idSucursal, idDepartamento, fecha] = clave.split("|");
    consultarPanel({ idSucursal, idDepartamento, fecha })
      .then((datos) => {
        if (!vigente) return;
        setResultado({ clave, estado: "listo", datos });
        if (manual.current) setAnuncio(`Datos actualizados a las ${formatearHora(datos.generado_en)}.`);
      })
      .catch((error) => {
        if (!vigente) return;
        // Si falla una actualización, se conservan los datos que ya se veían.
        setResultado((previo) =>
          previo.clave === clave && previo.datos
            ? { ...previo, errorActualizacion: error.message }
            : { clave, estado: "error", mensaje: error.message }
        );
      })
      .finally(() => {
        if (!vigente) return;
        manual.current = false;
        setActualizando(false);
      });
    return () => {
      vigente = false;
    };
  }, [clave, intento]);

  useEffect(() => {
    if (!automatico || !clave || !esHoy) return undefined;
    const temporizador = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setActualizando(true);
      setIntento((n) => n + 1);
    }, INTERVALO_MS);
    return () => clearInterval(temporizador);
  }, [automatico, clave, esHoy]);

  const vista = resultado.clave === clave ? resultado : { estado: "cargando" };
  const datos = vista.datos;

  const actualizar = () => {
    manual.current = true;
    setAnuncio("");
    setActualizando(true);
    setIntento((n) => n + 1);
  };

  const cambiarFiltro = (campo) => (evento) => {
    const valor = evento.target.value;
    if (campo === "fecha" && !valor) return;
    if (campo === "id_sucursal") guardarSucursal(valor);
    setFiltroEstado(null);
    setFiltros((actual) => ({ ...actual, [campo]: valor }));
  };

  const opcionesSucursal = useMemo(
    () => (catalogos?.sucursales ?? []).map((s) => ({ valor: s.id_sucursal, etiqueta: s.nombre })),
    [catalogos]
  );
  const opcionesArea = useMemo(
    () => (catalogos?.areas ?? []).map((a) => ({ valor: a.id_departamento, etiqueta: a.nombre })),
    [catalogos]
  );

  const indicador = INDICADORES.find((i) => i.clave === filtroEstado);
  const filas = datos ? (indicador ? datos.colaboradores.filter(indicador.coincide) : datos.colaboradores) : [];
  const alertas = datos ? datos.colaboradores.filter(tieneAlerta).length : 0;

  return (
    <section className="aa-pagina" aria-labelledby="aa-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Asistencia" }]}
        enlace={Link}
        titulo="Alertas de asistencia"
        idTitulo="aa-titulo"
        descripcion="Atrasos, faltas y salidas anticipadas del personal, contrastados con los turnos programados."
        acciones={
          clave && (
            <Boton icono={RefreshCw} onClick={actualizar} cargando={actualizando} disabled={vista.estado === "cargando"}>
              Actualizar
            </Boton>
          )
        }
      />

      <p className="ds-solo-lector" role="status">
        {anuncio}
      </p>

      {errorCatalogos && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar las sucursales y áreas"
          acciones={
            <Boton
              tamano="sm"
              onClick={() => {
                setErrorCatalogos(null);
                setIntentoCatalogos((n) => n + 1);
              }}
            >
              Reintentar
            </Boton>
          }
        >
          {errorCatalogos}
        </Alerta>
      )}

      <Tarjeta className="aa-filtros" nivelTitulo={2} titulo="Jornada a revisar">
        {!catalogos && !errorCatalogos ? (
          <div className="aa-filtros__campos" aria-busy="true">
            <Esqueleto forma="bloque" />
            <Esqueleto forma="bloque" />
            <Esqueleto forma="bloque" />
          </div>
        ) : (
          <div className="aa-filtros__campos">
            <Selector
              etiqueta="Sucursal"
              value={sucursalValida ? filtros.id_sucursal : ""}
              onChange={cambiarFiltro("id_sucursal")}
              opciones={opcionesSucursal}
              textoVacio="Seleccione…"
            />
            <Selector
              etiqueta="Área"
              value={filtros.id_departamento}
              onChange={cambiarFiltro("id_departamento")}
              opciones={opcionesArea}
              textoVacio="Todas las áreas"
            />
            <CampoTexto
              etiqueta="Fecha"
              type="date"
              value={filtros.fecha}
              max={hoyEnBolivia()}
              onChange={cambiarFiltro("fecha")}
            />
          </div>
        )}
        {clave && esHoy && (
          <div className="aa-filtros__pie">
            <Casilla
              etiqueta="Actualizar cada minuto"
              checked={automatico}
              onChange={(evento) => setAutomatico(evento.target.checked)}
            />
            {datos && <span className="aa-sutil">Actualizado a las {formatearHora(datos.generado_en)}</span>}
          </div>
        )}
      </Tarjeta>

      {!clave && catalogos && (
        <EstadoVacio
          titulo="Elija la sucursal"
          mensaje="Se mostrará el estado de la jornada de cada colaborador: quién llegó tarde, quién falta y quién salió antes."
        />
      )}

      {clave && vista.estado === "error" && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudo cargar la asistencia"
          acciones={
            <Boton tamano="sm" onClick={actualizar}>
              Reintentar
            </Boton>
          }
        >
          {vista.mensaje}
        </Alerta>
      )}

      {clave && vista.errorActualizacion && (
        <Alerta tono="aviso" titulo="No se pudo actualizar">
          Se muestran los datos de las {formatearHora(datos.generado_en)}. {vista.errorActualizacion}
        </Alerta>
      )}

      {clave && vista.estado !== "error" && (
        <>
          <section className="aa-resumen" aria-labelledby="aa-resumen-titulo">
            <h2 id="aa-resumen-titulo" className="aa-resumen__titulo">
              {datos ? (
                <>
                  {esHoy ? "Hoy" : formatearFecha(datos.fecha)}: {datos.resumen.con_turno} con turno
                  {alertas > 0 ? `, ${alertas} con alerta` : ", sin alertas"}
                </>
              ) : (
                "Resumen del día"
              )}
            </h2>
            {datos ? (
              <Indicadores resumen={datos.resumen} esHoy={datos.es_hoy} filtro={filtroEstado} onFiltrar={setFiltroEstado} />
            ) : (
              <CargandoIndicadores />
            )}
          </section>

          <Tarjeta
            className="aa-tabla"
            nivelTitulo={2}
            titulo={indicador ? `${indicador.etiqueta} (${filas.length})` : `Colaboradores (${datos?.colaboradores.length ?? "…"})`}
            acciones={
              indicador && (
                <Boton variante="sutil" tamano="sm" onClick={() => setFiltroEstado(null)}>
                  Ver todos
                </Boton>
              )
            }
          >
            <Tabla
              columnas={COLUMNAS}
              filas={filas}
              claveFila="id_empleado"
              descripcion="Estado de la jornada por colaborador"
              cargando={!datos}
              vacio={
                indicador ? (
                  <EstadoVacio
                    titulo={`Ningún colaborador en «${indicador.etiqueta.toLowerCase()}»`}
                    accion={<Boton onClick={() => setFiltroEstado(null)}>Ver todos</Boton>}
                  />
                ) : (
                  <EstadoVacio
                    icono={UsersRound}
                    titulo="No hay personal activo"
                    mensaje="La sucursal no tiene colaboradores activos en el área elegida."
                  />
                )
              }
            />
          </Tarjeta>
        </>
      )}
    </section>
  );
}

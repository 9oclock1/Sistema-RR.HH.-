import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  CircleCheck,
  Clock,
  Download,
  Hourglass,
  Lock,
  MoonStar,
  RefreshCw,
  ShieldCheck,
  Timer,
  Trash2,
} from "lucide-react";
import {
  anularAutorizacion,
  consolidarPeriodo,
  listarAutorizaciones,
  listarHorasExtra,
  listarPeriodos,
  resumenHorasExtra,
  urlResumenCsv,
} from "../../api/horasExtra";
import { listarAreas, listarSucursales } from "../../api/rolesTurno";
import {
  Alerta,
  Boton,
  CampoTexto,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  ModalConfirmacion,
  Pestanas,
  Selector,
  Tabla,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import Revisor from "../marcaje/Revisor";
import useRevisor from "../marcaje/useRevisor";
import AutorizacionHorasExtra from "./AutorizacionHorasExtra";
import RevisionHorasExtra from "./RevisionHorasExtra";
import {
  ESTADOS_HORAS,
  formatearFechaLarga,
  formatearHora,
  formatearJornada,
  formatearMinutos,
  hoyBolivia,
} from "./formato";
import "../marcaje/marcaje.css";
import "./horasExtra.css";

const CLAVE_SUCURSAL = "rrhh.horasExtra.sucursal";
const PESTANAS = [
  { id: "PENDIENTE", etiqueta: "Por revisar" },
  { id: "TODAS", etiqueta: "Todas las jornadas" },
  { id: "TOTALES", etiqueta: "Totales por colaborador" },
  { id: "AUTORIZACIONES", etiqueta: "Autorizaciones previas" },
];

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

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Errores del rango antes de consultar; los demás límites los informa la API.
function validarRango({ desde, hasta }) {
  const errores = {};
  if (!FECHA_RE.test(desde)) errores.desde = "Elija la fecha inicial.";
  if (!FECHA_RE.test(hasta)) errores.hasta = "Elija la fecha final.";
  if (!errores.desde && !errores.hasta && desde > hasta) errores.desde = "Debe ser anterior o igual a la fecha final.";
  return errores;
}

const minutos = (valor) => (valor ? formatearMinutos(valor) : "—");

function EstadoHoras({ jornada }) {
  const estado = ESTADOS_HORAS[jornada.estado.codigo];
  return (
    <div className="he-celda">
      <span>
        <Etiqueta tono={estado.tono} icono={estado.icono}>
          {estado.texto}
        </Etiqueta>
      </span>
      {jornada.consolidada && (
        <span className="he-sutil he-consolidada">
          <Lock className="ds-icono" aria-hidden="true" />
          Consolidada
        </span>
      )}
    </div>
  );
}

// Lo que se paga de extra: simples, dobles y feriado.
function Pagadas({ pago }) {
  const partes = [
    pago.minutos_extra_simples > 0 && `${formatearMinutos(pago.minutos_extra_simples)} simples`,
    pago.minutos_extra_dobles - pago.minutos_feriado > 0 &&
      `${formatearMinutos(pago.minutos_extra_dobles - pago.minutos_feriado)} dobles`,
    pago.minutos_feriado > 0 && `${formatearMinutos(pago.minutos_feriado)} de feriado (dobles)`,
  ].filter(Boolean);
  if (partes.length === 0) return <span className="he-sutil">—</span>;
  return (
    <div className="he-celda">
      {partes.map((p) => (
        <span key={p}>{p}</span>
      ))}
      {pago.minutos_extra_nocturnos > 0 && (
        <span className="he-sutil">{formatearMinutos(pago.minutos_extra_nocturnos)} nocturnas</span>
      )}
    </div>
  );
}

const columnasJornadas = (accion) => [
  {
    clave: "colaborador",
    titulo: "Colaborador",
    ancho: "17%",
    celda: (j) => (
      <div className="he-celda">
        <span className="he-celda__principal">{j.empleado.nombre_completo}</span>
        {j.empleado.cargo && <span className="he-sutil">{j.empleado.cargo}</span>}
      </div>
    ),
  },
  {
    clave: "jornada",
    titulo: "Jornada",
    ancho: "16%",
    celda: (j) => (
      <div className="he-celda">
        <span className="he-celda__principal he-capital">{formatearJornada(j.fecha_jornada)}</span>
        <span className="he-sutil">
          {j.turno
            ? `${j.turno.nombre}, ${formatearHora(j.turno.inicio_programado)}–${formatearHora(j.turno.fin_programado)}`
            : "Sin turno (descanso)"}
        </span>
        {j.feriado && (
          <span>
            <Etiqueta tono="morado">Feriado: {j.feriado}</Etiqueta>
          </span>
        )}
      </div>
    ),
  },
  {
    clave: "marcaje",
    titulo: "Marcaje",
    ancho: "13%",
    celda: (j) => (
      <div className="he-celda">
        <span className="he-numero">
          {formatearHora(j.entrada_en)}–{formatearHora(j.salida_en)}
        </span>
        <span className="he-sutil">{formatearMinutos(j.minutos_trabajados)} en total</span>
      </div>
    ),
  },
  {
    clave: "ordinarias",
    titulo: "Ordinarias",
    ancho: "12%",
    celda: (j) => (
      <div className="he-celda">
        <span className="he-numero">{minutos(j.minutos_ordinarios)}</span>
        {j.minutos_ordinarios_nocturnos > 0 && (
          <span className="he-sutil">{formatearMinutos(j.minutos_ordinarios_nocturnos)} nocturnas</span>
        )}
      </div>
    ),
  },
  {
    clave: "reloj",
    titulo: "Extra en reloj",
    ancho: "12%",
    celda: (j) => (
      <div className="he-celda">
        <span className="he-numero">{minutos(j.minutos_extra)}</span>
        {j.minutos_anticipados > 0 && (
          <span className="he-sutil">{formatearMinutos(j.minutos_anticipados)} antes del turno</span>
        )}
        {j.autorizacion && (
          <span className="he-sutil">{formatearMinutos(j.autorizacion.minutos_autorizados)} autorizadas</span>
        )}
      </div>
    ),
  },
  { clave: "pagadas", titulo: "Extra a pagar", ancho: "14%", celda: (j) => <Pagadas pago={j.pago} /> },
  { clave: "estado", titulo: "Estado", ancho: accion ? "10%" : "16%", celda: (j) => <EstadoHoras jornada={j} /> },
  ...(accion ? [accion] : []),
];

// Revisar las pendientes; ver las ya decididas. Sin extra no hay nada que revisar.
const accionRevisar = (onAbrir) => ({
  clave: "accion",
  titulo: <span className="ds-solo-lector">Acción</span>,
  ancho: "6%",
  alinear: "fin",
  celda: (j) => {
    if (j.estado.codigo === "SIN_EXTRA") return null;
    const pendiente = j.estado.codigo === "PENDIENTE" && !j.consolidada;
    return (
      <Boton
        tamano="sm"
        variante={pendiente ? "primario" : "predeterminado"}
        onClick={() => onAbrir(j)}
        aria-label={`${pendiente ? "Revisar" : "Ver"} las horas extra de ${j.empleado.nombre_completo} del ${formatearJornada(j.fecha_jornada)}`}
      >
        {pendiente ? "Revisar" : "Ver"}
      </Boton>
    );
  },
});

const columnasAutorizaciones = (onAnular, hoy) => [
  {
    clave: "colaborador",
    titulo: "Colaborador",
    ancho: "24%",
    celda: (a) => (
      <div className="he-celda">
        <span className="he-celda__principal">{a.empleado.nombre_completo}</span>
        {a.empleado.cargo && <span className="he-sutil">{a.empleado.cargo}</span>}
      </div>
    ),
  },
  {
    clave: "dia",
    titulo: "Día",
    ancho: "14%",
    celda: (a) => <span className="he-capital">{formatearJornada(a.fecha_jornada)}</span>,
  },
  {
    clave: "minutos",
    titulo: "Autorizado",
    ancho: "12%",
    celda: (a) => <span className="he-numero">{formatearMinutos(a.minutos_autorizados)}</span>,
  },
  { clave: "motivo", titulo: "Motivo", ancho: "26%", celda: (a) => <span className="he-texto">{a.motivo}</span> },
  { clave: "autorizo", titulo: "Autorizó", ancho: "16%", celda: (a) => a.autorizador.nombre_completo },
  {
    clave: "accion",
    titulo: <span className="ds-solo-lector">Acción</span>,
    ancho: "8%",
    alinear: "fin",
    celda: (a) =>
      a.fecha_jornada >= hoy && (
        <Boton
          tamano="sm"
          variante="sutil"
          icono={Trash2}
          onClick={() => onAnular(a)}
          aria-label={`Anular la autorización de ${a.empleado.nombre_completo} del ${formatearJornada(a.fecha_jornada)}`}
        >
          Anular
        </Boton>
      ),
  },
];

const columnasTotales = [
  {
    clave: "colaborador",
    titulo: "Colaborador",
    ancho: "22%",
    celda: (t) => (
      <div className="he-celda">
        <span className="he-celda__principal">{t.empleado.nombre_completo}</span>
        {t.empleado.cargo && <span className="he-sutil">{t.empleado.cargo}</span>}
      </div>
    ),
  },
  {
    clave: "jornadas",
    titulo: "Jornadas",
    ancho: "8%",
    alinear: "fin",
    celda: (t) => <span className="he-numero">{t.jornadas}</span>,
  },
  {
    clave: "ordinarias",
    titulo: "Ordinarias",
    ancho: "11%",
    alinear: "fin",
    celda: (t) => <span className="he-numero">{minutos(t.minutos_ordinarios)}</span>,
  },
  {
    clave: "nocturnas",
    titulo: "Nocturnas",
    ancho: "11%",
    alinear: "fin",
    celda: (t) => <span className="he-numero">{minutos(t.minutos_nocturnos)}</span>,
  },
  {
    clave: "simples",
    titulo: "Extra simples",
    ancho: "11%",
    alinear: "fin",
    celda: (t) => <span className="he-numero">{minutos(t.minutos_extra_simples)}</span>,
  },
  {
    clave: "dobles",
    titulo: "Extra dobles",
    ancho: "12%",
    alinear: "fin",
    celda: (t) => (
      <div className="he-celda he-celda--fin">
        <span className="he-numero">{minutos(t.minutos_extra_dobles)}</span>
        {t.minutos_feriado > 0 && (
          <span className="he-sutil">incluye {formatearMinutos(t.minutos_feriado)} de feriado</span>
        )}
      </div>
    ),
  },
  {
    clave: "conciliacion",
    titulo: "Marcadas / aprobadas",
    ancho: "15%",
    alinear: "fin",
    celda: (t) => (
      <span className="he-numero">
        {minutos(t.minutos_extra + t.minutos_anticipados)} / {minutos(t.minutos_extra_aprobados)}
      </span>
    ),
  },
  {
    clave: "pendientes",
    titulo: "Por revisar",
    ancho: "10%",
    alinear: "fin",
    celda: (t) =>
      t.pendientes > 0 ? <Etiqueta tono="info">{t.pendientes}</Etiqueta> : <span className="he-sutil">—</span>,
  },
];

function Indicadores({ resumen }) {
  const feriado = resumen?.minutos_feriado ?? 0;
  const dobles = (resumen?.minutos_extra_dobles ?? 0) - feriado;
  const simples = resumen?.minutos_extra_simples ?? 0;
  const detallePago =
    [
      simples > 0 && `${formatearMinutos(simples)} simples`,
      dobles > 0 && `${formatearMinutos(dobles)} dobles`,
      feriado > 0 && `${formatearMinutos(feriado)} en feriado`,
    ]
      .filter(Boolean)
      .join(" · ") || "Nada aprobado todavía";
  const lista = [
    { etiqueta: "Horas ordinarias", valor: minutos(resumen?.minutos_ordinarios), icono: Clock },
    { etiqueta: "Horas nocturnas", valor: minutos(resumen?.minutos_nocturnos), icono: MoonStar },
    {
      etiqueta: "Extra marcadas en reloj",
      valor: minutos((resumen?.minutos_extra ?? 0) + (resumen?.minutos_anticipados ?? 0)),
      icono: Timer,
    },
    { etiqueta: "Jornadas por revisar", valor: resumen?.pendientes ?? 0, icono: Hourglass },
    {
      etiqueta: "Extra y feriados a pagar",
      valor: minutos(simples + (resumen?.minutos_extra_dobles ?? 0)),
      icono: CircleCheck,
      detalle: detallePago,
    },
  ];
  return (
    <section className="he-resumen" aria-labelledby="he-resumen-titulo">
      <h2 id="he-resumen-titulo" className="he-resumen__titulo">
        Resumen del periodo
      </h2>
      <dl className="he-indicadores" aria-busy={!resumen || undefined}>
        {lista.map(({ etiqueta, valor, icono: Icono, detalle }) => (
          <div key={etiqueta} className="he-indicador">
            <dt className="he-indicador__etiqueta">
              <Icono className="ds-icono" aria-hidden="true" />
              {etiqueta}
            </dt>
            <dd className="he-indicador__valor">{resumen ? valor : <Esqueleto ancho="60%" />}</dd>
            {detalle && resumen && <dd className="he-sutil he-indicador__detalle">{detalle}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

// Datos de una consulta con su clave: al cambiar los filtros se descarta la respuesta anterior.
function useConsulta(clave, consultar, intento) {
  const [resultado, setResultado] = useState({ clave: null });
  useEffect(() => {
    if (!clave) return undefined;
    let vigente = true;
    consultar()
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error }));
    return () => {
      vigente = false;
    };
    // `consultar` cambia con la clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, intento]);
  return resultado.clave === clave ? resultado : {};
}

// Horas ordinarias, nocturnas y extra del personal de una sucursal, para conciliar y enviar a planillas.
export default function HorasExtraPage() {
  const hoy = hoyBolivia();
  const [catalogos, setCatalogos] = useState(null);
  const [errorCatalogos, setErrorCatalogos] = useState(null);
  const [intentoCatalogos, setIntentoCatalogos] = useState(0);
  const [filtros, setFiltros] = useState(() => ({
    id_sucursal: leerSucursal(),
    id_departamento: "",
    desde: `${hoy.slice(0, 8)}01`,
    hasta: hoy,
  }));
  const [vista, setVista] = useState("PENDIENTE");
  const [intento, setIntento] = useState(0);
  const [consolidando, setConsolidando] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [errorCierre, setErrorCierre] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [autorizando, setAutorizando] = useState(false);
  const [anulando, setAnulando] = useState(null);
  const [procesandoAnulacion, setProcesandoAnulacion] = useState(false);
  const [errorAnulacion, setErrorAnulacion] = useState(null);
  const { revisor, verificando, identificar, cambiar } = useRevisor();
  const avisar = useAvisos();

  useEffect(() => {
    let vigente = true;
    Promise.all([listarSucursales(), listarAreas()])
      .then(([sucursales, areas]) => vigente && setCatalogos({ sucursales, areas }))
      .catch((error) => vigente && setErrorCatalogos(error.message));
    return () => {
      vigente = false;
    };
  }, [intentoCatalogos]);

  const erroresRango = validarRango(filtros);
  const sucursalValida =
    filtros.id_sucursal && (!catalogos || catalogos.sucursales.some((s) => s.id_sucursal === filtros.id_sucursal));
  const base =
    catalogos && sucursalValida && Object.keys(erroresRango).length === 0
      ? `${filtros.id_sucursal}|${filtros.id_departamento}|${filtros.desde}|${filtros.hasta}`
      : null;
  const consulta = {
    idSucursal: filtros.id_sucursal,
    idDepartamento: filtros.id_departamento,
    desde: filtros.desde,
    hasta: filtros.hasta,
  };

  // Todas las jornadas del rango: el resumen y la pestaña «Por revisar» salen de la misma consulta.
  const jornadas = useConsulta(base, () => listarHorasExtra(consulta), intento);
  const totales = useConsulta(vista === "TOTALES" ? base : null, () => resumenHorasExtra(consulta), intento);
  const periodos = useConsulta(vista === "TOTALES" ? "periodos" : null, listarPeriodos, intento);
  const claveAutorizaciones =
    vista === "AUTORIZACIONES" && catalogos && sucursalValida
      ? `${filtros.id_sucursal}|${filtros.id_departamento}`
      : null;
  const autorizaciones = useConsulta(
    claveAutorizaciones,
    () =>
      listarAutorizaciones(
        consulta.idSucursal ? { idSucursal: consulta.idSucursal, idDepartamento: consulta.idDepartamento } : {}
      ),
    intento
  );

  const errorDeCampo = (campo) => jornadas.error?.detalles?.find((d) => d.campo === campo)?.mensaje;
  const errorGeneral = jornadas.error ? (jornadas.error.detalles?.[0]?.mensaje ?? jornadas.error.message) : null;

  const cambiarFiltro = (campo) => (evento) => {
    const valor = evento.target.value;
    if (campo === "id_sucursal") guardarSucursal(valor);
    setFiltros((actual) => ({ ...actual, [campo]: valor }));
  };

  const actualizar = () => setIntento((n) => n + 1);

  const opcionesSucursal = useMemo(
    () => (catalogos?.sucursales ?? []).map((s) => ({ valor: s.id_sucursal, etiqueta: s.nombre })),
    [catalogos]
  );
  const opcionesArea = useMemo(
    () => (catalogos?.areas ?? []).map((a) => ({ valor: a.id_departamento, etiqueta: a.nombre })),
    [catalogos]
  );

  const pendientes = jornadas.datos?.resumen.pendientes ?? 0;
  const filasPorVista =
    vista === "PENDIENTE"
      ? jornadas.datos?.jornadas.filter((j) => j.estado.codigo === "PENDIENTE")
      : jornadas.datos?.jornadas;
  const ultimoPeriodo = periodos.datos?.[0];
  const periodoTerminado = filtros.hasta < hoy;

  // Tras decidir, el foco vuelve a la pestaña activa (la fila puede salir de «Por revisar»).
  const volverAPestana = () =>
    requestAnimationFrame(() => document.querySelector('.he-desglose [role="tab"][aria-selected="true"]')?.focus());

  const alRevisar = (revisada) => {
    setAbierta(null);
    const textos = {
      APROBADA: ["exito", "Horas extra aprobadas"],
      AJUSTADA: ["exito", "Horas extra aprobadas con ajuste"],
      RECHAZADA: ["info", "Horas extra rechazadas"],
    };
    const [tono, titulo] = textos[revisada.estado.codigo];
    avisar({
      tono,
      titulo,
      mensaje:
        revisada.estado.codigo === "RECHAZADA"
          ? `${revisada.empleado.nombre_completo}, ${formatearJornada(revisada.fecha_jornada)}: no se pagan horas extra.`
          : `${revisada.empleado.nombre_completo}, ${formatearJornada(revisada.fecha_jornada)}: ${formatearMinutos(revisada.minutos_extra_aprobados)} a pagar como extra.`,
    });
    actualizar();
    volverAPestana();
  };

  const alAutorizar = (autorizacion, colaborador) => {
    setAutorizando(false);
    avisar({
      tono: "exito",
      titulo: "Horas extra autorizadas",
      mensaje: `${colaborador?.nombre_completo ?? "El colaborador"} puede quedarse ${formatearMinutos(autorizacion.minutos_autorizados)} el ${formatearJornada(autorizacion.fecha_jornada)}.`,
    });
    actualizar();
  };

  const anular = async () => {
    setProcesandoAnulacion(true);
    setErrorAnulacion(null);
    try {
      await anularAutorizacion(anulando.id_autorizacion, revisor.id);
      setAnulando(null);
      avisar({
        tono: "info",
        titulo: "Autorización anulada",
        mensaje: "Si la jornada ya cerró, sus horas extra vuelven a quedar por revisar.",
      });
      actualizar();
      volverAPestana();
    } catch (error) {
      setErrorAnulacion(error.message);
    } finally {
      setProcesandoAnulacion(false);
    }
  };

  const consolidar = async () => {
    setConsolidando(true);
    setErrorCierre(null);
    try {
      const periodo = await consolidarPeriodo(revisor.id, { desde: filtros.desde, hasta: filtros.hasta });
      setConfirmarCierre(false);
      avisar({
        tono: "exito",
        titulo: "Periodo consolidado",
        mensaje: `${periodo.cantidad_jornadas} jornadas del ${formatearFechaLarga(periodo.fecha_inicio)} al ${formatearFechaLarga(periodo.fecha_fin)} se enviaron a planillas.`,
      });
      actualizar();
    } catch (error) {
      setErrorCierre(error.detalles?.[0]?.mensaje ?? error.message);
    } finally {
      setConsolidando(false);
    }
  };

  const tablaJornadas = errorGeneral ? (
    <Alerta
      tono="peligro"
      role="alert"
      titulo="No se pudieron cargar las jornadas"
      acciones={
        <Boton tamano="sm" onClick={actualizar}>
          Reintentar
        </Boton>
      }
    >
      {errorGeneral}
    </Alerta>
  ) : (
    <Tabla
      className="he-tabla"
      columnas={columnasJornadas(accionRevisar(setAbierta))}
      filas={filasPorVista ?? []}
      claveFila="id_horas_jornada"
      descripcion={vista === "PENDIENTE" ? "Jornadas con horas extra por revisar" : "Jornadas del periodo"}
      cargando={!jornadas.datos && !jornadas.error}
      vacio={
        <EstadoVacio
          icono={Timer}
          titulo={vista === "PENDIENTE" ? "No hay horas extra por revisar" : "No hay jornadas cerradas en el periodo"}
          mensaje={
            vista === "PENDIENTE"
              ? "Las jornadas con tiempo fuera del turno aparecerán aquí cuando el colaborador marque su salida."
              : "Pruebe con otro rango de fechas, área o sucursal."
          }
        />
      }
    />
  );

  const tablaTotales = totales.error ? (
    <Alerta
      tono="peligro"
      role="alert"
      titulo="No se pudieron cargar los totales"
      acciones={
        <Boton tamano="sm" onClick={actualizar}>
          Reintentar
        </Boton>
      }
    >
      {totales.error.message}
    </Alerta>
  ) : (
    <div className="he-totales">
      <div className="he-totales__acciones">
        <Boton icono={Download} href={urlResumenCsv(consulta)} download>
          Descargar CSV
        </Boton>
        <Boton
          variante="primario"
          icono={Lock}
          onClick={() => {
            setErrorCierre(null);
            setConfirmarCierre(true);
          }}
          disabled={!revisor || !periodoTerminado}
        >
          Consolidar periodo
        </Boton>
      </div>
      <p className="he-sutil he-totales__nota">
        {!periodoTerminado
          ? "Para consolidar, elija un periodo que termine ayer o antes."
          : !revisor
            ? "Identifíquese como responsable para consolidar."
            : "Consolidar cierra el periodo para toda la empresa y lo envía a planillas."}
        {ultimoPeriodo &&
          ` Último periodo consolidado: del ${formatearFechaLarga(ultimoPeriodo.fecha_inicio)} al ${formatearFechaLarga(ultimoPeriodo.fecha_fin)}.`}
      </p>
      <Tabla
        className="he-tabla"
        columnas={columnasTotales}
        filas={(totales.datos?.empleados ?? []).map((t) => ({ ...t, id_empleado: t.empleado.id_empleado }))}
        claveFila="id_empleado"
        descripcion="Totales por colaborador"
        cargando={!totales.datos}
        vacio={
          <EstadoVacio icono={Timer} titulo="Sin jornadas en el periodo" mensaje="Pruebe con otro rango de fechas." />
        }
      />
    </div>
  );

  const tablaAutorizaciones = autorizaciones.error ? (
    <Alerta
      tono="peligro"
      role="alert"
      titulo="No se pudieron cargar las autorizaciones"
      acciones={
        <Boton tamano="sm" onClick={actualizar}>
          Reintentar
        </Boton>
      }
    >
      {autorizaciones.error.message}
    </Alerta>
  ) : (
    <div className="he-totales">
      <p className="he-sutil he-totales__nota">
        Autorizaciones de hoy en adelante. Al cerrar la jornada se aprueban solas hasta lo autorizado.
      </p>
      <Tabla
        className="he-tabla"
        columnas={columnasAutorizaciones((a) => {
          setErrorAnulacion(null);
          setAnulando(a);
        }, hoy)}
        filas={autorizaciones.datos?.autorizaciones ?? []}
        claveFila="id_autorizacion"
        descripcion="Autorizaciones previas de horas extra"
        cargando={!autorizaciones.datos}
        vacio={
          <EstadoVacio
            icono={ShieldCheck}
            titulo="No hay horas extra autorizadas"
            mensaje="Autorice antes del día a quien deba quedarse más tiempo."
            accion={
              revisor && (
                <Boton icono={ShieldCheck} onClick={() => setAutorizando(true)}>
                  Autorizar horas extra
                </Boton>
              )
            }
          />
        }
      />
    </div>
  );

  const contenidoDe = { TOTALES: tablaTotales, AUTORIZACIONES: tablaAutorizaciones };

  return (
    <section className="he-pagina" aria-labelledby="he-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Asistencia" }]}
        enlace={Link}
        titulo="Horas extra"
        idTitulo="he-titulo"
        descripcion="Horas ordinarias, recargo nocturno (20:00 a 06:00) y horas extra de cada jornada, para conciliar y enviar a planillas."
        acciones={
          sucursalValida &&
          catalogos && (
            <>
              <Boton icono={ShieldCheck} onClick={() => setAutorizando(true)} disabled={!revisor}>
                Autorizar horas extra
              </Boton>
              <Boton icono={RefreshCw} onClick={actualizar}>
                Actualizar
              </Boton>
            </>
          )
        }
      />

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

      <div className="he-superior">
        <Tarjeta className="he-filtros" nivelTitulo={2} titulo="Periodo y personal">
          {!catalogos && !errorCatalogos ? (
            <div className="he-filtros__campos" aria-busy="true">
              <Esqueleto forma="bloque" />
              <Esqueleto forma="bloque" />
            </div>
          ) : (
            <div className="he-filtros__campos">
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
                type="date"
                etiqueta="Desde"
                value={filtros.desde}
                max={filtros.hasta || hoy}
                onChange={cambiarFiltro("desde")}
                error={erroresRango.desde ?? errorDeCampo("desde")}
              />
              <CampoTexto
                type="date"
                etiqueta="Hasta"
                value={filtros.hasta}
                max={hoy}
                onChange={cambiarFiltro("hasta")}
                error={erroresRango.hasta ?? errorDeCampo("hasta")}
              />
            </div>
          )}
          {!verificando && revisor && <Revisor revisor={revisor} etiqueta="Responsable" onCambiar={cambiar} />}
        </Tarjeta>
        {!verificando && !revisor && <Revisor onIdentificado={identificar} />}
      </div>

      {!sucursalValida && catalogos && (
        <EstadoVacio
          titulo="Elija la sucursal"
          mensaje="Se mostrarán las jornadas cerradas de su personal con sus horas ordinarias, nocturnas y extra."
        />
      )}

      {base && <Indicadores resumen={jornadas.datos?.resumen} />}

      {base && (
        <Tarjeta className="he-desglose" nivelTitulo={2} titulo="Desglose de jornadas">
          <Pestanas
            etiqueta="Vista del desglose"
            activa={vista}
            onCambiar={setVista}
            pestanas={PESTANAS.map((p) => ({
              id: p.id,
              etiqueta: p.etiqueta,
              contador: p.id === "PENDIENTE" && jornadas.datos ? pendientes : undefined,
              contenido: contenidoDe[p.id] ?? tablaJornadas,
            }))}
          />
        </Tarjeta>
      )}

      {abierta && (
        <RevisionHorasExtra
          key={abierta.id_horas_jornada}
          jornada={abierta}
          revisor={revisor}
          onCerrar={() => setAbierta(null)}
          onRevisada={alRevisar}
        />
      )}

      {autorizando && (
        <AutorizacionHorasExtra
          abierto
          sucursal={
            sucursalValida ? { idSucursal: filtros.id_sucursal, idDepartamento: filtros.id_departamento } : null
          }
          revisor={revisor}
          onCerrar={() => setAutorizando(false)}
          onAutorizada={alAutorizar}
        />
      )}

      <ModalConfirmacion
        abierto={Boolean(anulando)}
        titulo="Anular autorización"
        textoConfirmar="Anular"
        procesando={procesandoAnulacion}
        onConfirmar={anular}
        onCancelar={() => setAnulando(null)}
      >
        {anulando && (
          <p>
            {anulando.empleado.nombre_completo} ya no tendrá autorizadas{" "}
            {formatearMinutos(anulando.minutos_autorizados)} extra el {formatearJornada(anulando.fecha_jornada)}. Lo que
            marque fuera del turno quedará para revisar.
          </p>
        )}
        {errorAnulacion && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo anular">
            {errorAnulacion}
          </Alerta>
        )}
      </ModalConfirmacion>

      <ModalConfirmacion
        abierto={confirmarCierre}
        titulo="Consolidar periodo"
        textoConfirmar="Consolidar"
        variante="primario"
        procesando={consolidando}
        onConfirmar={consolidar}
        onCancelar={() => setConfirmarCierre(false)}
      >
        <p>
          Se cerrarán las jornadas de <strong>toda la empresa</strong> del {formatearFechaLarga(filtros.desde)} al{" "}
          {formatearFechaLarga(filtros.hasta)} y sus totales se enviarán a planillas. Después no se podrán revisar.
        </p>
        {pendientes > 0 && (
          <p>En esta sucursal quedan {pendientes} jornadas por revisar: revíselas antes de consolidar.</p>
        )}
        {errorCierre && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo consolidar">
            {errorCierre}
          </Alerta>
        )}
      </ModalConfirmacion>
    </section>
  );
}

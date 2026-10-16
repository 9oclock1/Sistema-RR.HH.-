import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { FileCheck, Paperclip, RefreshCw, UserRoundCheck } from "lucide-react";
import { listarJustificaciones } from "../../api/justificaciones";
import { consultarJornada } from "../../api/marcajes";
import { listarAreas, listarSucursales } from "../../api/rolesTurno";
import {
  Alerta,
  Boton,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Pestanas,
  Selector,
  Tabla,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import IdentificacionEmpleado from "../marcaje/IdentificacionEmpleado";
import { guardarEmpleado, leerEmpleado, olvidarEmpleado } from "../marcaje/sesionEmpleado";
import DetalleJustificacion from "./DetalleJustificacion";
import { ESTADOS_SOLICITUD, describirNovedad, formatearFechaHora, formatearJornada, formatearMinutos } from "./formato";
import "../marcaje/marcaje.css";
import "./justificaciones.css";

const CLAVE_SUCURSAL = "rrhh.justificaciones.sucursal";
const TONO_TIPO = { ATRASO: "aviso", SALIDA_ANTICIPADA: "aviso", INASISTENCIA: "peligro" };
const PESTANAS = [
  { id: "PENDIENTE", etiqueta: "Pendientes", campo: "pendientes" },
  { id: "APROBADA", etiqueta: "Aprobadas", campo: "aprobadas" },
  { id: "RECHAZADA", etiqueta: "Rechazadas", campo: "rechazadas" },
  { id: "TODAS", etiqueta: "Todas" },
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

const columnas = (onAbrir) => [
  {
    clave: "colaborador",
    titulo: "Colaborador",
    ancho: "22%",
    celda: (s) => (
      <div className="jf-celda">
        <span className="jf-celda__principal">{s.empleado.nombre_completo}</span>
        {s.empleado.cargo && <span className="jf-sutil">{s.empleado.cargo}</span>}
      </div>
    ),
  },
  {
    clave: "novedad",
    titulo: "Novedad",
    ancho: "24%",
    celda: (s) => (
      <div className="jf-celda">
        <span className="jf-celda__principal">
          <Etiqueta tono={TONO_TIPO[s.novedad.tipo.codigo] ?? "neutral"}>{s.novedad.tipo.nombre}</Etiqueta>{" "}
          {formatearJornada(s.novedad.fecha_jornada)}
        </span>
        <span className="jf-sutil">{describirNovedad(s.novedad)}</span>
      </div>
    ),
  },
  {
    clave: "motivo",
    titulo: "Motivo",
    ancho: "16%",
    celda: (s) => (
      <div className="jf-celda">
        <span>{s.motivo.nombre}</span>
        <span className="jf-sutil">
          <Paperclip className="ds-icono jf-icono-sutil" aria-hidden="true" />
          {s.adjuntos.length === 1 ? "1 comprobante" : `${s.adjuntos.length} comprobantes`}
        </span>
      </div>
    ),
  },
  { clave: "presentada", titulo: "Presentada", ancho: "12%", celda: (s) => formatearFechaHora(s.creado_en) },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "14%",
    celda: (s) => {
      const estado = ESTADOS_SOLICITUD[s.estado.codigo];
      return (
        <Etiqueta tono={estado.tono} icono={estado.icono}>
          {estado.texto}
        </Etiqueta>
      );
    },
  },
  {
    clave: "accion",
    titulo: <span className="ds-solo-lector">Acción</span>,
    ancho: "12%",
    alinear: "fin",
    celda: (s) => (
      <Boton
        tamano="sm"
        variante={s.estado.codigo === "PENDIENTE" ? "primario" : "predeterminado"}
        onClick={() => onAbrir(s.id_solicitud)}
        aria-label={`${s.estado.codigo === "PENDIENTE" ? "Revisar" : "Ver"} el justificativo de ${s.empleado.nombre_completo}`}
      >
        {s.estado.codigo === "PENDIENTE" ? "Revisar" : "Ver"}
      </Boton>
    ),
  },
];

function Revisor({ revisor, onIdentificado, onCambiar }) {
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);

  if (revisor) {
    return (
      <p className="jf-revisor">
        <UserRoundCheck className="ds-icono" aria-hidden="true" />
        <span>
          Revisa: <strong>{revisor.nombre}</strong>
        </span>
        <Boton variante="sutil" tamano="sm" onClick={onCambiar}>
          Cambiar
        </Boton>
      </p>
    );
  }

  const identificar = (id) => {
    setProcesando(true);
    setError(null);
    consultarJornada(id)
      .then(({ empleado }) => {
        guardarEmpleado(id);
        onIdentificado({ id, nombre: `${empleado.nombres} ${empleado.apellidos}`.trim() });
      })
      .catch((e) => setError(e.message))
      .finally(() => setProcesando(false));
  };

  return <IdentificacionEmpleado error={error} procesando={procesando} onIdentificar={identificar} onEditar={() => setError(null)} />;
}

// Bandeja de la jefatura o RRHH: justificativos del personal de una sucursal, para aprobar o rechazar.
export default function BandejaJustificacionesPage() {
  const [catalogos, setCatalogos] = useState(null);
  const [errorCatalogos, setErrorCatalogos] = useState(null);
  const [intentoCatalogos, setIntentoCatalogos] = useState(0);
  const [filtros, setFiltros] = useState(() => ({ id_sucursal: leerSucursal(), id_departamento: "" }));
  const [estado, setEstado] = useState("PENDIENTE");
  const [resultado, setResultado] = useState({ clave: null });
  const [intento, setIntento] = useState(0);
  const [abierta, setAbierta] = useState(null);
  // Contadores de las pestañas: se conservan mientras carga otra pestaña.
  const [resumen, setResumen] = useState(null);
  const [revisor, setRevisor] = useState(null);
  const [verificandoRevisor, setVerificandoRevisor] = useState(() => Boolean(leerEmpleado()));
  const avisar = useAvisos();
  // Tras decidir, la fila puede salir de la pestaña: el foco vuelve a la pestaña activa cuando la lista se actualiza.
  const volverAPestana = useRef(false);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarSucursales(), listarAreas()])
      .then(([sucursales, areas]) => vigente && setCatalogos({ sucursales, areas }))
      .catch((error) => vigente && setErrorCatalogos(error.message));
    return () => {
      vigente = false;
    };
  }, [intentoCatalogos]);

  // El revisor que ya se identificó en este navegador se verifica de nuevo al entrar.
  useEffect(() => {
    const id = leerEmpleado();
    if (!id) return;
    consultarJornada(id)
      .then(({ empleado }) => setRevisor({ id, nombre: `${empleado.nombres} ${empleado.apellidos}`.trim() }))
      .catch(() => olvidarEmpleado())
      .finally(() => setVerificandoRevisor(false));
  }, []);

  const sucursalValida =
    filtros.id_sucursal && (!catalogos || catalogos.sucursales.some((s) => s.id_sucursal === filtros.id_sucursal));
  const clave = catalogos && sucursalValida ? `${filtros.id_sucursal}|${filtros.id_departamento}|${estado}` : null;

  useEffect(() => {
    if (!clave) return undefined;
    let vigente = true;
    const [idSucursal, idDepartamento, estadoPedido] = clave.split("|");
    listarJustificaciones({ idSucursal, idDepartamento, estado: estadoPedido })
      .then((datos) => {
        if (!vigente) return;
        setResultado({ clave, datos });
        setResumen(datos.resumen);
      })
      .catch((error) => vigente && setResultado({ clave, error: error.message }));
    return () => {
      vigente = false;
    };
  }, [clave, intento]);

  const vista = resultado.clave === clave ? resultado : {};

  useEffect(() => {
    if (!volverAPestana.current || !resultado.datos) return;
    volverAPestana.current = false;
    document.querySelector('.jf-bandeja [role="tab"][aria-selected="true"]')?.focus();
  }, [resultado]);

  const cambiarFiltro = (campo) => (evento) => {
    const valor = evento.target.value;
    if (campo === "id_sucursal") guardarSucursal(valor);
    setFiltros((actual) => ({ ...actual, [campo]: valor }));
  };

  const actualizar = () => setIntento((n) => n + 1);

  const cambiarRevisor = () => {
    olvidarEmpleado();
    setRevisor(null);
  };

  const alRevisar = (revisada) => {
    setAbierta(null);
    const aprobada = revisada.estado.codigo === "APROBADA";
    const { jornada } = revisada;
    avisar({
      tono: aprobada ? "exito" : "info",
      titulo: aprobada ? "Justificativo aprobado" : "Justificativo rechazado",
      mensaje: aprobada
        ? `Se quitó la penalización: la jornada queda con ${formatearMinutos(jornada.minutos_efectivos)} efectivas.` +
          (jornada.recalculo_enviado ? " Se envió el recálculo a compensaciones." : "")
        : `${revisada.empleado?.nombre_completo ?? "El colaborador"} verá el motivo del rechazo.`,
    });
    volverAPestana.current = true;
    actualizar();
  };

  const opcionesSucursal = useMemo(
    () => (catalogos?.sucursales ?? []).map((s) => ({ valor: s.id_sucursal, etiqueta: s.nombre })),
    [catalogos]
  );
  const opcionesArea = useMemo(
    () => (catalogos?.areas ?? []).map((a) => ({ valor: a.id_departamento, etiqueta: a.nombre })),
    [catalogos]
  );
  const definicionColumnas = useMemo(() => columnas(setAbierta), []);

  const tabla = vista.error ? (
    <Alerta
      tono="peligro"
      role="alert"
      titulo="No se pudieron cargar las solicitudes"
      acciones={
        <Boton tamano="sm" onClick={actualizar}>
          Reintentar
        </Boton>
      }
    >
      {vista.error}
    </Alerta>
  ) : (
    <Tabla
      columnas={definicionColumnas}
      filas={vista.datos?.solicitudes ?? []}
      claveFila="id_solicitud"
      descripcion="Solicitudes de justificación"
      cargando={!vista.datos}
      vacio={
        <EstadoVacio
          icono={FileCheck}
          titulo={estado === "PENDIENTE" ? "No hay justificativos por revisar" : "No hay solicitudes en esta vista"}
          mensaje={
            estado === "PENDIENTE"
              ? "Cuando el personal presente un justificativo, aparecerá aquí."
              : "Pruebe con otra pestaña, área o sucursal."
          }
        />
      }
    />
  );

  return (
    <section className="jf-bandeja" aria-labelledby="jf-bandeja-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Asistencia" }]}
        enlace={Link}
        titulo="Justificaciones"
        idTitulo="jf-bandeja-titulo"
        descripcion="Justificativos de atrasos, faltas y salidas anticipadas presentados por el personal."
        acciones={
          clave && (
            <Boton icono={RefreshCw} onClick={actualizar}>
              Actualizar
            </Boton>
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

      <div className="jf-bandeja__superior">
        <Tarjeta className="jf-filtros" nivelTitulo={2} titulo="Solicitudes a revisar">
          {!catalogos && !errorCatalogos ? (
            <div className="jf-filtros__campos" aria-busy="true">
              <Esqueleto forma="bloque" />
              <Esqueleto forma="bloque" />
            </div>
          ) : (
            <div className="jf-filtros__campos">
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
            </div>
          )}
          {!verificandoRevisor && revisor && <Revisor revisor={revisor} onCambiar={cambiarRevisor} />}
        </Tarjeta>
        {!verificandoRevisor && !revisor && <Revisor onIdentificado={setRevisor} />}
      </div>

      {!clave && catalogos && (
        <EstadoVacio
          titulo="Elija la sucursal"
          mensaje="Se mostrarán los justificativos que presentó su personal, empezando por los pendientes más antiguos."
        />
      )}

      {clave && (
        <Tarjeta className="jf-tabla" nivelTitulo={2} titulo="Solicitudes">
          <Pestanas
            etiqueta="Estado de las solicitudes"
            activa={estado}
            onCambiar={setEstado}
            pestanas={PESTANAS.map((p) => ({
              id: p.id,
              etiqueta: p.etiqueta,
              contador: p.campo && resumen ? resumen[p.campo] : undefined,
              contenido: tabla,
            }))}
          />
        </Tarjeta>
      )}

      <DetalleJustificacion
        idSolicitud={abierta}
        revisor={revisor}
        onCerrar={() => setAbierta(null)}
        onRevisada={alRevisar}
      />
    </section>
  );
}

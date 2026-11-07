import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { listarAprobaciones } from "../../api/aprobaciones";
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
import { useRol } from "../../context/sesion";
import { ESTADOS_SOLICITUD } from "../justificaciones/formato";
import Revisor from "../marcaje/Revisor";
import useRevisor from "../marcaje/useRevisor";
import { formatearPeriodo } from "../solicitud-vacaciones/formato";
import DetalleAprobacion from "./DetalleAprobacion";
import { CATEGORIAS, PRIORIDADES, describirDias } from "./formato";
import "../marcaje/marcaje.css";
import "../justificaciones/justificaciones.css";
import "./aprobaciones.css";

const CLAVE_SUCURSAL = "rrhh.aprobaciones.sucursal";
const PESTANAS = [
  { id: "PENDIENTE", etiqueta: "Pendientes", campo: "pendientes" },
  { id: "APROBADA", etiqueta: "Aprobadas", campo: "aprobadas" },
  { id: "RECHAZADA", etiqueta: "Rechazadas", campo: "rechazadas" },
  { id: "TODAS", etiqueta: "Todas" },
];
const OPCIONES_CATEGORIA = Object.entries(CATEGORIAS).map(([valor, { texto }]) => ({ valor, etiqueta: texto }));
const OPCIONES_PRIORIDAD = Object.entries(PRIORIDADES).map(([valor, { texto }]) => ({ valor, etiqueta: texto }));

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
    clave: "solicitud",
    titulo: "Solicitud",
    ancho: "26%",
    celda: (s) => {
      const categoria = CATEGORIAS[s.categoria];
      return (
        <div className="jf-celda">
          <span className="jf-celda__principal">
            <Etiqueta tono={s.categoria === "VACACIONES" ? "info" : "morado"} icono={categoria.icono}>
              {s.categoria === "VACACIONES" ? "Vacaciones" : s.tipo}
            </Etiqueta>
          </span>
          <span className="jf-sutil">
            {formatearPeriodo(s.fecha_inicio, s.fecha_fin)} · {describirDias(s.dias, s.dias_tipo)}
          </span>
        </div>
      );
    },
  },
  {
    clave: "prioridad",
    titulo: "Prioridad",
    ancho: "12%",
    celda: (s) => {
      if (!s.prioridad) return <span className="jf-sutil">—</span>;
      const prioridad = PRIORIDADES[s.prioridad];
      return (
        <div className="jf-celda">
          <Etiqueta tono={prioridad.tono} title={prioridad.ayuda}>
            {prioridad.texto}
          </Etiqueta>
          {s.requiere_rrhh && <span className="jf-sutil">Requiere RRHH</span>}
        </div>
      );
    },
  },
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
    celda: (s) => {
      const pendiente = s.estado.codigo === "PENDIENTE";
      return (
        <Boton
          tamano="sm"
          variante={pendiente ? "primario" : "predeterminado"}
          onClick={() => onAbrir(s)}
          aria-label={`${pendiente ? "Revisar" : "Ver"} la solicitud de ${s.empleado.nombre_completo}`}
        >
          {pendiente ? "Revisar" : "Ver"}
        </Boton>
      );
    },
  },
];

// Bandeja del supervisor o RRHH: vacaciones y licencias del personal de una sucursal, para aprobar o rechazar.
export default function BandejaAprobacionesPage() {
  const rol = useRol();
  const [catalogos, setCatalogos] = useState(null);
  const [errorCatalogos, setErrorCatalogos] = useState(null);
  const [intentoCatalogos, setIntentoCatalogos] = useState(0);
  const [filtros, setFiltros] = useState(() => ({
    id_sucursal: leerSucursal(),
    id_departamento: "",
    categoria: "",
    prioridad: "",
  }));
  const [estado, setEstado] = useState("PENDIENTE");
  const [resultado, setResultado] = useState({ clave: null });
  const [intento, setIntento] = useState(0);
  const [abierta, setAbierta] = useState(null);
  // Contadores de las pestañas: se conservan mientras carga otra pestaña.
  const [resumen, setResumen] = useState(null);
  const { revisor, verificando: verificandoRevisor, identificar: setRevisor, cambiar: cambiarRevisor } = useRevisor();
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

  const sucursalValida =
    filtros.id_sucursal && (!catalogos || catalogos.sucursales.some((s) => s.id_sucursal === filtros.id_sucursal));
  const clave =
    catalogos && sucursalValida
      ? [filtros.id_sucursal, filtros.id_departamento, filtros.categoria, filtros.prioridad, estado, rol].join("|")
      : null;

  useEffect(() => {
    if (!clave) return undefined;
    let vigente = true;
    const [idSucursal, idDepartamento, categoria, prioridad, estadoPedido, rolPedido] = clave.split("|");
    listarAprobaciones(rolPedido, { idSucursal, idDepartamento, categoria, prioridad, estado: estadoPedido })
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
    document.querySelector('.ap-bandeja [role="tab"][aria-selected="true"]')?.focus();
  }, [resultado]);

  const cambiarFiltro = (campo) => (evento) => {
    const valor = evento.target.value;
    if (campo === "id_sucursal") guardarSucursal(valor);
    setFiltros((actual) => ({ ...actual, [campo]: valor }));
  };

  const actualizar = () => setIntento((n) => n + 1);

  const alResolver = (resuelta, decision, solicitud) => {
    setAbierta(null);
    const aprobada = decision === "APROBADA";
    const nombre = solicitud?.empleado.nombre_completo ?? "El colaborador";
    avisar({
      tono: aprobada ? "exito" : "info",
      titulo: aprobada ? "Solicitud aprobada" : "Solicitud rechazada",
      mensaje: aprobada
        ? `${nombre} ya figura como no disponible en esas fechas.` +
          (solicitud?.categoria === "VACACIONES" ? " Sus días se debitaron del saldo." : "") +
          (resuelta.notificacion_enviada ? " Se le avisó." : " El aviso se reintentará automáticamente.")
        : `${nombre} verá el motivo del rechazo y se liberaron los días retenidos.` +
          (resuelta.notificacion_enviada ? "" : " El aviso se reintentará automáticamente."),
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
      descripcion="Solicitudes de vacaciones y licencias"
      cargando={!vista.datos}
      vacio={
        <EstadoVacio
          icono={ClipboardCheck}
          titulo={estado === "PENDIENTE" ? "No hay solicitudes por revisar" : "No hay solicitudes en esta vista"}
          mensaje={
            estado === "PENDIENTE"
              ? "Cuando el personal pida vacaciones o una licencia, aparecerá aquí."
              : "Pruebe con otra pestaña, filtro, área o sucursal."
          }
        />
      }
    />
  );

  return (
    <section className="ap-bandeja jf-bandeja" aria-labelledby="ap-bandeja-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Asistencia" }]}
        enlace={Link}
        titulo="Aprobaciones"
        idTitulo="ap-bandeja-titulo"
        descripcion="Solicitudes de vacaciones, permisos y licencias del personal, con su prioridad e impacto en la cobertura."
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
            <div className="jf-filtros__campos ap-filtros">
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
              <Selector
                etiqueta="Tipo"
                value={filtros.categoria}
                onChange={cambiarFiltro("categoria")}
                opciones={OPCIONES_CATEGORIA}
                textoVacio="Vacaciones y licencias"
              />
              <Selector
                etiqueta="Prioridad"
                value={filtros.prioridad}
                onChange={cambiarFiltro("prioridad")}
                opciones={OPCIONES_PRIORIDAD}
                textoVacio="Todas"
                ayuda="Solo aplica a las pendientes."
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
          mensaje="Se mostrarán las solicitudes de su personal, con las más urgentes primero."
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

      <DetalleAprobacion
        abierta={abierta}
        rol={rol}
        resolutor={revisor}
        onCerrar={() => setAbierta(null)}
        onResuelta={alResolver}
      />
    </section>
  );
}

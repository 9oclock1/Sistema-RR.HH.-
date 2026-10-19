import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { CalendarPlus, ChevronLeft, ChevronRight, Send, Trash2, UsersRound } from "lucide-react";
import {
  crearRol,
  eliminarRol,
  listarAreas,
  listarRoles,
  listarSucursales,
  listarTurnosActivos,
  obtenerRol,
  publicarRol,
} from "../../api/rolesTurno";
import {
  Alerta,
  Boton,
  CampoTexto,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  ModalConfirmacion,
  Selector,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import MatrizRol from "./MatrizRol";
import useEdicionRol from "./useEdicionRol";
import { describirPeriodo, formatearFechaHora, hoyEnBolivia } from "./formato";
import "./rolTurnos.css";

const PERIODOS = [
  { valor: "SEMANAL", etiqueta: "Semanal" },
  { valor: "MENSUAL", etiqueta: "Mensual" },
];

const TOPICOS = {
  "produccion-logistica": "Producción y Logística",
  "entregas-despachos": "Entregas y Despachos",
};

const TONO_EVENTO = { PENDIENTE: "aviso", ENTREGADO: "exito", FALLIDO: "peligro" };

function moverFecha(fecha, periodo, pasos) {
  const dia = new Date(`${fecha}T00:00:00Z`);
  if (periodo === "MENSUAL") dia.setUTCMonth(dia.getUTCMonth() + pasos, 1);
  else dia.setUTCDate(dia.getUTCDate() + 7 * pasos);
  return dia.toISOString().slice(0, 10);
}

function EstadoRol({ rol, guardado }) {
  const publicado = rol.version_publicada > 0;
  const conCambios = publicado && (rol.tiene_cambios_sin_publicar || guardado.pendientes > 0);
  return (
    <div className="rt-estado">
      {!publicado && <Etiqueta tono="neutral">Borrador</Etiqueta>}
      {publicado && !conCambios && <Etiqueta tono="exito">Publicado</Etiqueta>}
      {conCambios && <Etiqueta tono="aviso">Cambios sin publicar</Etiqueta>}
      <span className="rt-estado__guardado" role="status">
        {guardado.estado === "guardando" && "Guardando…"}
        {guardado.estado === "pendiente" && "Cambios por guardar…"}
        {guardado.estado === "guardado" && "Todo guardado"}
        {guardado.estado === "error" && "No se guardaron los últimos cambios"}
      </span>
    </div>
  );
}

function EditorRol({ rol, paleta, onActualizar, onEliminado }) {
  const avisar = useAvisos();
  const edicion = useEdicionRol(rol, onActualizar);
  const [confirmandoPublicar, setConfirmandoPublicar] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [observaciones, setObservaciones] = useState(null);
  const refObservaciones = useRef(null);

  const vigentes = rol.empleados.filter((e) => e.vigente).length;
  const ocupado = edicion.estado !== "guardado";
  const sinCambios = rol.version_publicada > 0 && !rol.tiene_cambios_sin_publicar && edicion.pendientes === 0;

  useEffect(() => {
    if (observaciones) refObservaciones.current?.focus();
  }, [observaciones]);

  const pedirPublicacion = () => {
    const detalles = [];
    if (rol.celdas_vacias > 0) {
      detalles.push(`Faltan ${rol.celdas_vacias} celda(s) por completar: cada colaborador necesita un turno o un descanso por día.`);
    }
    if (rol.alertas.length > 0) {
      detalles.push(`Hay ${rol.alertas.length} alerta(s) de descanso o superposición por corregir.`);
    }
    if (detalles.length > 0) {
      setObservaciones({ titulo: "Todavía no se puede publicar", detalles });
      return;
    }
    setObservaciones(null);
    setConfirmandoPublicar(true);
  };

  const publicar = async () => {
    setProcesando(true);
    try {
      const publicado = await publicarRol(rol.id_rol);
      onActualizar(publicado);
      const nuevos = publicado.eventos.filter((e) => !rol.eventos.some((previo) => previo.id_evento === e.id_evento));
      const destinos = [...new Set(nuevos.map((e) => TOPICOS[e.topico] ?? e.topico))];
      avisar({
        tono: "exito",
        titulo: `Rol publicado (versión ${publicado.version_publicada})`,
        mensaje: destinos.length
          ? `Los colaboradores ya ven sus turnos. Se avisó a ${destinos.join(" y ")}.`
          : "Los colaboradores ya ven sus turnos en su portal.",
      });
    } catch (error) {
      setObservaciones({ titulo: error.message, detalles: (error.detalles ?? []).map((d) => d.mensaje) });
    } finally {
      setProcesando(false);
      setConfirmandoPublicar(false);
    }
  };

  const eliminar = async () => {
    setProcesando(true);
    try {
      await eliminarRol(rol.id_rol);
      avisar({ tono: "exito", titulo: "Borrador eliminado", mensaje: describirPeriodo(rol) });
      onEliminado();
    } catch (error) {
      setObservaciones({ titulo: "No se pudo eliminar el borrador", detalles: [error.message] });
      setConfirmandoEliminar(false);
    } finally {
      setProcesando(false);
    }
  };

  const irACelda = (alerta) => {
    const celda = document.querySelector(`[data-celda="${alerta.id_empleado}|${alerta.fecha}"]`);
    celda?.scrollIntoView({ block: "nearest", inline: "center" });
    celda?.focus();
  };

  const nombreDe = (idEmpleado) => rol.empleados.find((e) => e.id_empleado === idEmpleado)?.nombre_completo ?? "Colaborador";

  return (
    <Tarjeta
      className="rt-rol"
      nivelTitulo={2}
      titulo={`Rol ${rol.periodo.nombre.toLowerCase()} · ${describirPeriodo(rol)}`}
      acciones={
        <>
          {rol.version_publicada === 0 && (
            <Boton variante="sutil" icono={Trash2} onClick={() => setConfirmandoEliminar(true)}>
              Eliminar borrador
            </Boton>
          )}
          <Boton
            variante="primario"
            icono={Send}
            onClick={pedirPublicacion}
            disabled={ocupado || sinCambios || vigentes === 0}
            aria-describedby="rt-estado-publicacion"
          >
            {rol.version_publicada > 0 ? "Publicar cambios" : "Publicar rol"}
          </Boton>
        </>
      }
    >
      <div id="rt-estado-publicacion" className="rt-rol__meta">
        <EstadoRol rol={rol} guardado={edicion} />
        <span className="rt-rol__lugar">
          {rol.sucursal.nombre} · {rol.area.nombre} · {vigentes} colaborador(es)
        </span>
        {rol.publicado_en && (
          <span className="rt-rol__publicado">
            Versión {rol.version_publicada} publicada el {formatearFechaHora(rol.publicado_en)}
          </span>
        )}
      </div>

      {rol.eventos.length > 0 && (
        <ul className="rt-eventos" aria-label="Avisos a otros módulos">
          {Object.keys(TOPICOS)
            .map((topico) => rol.eventos.find((e) => e.topico === topico))
            .filter(Boolean)
            .map((evento) => (
              <li key={evento.id_evento}>
                {TOPICOS[evento.topico]}:{" "}
                <Etiqueta tono={TONO_EVENTO[evento.estado.codigo]}>{evento.estado.nombre}</Etiqueta>
                {evento.ultimo_error && evento.estado.codigo !== "ENTREGADO" && (
                  <span className="rt-eventos__error"> ({evento.ultimo_error}; se reintentará)</span>
                )}
              </li>
            ))}
        </ul>
      )}

      {edicion.estado === "error" && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron guardar los últimos cambios"
          acciones={
            <>
              <Boton tamano="sm" onClick={edicion.reintentar}>
                Reintentar
              </Boton>
              <Boton tamano="sm" variante="sutil" onClick={edicion.descartar}>
                Descartar cambios
              </Boton>
            </>
          }
        >
          {edicion.error?.message}
          {edicion.error?.detalles?.length > 0 && (
            <ul>
              {edicion.error.detalles.map((d, i) => (
                <li key={i}>{d.mensaje}</li>
              ))}
            </ul>
          )}
        </Alerta>
      )}

      {observaciones && (
        <Alerta
          ref={refObservaciones}
          tabIndex={-1}
          tono="peligro"
          titulo={observaciones.titulo}
          onCerrar={() => setObservaciones(null)}
        >
          <ul>
            {observaciones.detalles.map((detalle, i) => (
              <li key={i}>{detalle}</li>
            ))}
          </ul>
        </Alerta>
      )}

      {rol.alertas.length > 0 && (
        <Alerta tono="aviso" titulo={`Alertas de descanso (${rol.alertas.length})`}>
          <p>El descanso mínimo entre el fin de un turno y el inicio del siguiente es de {rol.descanso_minimo_horas} horas.</p>
          <ul className="rt-alertas">
            {rol.alertas.map((alerta) => (
              <li key={`${alerta.id_empleado}-${alerta.fecha}-${alerta.fecha_anterior}`}>
                <button type="button" className="rt-alertas__enlace ds-foco" onClick={() => irACelda(alerta)}>
                  {nombreDe(alerta.id_empleado)}
                </button>
                : {alerta.mensaje}
              </li>
            ))}
          </ul>
        </Alerta>
      )}

      {paleta.length === 0 && (
        <Alerta tono="aviso" titulo="No hay turnos activos para asignar">
          Por ahora solo puede marcar descansos. Los turnos se crean en Asistencia › Turnos.
        </Alerta>
      )}

      {rol.empleados.length === 0 ? (
        <EstadoVacio
          icono={UsersRound}
          titulo="El área no tiene personal activo en esta sucursal"
          mensaje="Asigne colaboradores al área desde Organización › Asignaciones para planificar sus turnos."
        />
      ) : (
        <MatrizRol rol={rol} paleta={paleta} valorDe={edicion.valorDe} cambiar={edicion.cambiar} />
      )}

      <ModalConfirmacion
        abierto={confirmandoPublicar}
        titulo={rol.version_publicada > 0 ? "Publicar los cambios del rol" : "Publicar el rol de turnos"}
        textoConfirmar="Publicar"
        variante="primario"
        procesando={procesando}
        onConfirmar={publicar}
        onCancelar={() => setConfirmandoPublicar(false)}
      >
        <p>
          Los {vigentes} colaborador(es) de {rol.area.nombre} verán estos turnos en su portal de inmediato. Si el área es
          de producción o de reparto, también se avisará a los módulos de Producción y Logística o de Entregas y Despachos.
        </p>
      </ModalConfirmacion>

      <ModalConfirmacion
        abierto={confirmandoEliminar}
        titulo="Eliminar el borrador"
        textoConfirmar="Eliminar"
        procesando={procesando}
        onConfirmar={eliminar}
        onCancelar={() => setConfirmandoEliminar(false)}
      >
        <p>Se borrará el rol {describirPeriodo(rol).toLowerCase()} con todos sus turnos asignados. No se puede deshacer.</p>
      </ModalConfirmacion>
    </Tarjeta>
  );
}

export default function RolTurnosPage() {
  const [catalogos, setCatalogos] = useState(null);
  const [errorCatalogos, setErrorCatalogos] = useState(null);
  const [filtros, setFiltros] = useState(() => ({
    id_sucursal: "",
    id_departamento: "",
    periodo: "SEMANAL",
    fecha: hoyEnBolivia(),
  }));
  // El resultado se guarda con la clave de los filtros que lo pidieron; si no coincide, se está buscando.
  const [resultado, setResultado] = useState({ clave: null });
  const [intento, setIntento] = useState(0);
  const [creando, setCreando] = useState(false);
  const [errorCreacion, setErrorCreacion] = useState(null);
  const [intentoCatalogos, setIntentoCatalogos] = useState(0);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarSucursales(), listarAreas(), listarTurnosActivos()])
      .then(([sucursales, areas, turnos]) => vigente && setCatalogos({ sucursales, areas, turnos }))
      .catch((error) => vigente && setErrorCatalogos(error.message));
    return () => {
      vigente = false;
    };
  }, [intentoCatalogos]);

  const reintentarCatalogos = () => {
    setErrorCatalogos(null);
    setIntentoCatalogos((n) => n + 1);
  };

  const completos = Boolean(filtros.id_sucursal && filtros.id_departamento && filtros.fecha);
  const clave = completos ? `${filtros.id_sucursal}|${filtros.id_departamento}|${filtros.fecha}|${intento}` : null;

  useEffect(() => {
    if (!clave) return undefined;
    let vigente = true;
    const [idSucursal, idDepartamento, fecha] = clave.split("|");
    const responder = (datos) => vigente && setResultado({ clave, ...datos });
    listarRoles(idSucursal, idDepartamento)
      .then((roles) => {
        const existente = roles.find((r) => r.fecha_inicio <= fecha && fecha <= r.fecha_fin);
        if (!existente) return responder({ estado: "sin-rol" });
        return obtenerRol(existente.id_rol).then((rol) => responder({ estado: "listo", rol }));
      })
      .catch((error) => responder({ estado: "error", mensaje: error.message }));
    return () => {
      vigente = false;
    };
  }, [clave]);

  const busqueda = resultado.clave === clave ? resultado : { estado: "buscando" };
  const setBusqueda = useCallback((datos) => setResultado({ clave, ...datos }), [clave]);
  const reintentarBusqueda = () => setIntento((n) => n + 1);

  const cambiarFiltro = (campo) => (evento) => {
    const valor = evento.target.value;
    setErrorCreacion(null);
    if (campo === "mes") {
      if (!valor) return;
      setFiltros((actual) => ({ ...actual, fecha: `${valor}-01` }));
      return;
    }
    if (campo === "fecha" && !valor) return;
    setFiltros((actual) => ({ ...actual, [campo]: valor }));
  };

  const crear = async () => {
    setCreando(true);
    setErrorCreacion(null);
    try {
      const rol = await crearRol(filtros);
      setBusqueda({ estado: "listo", rol });
    } catch (error) {
      setErrorCreacion(error.message);
    } finally {
      setCreando(false);
    }
  };

  const actualizarRol = useCallback((rol) => setBusqueda({ estado: "listo", rol }), [setBusqueda]);

  const opcionesSucursal = useMemo(
    () => (catalogos?.sucursales ?? []).map((s) => ({ valor: s.id_sucursal, etiqueta: s.nombre })),
    [catalogos]
  );
  const opcionesArea = useMemo(
    () => (catalogos?.areas ?? []).map((a) => ({ valor: a.id_departamento, etiqueta: a.nombre })),
    [catalogos]
  );

  const rolAbierto = busqueda.estado === "listo" ? busqueda.rol : null;
  const otroPeriodo = rolAbierto && rolAbierto.periodo.codigo !== filtros.periodo;
  const etiquetaPeriodo = filtros.periodo === "MENSUAL" ? "mes" : "semana";

  return (
    <section className="rt-pagina" aria-labelledby="rt-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Asistencia" }]}
        enlace={Link}
        titulo="Rol de turnos"
        idTitulo="rt-titulo"
        descripcion="Planificación semanal o mensual de turnos rotativos por sucursal y área."
      />

      {errorCatalogos && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar las sucursales, áreas o turnos"
          acciones={
            <Boton tamano="sm" onClick={reintentarCatalogos}>
              Reintentar
            </Boton>
          }
        >
          {errorCatalogos}
        </Alerta>
      )}

      <Tarjeta className="rt-filtros" nivelTitulo={2} titulo="Planificador">
        {!catalogos && !errorCatalogos ? (
          <div className="rt-filtros__campos" aria-busy="true">
            <Esqueleto forma="bloque" />
            <Esqueleto forma="bloque" />
          </div>
        ) : (
          <div className="rt-filtros__campos">
            <Selector
              etiqueta="Sucursal"
              value={filtros.id_sucursal}
              onChange={cambiarFiltro("id_sucursal")}
              opciones={opcionesSucursal}
              textoVacio="Seleccione…"
            />
            <Selector
              etiqueta="Área operativa"
              value={filtros.id_departamento}
              onChange={cambiarFiltro("id_departamento")}
              opciones={opcionesArea}
              textoVacio="Seleccione…"
            />
            <Selector
              etiqueta="Periodo"
              value={filtros.periodo}
              onChange={cambiarFiltro("periodo")}
              opciones={PERIODOS}
            />
            <div className="rt-filtros__fecha">
              <Boton
                soloIcono
                icono={ChevronLeft}
                aria-label={`${etiquetaPeriodo === "mes" ? "Mes" : "Semana"} anterior`}
                onClick={() => setFiltros((f) => ({ ...f, fecha: moverFecha(f.fecha, f.periodo, -1) }))}
              />
              {filtros.periodo === "MENSUAL" ? (
                <CampoTexto etiqueta="Mes" type="month" value={filtros.fecha.slice(0, 7)} onChange={cambiarFiltro("mes")} />
              ) : (
                <CampoTexto
                  etiqueta="Semana que incluye"
                  type="date"
                  value={filtros.fecha}
                  onChange={cambiarFiltro("fecha")}
                />
              )}
              <Boton
                soloIcono
                icono={ChevronRight}
                aria-label={`${etiquetaPeriodo === "mes" ? "Mes" : "Semana"} siguiente`}
                onClick={() => setFiltros((f) => ({ ...f, fecha: moverFecha(f.fecha, f.periodo, 1) }))}
              />
            </div>
          </div>
        )}
      </Tarjeta>

      {!completos && catalogos && (
        <EstadoVacio
          titulo="Elija la sucursal y el área"
          mensaje="Se mostrará el rol de turnos del periodo elegido, o podrá crearlo."
        />
      )}

      {completos && busqueda.estado === "buscando" && (
        <Tarjeta className="rt-rol" aria-busy="true">
          <p className="ds-solo-lector" role="status">
            Buscando el rol de turnos…
          </p>
          <Esqueleto ancho="40%" />
          <Esqueleto forma="bloque" alto="240px" />
        </Tarjeta>
      )}

      {completos && busqueda.estado === "error" && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudo cargar el rol de turnos"
          acciones={
            <Boton tamano="sm" onClick={reintentarBusqueda}>
              Reintentar
            </Boton>
          }
        >
          {busqueda.mensaje}
        </Alerta>
      )}

      {completos && busqueda.estado === "sin-rol" && (
        <Tarjeta className="rt-rol">
          <EstadoVacio
            icono={CalendarPlus}
            titulo={`No hay rol de turnos para esta ${etiquetaPeriodo}`}
            mensaje="Cree el rol en borrador; nadie lo verá hasta que lo publique."
            accion={
              <Boton variante="primario" icono={CalendarPlus} cargando={creando} onClick={crear}>
                Crear rol {filtros.periodo === "MENSUAL" ? "mensual" : "semanal"}
              </Boton>
            }
          />
          {errorCreacion && (
            <Alerta tono="peligro" role="alert" titulo="No se pudo crear el rol">
              {errorCreacion}
            </Alerta>
          )}
        </Tarjeta>
      )}

      {completos && rolAbierto && (
        <>
          {otroPeriodo && (
            <Alerta tono="info" titulo={`Esta fecha ya está en un rol ${rolAbierto.periodo.nombre.toLowerCase()}`}>
              Se muestra ese rol. Para planificar por {etiquetaPeriodo}, elija fechas que no tengan un rol.
            </Alerta>
          )}
          <EditorRol
            key={rolAbierto.id_rol}
            rol={rolAbierto}
            paleta={catalogos?.turnos ?? []}
            onActualizar={actualizarRol}
            onEliminado={() => setBusqueda({ estado: "sin-rol" })}
          />
        </>
      )}
    </section>
  );
}

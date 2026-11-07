import { useCallback, useMemo } from "react";
import { Link } from "react-router";
import { ArrowLeft, FileText, Lock, SearchX, ShieldCheck } from "lucide-react";
import {
  listarCatalogosCasos,
  listarEmpleadosQueja,
  listarResponsablesQueja,
  obtenerCasoAsignado,
  obtenerCasoQueja,
  obtenerSeguimientoQueja,
} from "../../../api/casosQueja";
import {
  Alerta,
  Avatar,
  Boton,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Tarjeta,
} from "../../../components/ui";
import { useRol, useUsuario } from "../../../context/sesion";
import { formatearFechaHora, tonoEstado } from "../formato";
import DerivacionesQueja from "./DerivacionesQueja";
import FormularioDerivacion from "./FormularioDerivacion";
import GestionCasoQueja from "./GestionCasoQueja";
import InvolucradosQueja from "./InvolucradosQueja";
import LineaTiempoCaso from "./LineaTiempoCaso";
import { formatearFechaCorta, nombreDe, RUTA_CASOS_QUEJA, RUTA_MIS_CASOS_QUEJA, tonoPrioridad } from "./casos";
import useRecurso from "./useRecurso";
import "../quejas.css";
import "./casos.css";

const tamanoLegible = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const presentadaPor = (caso, responsable) => {
  if (caso.es_anonima) return "Anónimo, sin datos de quien la presentó";
  if (responsable) return "Identificada; sus datos solo los ve RRHH";
  return nombreDe(caso.denunciante);
};

function ResumenCaso({ caso, responsable = false }) {
  return (
    <Tarjeta nivelTitulo={2} titulo="Queja" className="qc-tarjeta">
      <div className="qc-etiquetas">
        <Etiqueta tono={tonoEstado(caso.estado.codigo)}>{caso.estado.nombre}</Etiqueta>
        {caso.prioridad ? (
          <Etiqueta tono={tonoPrioridad(caso.prioridad.codigo)}>Prioridad {caso.prioridad.nombre.toLowerCase()}</Etiqueta>
        ) : (
          <Etiqueta>Sin prioridad</Etiqueta>
        )}
        {caso.es_anonima && <Etiqueta tono="morado">Anónima</Etiqueta>}
      </div>

      <dl className="qj-datos">
        <div>
          <dt>Categoría</dt>
          <dd>{caso.categoria.nombre}</dd>
        </div>
        <div>
          <dt>Registrada</dt>
          <dd>{formatearFechaHora(caso.registrada_en)}</dd>
        </div>
        <div>
          <dt>Presentada por</dt>
          <dd>{presentadaPor(caso, responsable)}</dd>
        </div>
        <div>
          <dt>Responsable</dt>
          <dd>{caso.responsable ? nombreDe(caso.responsable) : "Sin asignar"}</dd>
        </div>
      </dl>

      <div className="qc-bloque">
        <h3 className="qc-subtitulo">Asunto</h3>
        <p className="qc-texto">{caso.asunto}</p>
      </div>
      <div className="qc-bloque">
        <h3 className="qc-subtitulo">Descripción</h3>
        <p className="qc-texto">{caso.descripcion}</p>
      </div>

      {caso.adjuntos.length > 0 && (
        <div className="qc-bloque">
          <h3 className="qc-subtitulo">Adjuntos</h3>
          <ul className="qj-archivos">
            {caso.adjuntos.map((adjunto) => (
              <li key={adjunto.orden} className="qj-archivo">
                <FileText className="ds-icono qj-archivo__icono" aria-hidden="true" />
                <span className="qj-archivo__nombre">{adjunto.nombre}</span>
                <span className="qj-archivo__tamano">{tamanoLegible(adjunto.tamano_bytes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="qj-nota qj-nota--privacidad">
        <ShieldCheck className="ds-icono" aria-hidden="true" />
        La descripción solo la ven el Administrador de RRHH y el responsable asignado; los avisos no la incluyen.
      </p>
    </Tarjeta>
  );
}

function InvolucradosLectura({ caso }) {
  return (
    <Tarjeta nivelTitulo={2} titulo="Involucrados" className="qc-tarjeta">
      {caso.involucrados.length === 0 ? (
        <p className="qc-ayuda">RRHH no registró involucrados en esta queja.</p>
      ) : (
        <ul className="qc-lista">
          {caso.involucrados.map((persona) => (
            <li key={persona.id_empleado} className="qc-lista__item">
              <span className="qc-persona">
                <Avatar nombre={nombreDe(persona)} decorativo />
                <span>{nombreDe(persona)}</span>
              </span>
              <span className="qc-sutil">{formatearFechaCorta(persona.registrado_en)}</span>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

const cargarSeguimiento = (sesion, idQueja) => Promise.resolve().then(() => obtenerSeguimientoQueja(sesion, idQueja));

function Cargando() {
  return (
    <div className="qc-detalle" aria-busy="true">
      <div className="qc-columna">
        <Esqueleto forma="bloque" alto="calc(var(--size-row) * 8)" />
      </div>
      <div className="qc-columna">
        <Esqueleto forma="bloque" alto="calc(var(--size-row) * 6)" />
      </div>
    </div>
  );
}

function DetalleAdministrador({ idQueja, sesion, idEmpleado }) {
  const caso = useRecurso(useCallback(() => obtenerCasoQueja(sesion, idQueja), [sesion, idQueja]));
  const seguimiento = useRecurso(useCallback(() => cargarSeguimiento(sesion, idQueja), [sesion, idQueja]));
  const catalogos = useRecurso(useCallback(() => listarCatalogosCasos(sesion), [sesion]));
  const responsables = useRecurso(useCallback(() => listarResponsablesQueja(sesion), [sesion]));
  const empleados = useRecurso(useCallback(() => listarEmpleadosQueja(), []));

  const datos = caso.datos;
  const editable = datos && !datos.estado.es_final;
  const sinUsuario = !idEmpleado;
  const deshabilitado = sinUsuario || !editable;

  const listaResponsables = {
    lista: responsables.datos,
    cargando: responsables.cargando,
    error: responsables.error?.message,
    reintentar: responsables.reintentar,
  };
  const listaEmpleados = {
    lista: empleados.datos,
    error: empleados.error?.message,
    reintentar: empleados.reintentar,
  };

  let contenido;
  if (caso.error && !datos) {
    contenido = <ErrorCaso error={caso.error} ruta={RUTA_CASOS_QUEJA} reintentar={caso.reintentar} />;
  } else if (catalogos.error && !catalogos.datos) {
    contenido = (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudieron cargar las categorías y prioridades"
        acciones={
          <Boton tamano="sm" onClick={catalogos.reintentar}>
            Reintentar
          </Boton>
        }
      >
        {catalogos.error.message}
      </Alerta>
    );
  } else if (!datos || !catalogos.datos) {
    contenido = <Cargando />;
  } else {
    contenido = (
      <>
        {sinUsuario && editable && (
          <Alerta tono="aviso" titulo="Elija su usuario de prueba">
            Para clasificar, derivar o registrar involucrados, seleccione quién es en «Usuario de prueba», al pie de la
            barra lateral.
          </Alerta>
        )}
        {!editable && (
          <Alerta tono="info" titulo="Queja cerrada">
            La queja está en estado «{datos.estado.nombre}» y ya no admite cambios.
          </Alerta>
        )}
        <div className="qc-detalle">
          <div className="qc-columna">
            <ResumenCaso caso={datos} />
            <LineaTiempoCaso caso={datos} seguimiento={seguimiento} />
          </div>
          <div className="qc-columna">
            {seguimiento.datos && (
              <GestionCasoQueja
                caso={datos}
                seguimiento={seguimiento.datos}
                sesion={sesion}
                onActualizado={() => {
                  caso.reintentar();
                  seguimiento.reintentar();
                }}
              />
            )}
            {editable && (
              <FormularioDerivacion
                key={datos.actualizada_en}
                caso={datos}
                sesion={sesion}
                catalogos={catalogos.datos}
                responsables={listaResponsables}
                deshabilitado={deshabilitado}
                onActualizado={caso.reintentar}
              />
            )}
            <InvolucradosQueja
              caso={datos}
              sesion={sesion}
              empleados={listaEmpleados}
              deshabilitado={deshabilitado}
              onActualizado={caso.reintentar}
            />
            <DerivacionesQueja
              caso={datos}
              sesion={sesion}
              deshabilitado={deshabilitado}
              onActualizado={caso.reintentar}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <PaginaDetalle datos={datos} etiqueta="Casos de quejas" ruta={RUTA_CASOS_QUEJA}>
      {contenido}
    </PaginaDetalle>
  );
}

function PaginaDetalle({ datos, etiqueta, ruta, children }) {
  return (
    <section className="qc-pagina" aria-labelledby="qc-detalle-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Desempeño" }, { etiqueta, href: ruta }]}
        enlace={Link}
        titulo={datos ? `Queja ${datos.codigo_seguimiento}` : "Caso de queja"}
        idTitulo="qc-detalle-titulo"
        acciones={
          <Boton as={Link} to={ruta} icono={ArrowLeft}>
            Volver a la bandeja
          </Boton>
        }
      />
      {children}
    </section>
  );
}

function ErrorCaso({ error, ruta, reintentar }) {
  if (error.estado === 404) {
    return (
      <EstadoVacio
        icono={SearchX}
        titulo="No se encontró la queja"
        mensaje="Puede que el enlace esté incompleto. Vuelva a la bandeja y ábrala desde la lista."
        accion={
          <Boton as={Link} to={ruta}>
            Volver a la bandeja
          </Boton>
        }
      />
    );
  }
  if (error.estado === 403) {
    return (
      <EstadoVacio
        icono={Lock}
        titulo="Este caso no está asignado a usted"
        mensaje="Puede que RRHH lo haya derivado a otra persona. Vuelva a la bandeja."
        accion={
          <Boton as={Link} to={ruta}>
            Volver a la bandeja
          </Boton>
        }
      />
    );
  }
  return (
    <Alerta
      tono="peligro"
      role="alert"
      titulo="No se pudo cargar la queja"
      acciones={
        <Boton tamano="sm" onClick={reintentar}>
          Reintentar
        </Boton>
      }
    >
      {error.message}
    </Alerta>
  );
}

const sinCaso = () => Promise.resolve(null);

function DetalleResponsable({ idQueja, sesion, idEmpleado }) {
  const caso = useRecurso(
    useCallback(() => (idEmpleado ? obtenerCasoAsignado(sesion, idQueja) : sinCaso()), [sesion, idQueja, idEmpleado]),
  );
  const seguimiento = useRecurso(
    useCallback(() => (idEmpleado ? cargarSeguimiento(sesion, idQueja) : sinCaso()), [sesion, idQueja, idEmpleado]),
  );
  const datos = caso.datos;
  const recargar = () => {
    caso.reintentar();
    seguimiento.reintentar();
  };

  let contenido;
  if (!idEmpleado) {
    contenido = (
      <Alerta tono="aviso" titulo="Elija su usuario de prueba">
        Para atender el caso, seleccione quién es en «Usuario de prueba», al pie de la barra lateral.
      </Alerta>
    );
  } else if (caso.error && !datos) {
    contenido = <ErrorCaso error={caso.error} ruta={RUTA_MIS_CASOS_QUEJA} reintentar={caso.reintentar} />;
  } else if (!datos) {
    contenido = <Cargando />;
  } else {
    contenido = (
      <>
        {datos.estado.es_final && (
          <Alerta tono="info" titulo="Caso cerrado">
            La queja está en estado «{datos.estado.nombre}» y ya no admite acciones ni cambios de estado.
          </Alerta>
        )}
        <div className="qc-detalle">
          <div className="qc-columna">
            <ResumenCaso caso={datos} responsable />
            <LineaTiempoCaso caso={datos} seguimiento={seguimiento} />
          </div>
          <div className="qc-columna">
            {seguimiento.datos && (
              <GestionCasoQueja caso={datos} seguimiento={seguimiento.datos} sesion={sesion} onActualizado={recargar} />
            )}
            <InvolucradosLectura caso={datos} />
          </div>
        </div>
      </>
    );
  }

  return (
    <PaginaDetalle datos={datos} etiqueta="Mis casos de quejas" ruta={RUTA_MIS_CASOS_QUEJA}>
      {contenido}
    </PaginaDetalle>
  );
}

export default function DetalleCasoQuejaPage({ idQueja, alcance = "administrador" }) {
  const rol = useRol();
  const idEmpleado = useUsuario();
  const sesion = useMemo(() => ({ rol, idEmpleado }), [rol, idEmpleado]);
  const Detalle = alcance === "responsable" ? DetalleResponsable : DetalleAdministrador;
  return <Detalle idQueja={idQueja} sesion={sesion} idEmpleado={idEmpleado} />;
}

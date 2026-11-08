import { useCallback, useMemo } from "react";
import { Link } from "react-router";
import { ArrowLeft, Lock, SearchX, ShieldCheck } from "lucide-react";
import { obtenerHistorialQueja } from "../../../api/historialQuejas";
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
import { useRol } from "../../../context/sesion";
import { formatearFechaHora, tonoEstado } from "../formato";
import LineaTiempoCaso from "../casos/LineaTiempoCaso";
import { nombreDe, tonoPrioridad } from "../casos/casos";
import useRecurso from "../casos/useRecurso";
import { formatearDuracion, MENSAJE_SIN_PERMISO, RUTA_HISTORIAL_QUEJAS } from "./historial";
import "../quejas.css";
import "../casos/casos.css";
import "./historial.css";

const fechaODato = (valor) => (valor ? formatearFechaHora(valor) : "Sin dato");

function ResumenHistorial({ caso }) {
  return (
    <Tarjeta nivelTitulo={2} titulo="Caso" className="qc-tarjeta">
      <div className="qc-etiquetas">
        <Etiqueta tono={tonoEstado(caso.estado.codigo)}>{caso.estado.nombre}</Etiqueta>
        {caso.prioridad ? (
          <Etiqueta tono={tonoPrioridad(caso.prioridad.codigo)}>Prioridad {caso.prioridad.nombre.toLowerCase()}</Etiqueta>
        ) : (
          <Etiqueta>Sin prioridad</Etiqueta>
        )}
        <Etiqueta tono={caso.es_anonima ? "morado" : "neutral"}>{caso.es_anonima ? "Anónima" : "Identificada"}</Etiqueta>
      </div>

      <dl className="qj-datos">
        <div>
          <dt>Categoría</dt>
          <dd>{caso.categoria.nombre}</dd>
        </div>
        <div>
          <dt>Sucursal</dt>
          <dd>{caso.sucursal?.nombre ?? "Sin sucursal"}</dd>
        </div>
        <div>
          <dt>Responsable</dt>
          <dd>{caso.responsable ? nombreDe(caso.responsable) : "Sin responsable"}</dd>
        </div>
        <div>
          <dt>Acciones registradas</dt>
          <dd>{caso.total_acciones}</dd>
        </div>
        <div>
          <dt>Registrada</dt>
          <dd>{fechaODato(caso.registrada_en)}</dd>
        </div>
        <div>
          <dt>Derivada</dt>
          <dd>{fechaODato(caso.derivada_en)}</dd>
        </div>
        <div>
          <dt>Cerrada</dt>
          <dd>{fechaODato(caso.cerrada_en)}</dd>
        </div>
        <div>
          <dt>Duración de la atención</dt>
          <dd>{formatearDuracion(caso.duracion_dias)}</dd>
        </div>
      </dl>

      <p className="qj-nota qj-nota--privacidad">
        <ShieldCheck className="ds-icono" aria-hidden="true" />
        Por confidencialidad, el historial no muestra quién presentó la queja ni su contenido.
      </p>
    </Tarjeta>
  );
}

function DerivacionesLectura({ derivaciones }) {
  return (
    <Tarjeta nivelTitulo={2} titulo="Derivaciones" className="qc-tarjeta">
      {derivaciones.length === 0 ? (
        <p className="qc-sutil">El caso no registra derivaciones.</p>
      ) : (
        <ul className="qc-lista">
          {derivaciones.map((derivacion, indice) => (
            <li key={derivacion.id_asignacion} className="qc-lista__item qc-lista__item--columna">
              <div className="qc-persona">
                <Avatar nombre={nombreDe(derivacion.responsable)} decorativo />
                <div className="qc-celda">
                  <span className="qc-celda__principal">{nombreDe(derivacion.responsable)}</span>
                  <span className="qc-sutil">
                    {formatearFechaHora(derivacion.asignada_en)} · por {nombreDe(derivacion.asignador)}
                  </span>
                </div>
              </div>
              {indice === 0 && <Etiqueta tono="info">Atendió el cierre</Etiqueta>}
              {derivacion.comentario && <p className="qc-texto qc-texto--secundario">{derivacion.comentario}</p>}
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

function ErrorHistorial({ error, reintentar }) {
  const volver = (
    <Boton as={Link} to={RUTA_HISTORIAL_QUEJAS}>
      Volver al historial
    </Boton>
  );
  if (error.estado === 401 || error.estado === 403) {
    return <EstadoVacio icono={Lock} titulo="Acceso restringido" mensaje={MENSAJE_SIN_PERMISO} accion={volver} />;
  }
  if (error.estado === 404) {
    return (
      <EstadoVacio
        icono={SearchX}
        titulo="No se encontró el caso cerrado"
        mensaje="Puede que la queja siga en atención o que el enlace esté incompleto."
        accion={volver}
      />
    );
  }
  return (
    <Alerta
      tono="peligro"
      role="alert"
      titulo="No se pudo cargar la trazabilidad"
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

export default function DetalleHistorialQuejaPage({ idQueja }) {
  const rol = useRol();
  const sesion = useMemo(() => ({ rol }), [rol]);
  const caso = useRecurso(useCallback(() => obtenerHistorialQueja(sesion, idQueja), [sesion, idQueja]));
  const datos = caso.datos;

  const seguimiento = useMemo(
    () => ({
      datos: datos ? { acciones: datos.acciones, resolucion: datos.resolucion } : null,
      cargando: false,
      error: null,
      reintentar: caso.reintentar,
    }),
    [datos, caso.reintentar],
  );

  let contenido;
  if (caso.error && !datos) {
    contenido = <ErrorHistorial error={caso.error} reintentar={caso.reintentar} />;
  } else if (!datos) {
    contenido = (
      <div className="qc-detalle" aria-busy="true">
        <div className="qc-columna">
          <Esqueleto forma="bloque" alto="calc(var(--size-row) * 8)" />
        </div>
        <div className="qc-columna">
          <Esqueleto forma="bloque" alto="calc(var(--size-row) * 4)" />
        </div>
      </div>
    );
  } else {
    contenido = (
      <div className="qc-detalle">
        <div className="qc-columna">
          <ResumenHistorial caso={datos} />
          <LineaTiempoCaso caso={datos} seguimiento={seguimiento} />
        </div>
        <div className="qc-columna">
          <DerivacionesLectura derivaciones={datos.derivaciones} />
        </div>
      </div>
    );
  }

  return (
    <section className="qc-pagina" aria-labelledby="qh-detalle-titulo">
      <EncabezadoPagina
        migas={[
          { etiqueta: "Inicio", href: "/" },
          { etiqueta: "Desempeño" },
          { etiqueta: "Historial de quejas", href: RUTA_HISTORIAL_QUEJAS },
        ]}
        enlace={Link}
        titulo={datos ? `Queja ${datos.codigo_seguimiento}` : "Trazabilidad del caso"}
        idTitulo="qh-detalle-titulo"
        acciones={
          <Boton as={Link} to={RUTA_HISTORIAL_QUEJAS} icono={ArrowLeft}>
            Volver al historial
          </Boton>
        }
      />
      {contenido}
    </section>
  );
}

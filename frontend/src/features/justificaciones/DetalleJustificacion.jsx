import { useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, Download, ExternalLink, FileImage, FileText } from "lucide-react";
import { obtenerJustificacion, revisarJustificacion, urlComprobante } from "../../api/justificaciones";
import { Alerta, Boton, CampoAreaTexto, Esqueleto, Etiqueta, Modal } from "../../components/ui";
import {
  ESTADOS_SOLICITUD,
  describirNovedad,
  formatearFechaHora,
  formatearHora,
  formatearJornada,
  formatearMinutos,
  formatearTamano,
} from "./formato";

const MAX_COMENTARIO = 500;

function VistaPrevia({ adjunto }) {
  const url = urlComprobante(adjunto);
  return (
    <div className="jf-vista">
      {adjunto.tipo_mime === "application/pdf" ? (
        <iframe className="jf-vista__marco" src={url} title={`Vista previa de «${adjunto.nombre}»`} />
      ) : (
        <img className="jf-vista__imagen" src={url} alt={`Comprobante «${adjunto.nombre}»`} />
      )}
      <div className="jf-vista__acciones">
        <Boton tamano="sm" variante="sutil" icono={ExternalLink} href={url} target="_blank" rel="noopener noreferrer">
          Abrir en otra pestaña
        </Boton>
        <Boton tamano="sm" variante="sutil" icono={Download} href={urlComprobante(adjunto, { descargar: true })} download>
          Descargar
        </Boton>
      </div>
    </div>
  );
}

function Comprobantes({ adjuntos }) {
  const [elegido, setElegido] = useState(adjuntos[0]?.id_adjunto);
  const actual = adjuntos.find((a) => a.id_adjunto === elegido) ?? adjuntos[0];
  if (!actual) return <p className="jf-sutil">Sin comprobantes.</p>;
  return (
    <>
      {adjuntos.length > 1 && (
        <div className="jf-selector-adjuntos" role="group" aria-label="Comprobante a mostrar">
          {adjuntos.map((a) => (
            <Boton
              key={a.id_adjunto}
              tamano="sm"
              variante={a.id_adjunto === actual.id_adjunto ? "primario" : "predeterminado"}
              icono={a.tipo_mime === "application/pdf" ? FileText : FileImage}
              aria-pressed={a.id_adjunto === actual.id_adjunto}
              onClick={() => setElegido(a.id_adjunto)}
            >
              {a.nombre}
            </Boton>
          ))}
        </div>
      )}
      <p className="jf-sutil">
        {actual.nombre} · {formatearTamano(actual.tamano_bytes)}
      </p>
      <VistaPrevia key={actual.id_adjunto} adjunto={actual} />
    </>
  );
}

function Revision({ solicitud }) {
  const aprobada = solicitud.estado.codigo === "APROBADA";
  const { revision } = solicitud;
  return (
    <Alerta tono={aprobada ? "exito" : "peligro"} titulo={aprobada ? "Solicitud aprobada" : "Solicitud rechazada"}>
      <p>
        Por {revision.nombre_revisor} el {formatearFechaHora(revision.revisada_en)}.
      </p>
      {revision.comentario && <p>Comentario: {revision.comentario}</p>}
    </Alerta>
  );
}

// Detalle de una solicitud con sus comprobantes y, si está pendiente, la decisión del revisor.
export default function DetalleJustificacion({ idSolicitud, revisor, onCerrar, onRevisada }) {
  const [resultado, setResultado] = useState({ id: null });
  const [comentario, setComentario] = useState("");
  const [errorComentario, setErrorComentario] = useState(null);
  const [errorRevision, setErrorRevision] = useState(null);
  const [decidiendo, setDecidiendo] = useState(null);
  const refComentario = useRef(null);
  const refError = useRef(null);

  useEffect(() => {
    if (!idSolicitud) return undefined;
    let vigente = true;
    obtenerJustificacion(idSolicitud)
      .then((datos) => vigente && setResultado({ id: idSolicitud, datos }))
      .catch((error) => vigente && setResultado({ id: idSolicitud, error: error.message }));
    return () => {
      vigente = false;
    };
  }, [idSolicitud]);

  useEffect(() => {
    if (errorRevision) refError.current?.focus();
  }, [errorRevision]);

  const vista = resultado.id === idSolicitud ? resultado : {};
  const solicitud = vista.datos;
  const pendiente = solicitud?.estado.codigo === "PENDIENTE";

  const cerrar = () => {
    if (decidiendo) return;
    setComentario("");
    setErrorComentario(null);
    setErrorRevision(null);
    onCerrar();
  };

  const decidir = async (decision) => {
    setErrorRevision(null);
    if (decision === "RECHAZADA" && !comentario.trim()) {
      setErrorComentario("Explique el motivo del rechazo: el colaborador lo verá.");
      refComentario.current?.focus();
      return;
    }
    setDecidiendo(decision);
    try {
      const revisada = await revisarJustificacion(idSolicitud, revisor.id, { decision, comentario: comentario.trim() });
      setComentario("");
      setErrorComentario(null);
      onRevisada(revisada);
    } catch (error) {
      const deCampo = error.detalles?.find((d) => d.campo === "comentario");
      if (deCampo) {
        setErrorComentario(deCampo.mensaje);
        refComentario.current?.focus();
      } else {
        setErrorRevision(error.message);
      }
    } finally {
      setDecidiendo(null);
    }
  };

  const puedeDecidir = pendiente && revisor;

  return (
    <Modal
      abierto={Boolean(idSolicitud)}
      titulo={solicitud ? `Justificativo de ${solicitud.empleado.nombre_completo}` : "Justificativo"}
      onCerrar={cerrar}
      bloqueado={Boolean(decidiendo)}
      pie={
        puedeDecidir ? (
          <>
            <Boton variante="sutil" onClick={cerrar} disabled={Boolean(decidiendo)}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              icono={CircleX}
              onClick={() => decidir("RECHAZADA")}
              cargando={decidiendo === "RECHAZADA"}
              disabled={Boolean(decidiendo)}
            >
              Rechazar
            </Boton>
            <Boton
              variante="primario"
              icono={CircleCheck}
              onClick={() => decidir("APROBADA")}
              cargando={decidiendo === "APROBADA"}
              disabled={Boolean(decidiendo)}
            >
              Aprobar
            </Boton>
          </>
        ) : (
          <Boton onClick={cerrar} data-autofocus>
            Cerrar
          </Boton>
        )
      }
    >
      {!vista.datos && !vista.error && (
        <div aria-busy="true">
          <p className="ds-solo-lector" role="status">
            Cargando la solicitud…
          </p>
          <Esqueleto />
          <Esqueleto />
          <Esqueleto forma="bloque" />
        </div>
      )}
      {vista.error && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo cargar la solicitud">
          {vista.error}
        </Alerta>
      )}
      {solicitud && (
        <div className="jf-detalle">
          <dl className="jf-resumen-novedad">
            <div>
              <dt>Novedad</dt>
              <dd>
                {solicitud.novedad.tipo.nombre} del {formatearJornada(solicitud.novedad.fecha_jornada)}:{" "}
                {describirNovedad(solicitud.novedad)}
              </dd>
            </div>
            <div>
              <dt>Turno</dt>
              <dd>
                {solicitud.novedad.turno.nombre}, {formatearHora(solicitud.novedad.turno.inicio_programado)}–
                {formatearHora(solicitud.novedad.turno.fin_programado)}
                {solicitud.novedad.fecha_hora_marcaje && ` · marcó a las ${formatearHora(solicitud.novedad.fecha_hora_marcaje)}`}
              </dd>
            </div>
            <div>
              <dt>Penalización</dt>
              <dd>
                {solicitud.novedad.estado.codigo === "JUSTIFICADA"
                  ? "Subsanada"
                  : `${formatearMinutos(solicitud.novedad.minutos_penalizacion)} a descontar`}
              </dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd>{solicitud.motivo.nombre}</dd>
            </div>
            {solicitud.descripcion && (
              <div>
                <dt>Detalle</dt>
                <dd className="jf-detalle__texto">{solicitud.descripcion}</dd>
              </div>
            )}
            <div>
              <dt>Presentada</dt>
              <dd>{formatearFechaHora(solicitud.creado_en)}</dd>
            </div>
          </dl>

          <section className="jf-detalle__seccion" aria-labelledby="jf-comprobantes-titulo">
            <h3 id="jf-comprobantes-titulo" className="jf-detalle__titulo">
              Comprobantes ({solicitud.adjuntos.length})
            </h3>
            <Comprobantes adjuntos={solicitud.adjuntos} />
          </section>

          {solicitud.anteriores.length > 0 && (
            <section className="jf-detalle__seccion" aria-labelledby="jf-anteriores-titulo">
              <h3 id="jf-anteriores-titulo" className="jf-detalle__titulo">
                Solicitudes anteriores de esta novedad
              </h3>
              <ul className="jf-anteriores">
                {solicitud.anteriores.map((a) => (
                  <li key={a.id_solicitud}>
                    <Etiqueta tono={ESTADOS_SOLICITUD[a.estado.codigo].tono} icono={ESTADOS_SOLICITUD[a.estado.codigo].icono}>
                      {ESTADOS_SOLICITUD[a.estado.codigo].texto}
                    </Etiqueta>{" "}
                    <span className="jf-sutil">{formatearFechaHora(a.creado_en)}</span>
                    {a.revision?.comentario && <p className="jf-detalle__texto">«{a.revision.comentario}»</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!pendiente && solicitud.revision && <Revision solicitud={solicitud} />}

          {pendiente && !revisor && (
            <Alerta tono="aviso" titulo="Identifíquese para decidir">
              Ingrese su identificador de empleado en «Revisor», en esta pantalla, para aprobar o rechazar.
            </Alerta>
          )}

          {errorRevision && (
            <Alerta ref={refError} tabIndex={-1} tono="peligro" role="alert" titulo="No se pudo registrar la decisión">
              {errorRevision}
            </Alerta>
          )}

          {puedeDecidir && (
            <CampoAreaTexto
              ref={refComentario}
              id="jf-comentario"
              etiqueta="Comentario"
              filas={3}
              maxLength={MAX_COMENTARIO}
              value={comentario}
              onChange={(e) => {
                setComentario(e.target.value);
                if (errorComentario) setErrorComentario(null);
              }}
              error={errorComentario}
              ayuda={`Obligatorio si rechaza; el colaborador lo verá. ${comentario.length} de ${MAX_COMENTARIO} caracteres.`}
              disabled={Boolean(decidiendo)}
              data-autofocus
            />
          )}
        </div>
      )}
    </Modal>
  );
}

import { Boton, Etiqueta, Modal } from "../../components/ui";
import {
  ESTADOS_DIA,
  TONO_NOVEDAD,
  describirNovedad,
  estadoSolicitud,
  fechaCorta,
  formatearDiaLargo,
  formatearFechaHora,
  formatearHoraExacta,
  formatearMinutos,
} from "./formato";

function Marcaje({ titulo, marcaje }) {
  return (
    <div className="ma-dato">
      <dt className="ma-dato__etiqueta">{titulo}</dt>
      <dd className="ma-dato__valor">
        {marcaje ? (
          <>
            <time dateTime={marcaje.fecha_hora}>{formatearHoraExacta(marcaje.fecha_hora)}</time>
            <span className="ma-sutil">
              {marcaje.origen.codigo === "BIOMETRICO" ? `Lector ${marcaje.codigo_dispositivo ?? "biométrico"}` : "Portal"}
              {marcaje.estado.codigo !== "REGISTRADO" && ` · ${marcaje.estado.nombre}`}
            </span>
          </>
        ) : (
          <span className="ma-sutil">Sin registro</span>
        )}
      </dd>
    </div>
  );
}

// Criterio 3: estado del justificativo (pendiente, aprobado o rechazado) y de la licencia de la jornada.
function Justificacion({ novedad }) {
  const { justificacion } = novedad;
  if (!justificacion) {
    return (
      <p className="ma-sutil">
        {novedad.estado.codigo === "JUSTIFICADA"
          ? "Justificada."
          : novedad.justificable
            ? "Sin justificativo presentado."
            : "Esta novedad no se justifica."}
      </p>
    );
  }
  const { tono, icono } = estadoSolicitud(justificacion.estado.codigo);
  return (
    <div className="ma-incidencia__estado">
      <p>
        Justificativo <Etiqueta tono={tono} icono={icono}>{justificacion.estado.nombre}</Etiqueta>
      </p>
      <p className="ma-sutil">
        {justificacion.motivo} · enviado el {formatearFechaHora(justificacion.enviada_en)}
      </p>
      {justificacion.revision && (
        <p className="ma-sutil">
          Revisado por {justificacion.revision.nombre_revisor} el {formatearFechaHora(justificacion.revision.revisada_en)}
        </p>
      )}
      {justificacion.revision?.comentario && <p>Comentario: {justificacion.revision.comentario}</p>}
    </div>
  );
}

export default function DetalleJornada({ dia, onCerrar }) {
  const estado = dia ? ESTADOS_DIA[dia.estado] : null;
  return (
    <Modal
      abierto={Boolean(dia)}
      titulo={dia ? `Jornada del ${formatearDiaLargo(dia.fecha)}` : ""}
      onCerrar={onCerrar}
      cerrarAlClicFuera
      pie={
        <Boton variante="primario" onClick={onCerrar} data-autofocus>
          Cerrar
        </Boton>
      }
    >
      {dia && (
        <div className="ma-detalle">
          <p>
            <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
          </p>
          <dl className="ma-datos">
            <div className="ma-dato">
              <dt className="ma-dato__etiqueta">Turno</dt>
              <dd className="ma-dato__valor">
                {dia.turno?.descanso
                  ? "Día de descanso"
                  : dia.turno
                    ? `${dia.turno.nombre} (${dia.turno.hora_inicio}–${dia.turno.hora_fin})`
                    : "Sin turno programado"}
              </dd>
            </div>
            <Marcaje titulo="Entrada" marcaje={dia.entrada} />
            <Marcaje titulo="Salida" marcaje={dia.salida} />
            <div className="ma-dato">
              <dt className="ma-dato__etiqueta">Horas computadas</dt>
              <dd className="ma-dato__valor">
                {dia.minutos_trabajados === null ? "—" : formatearMinutos(dia.minutos_trabajados)}
                {dia.minutos_extra_aprobados > 0 && (
                  <span className="ma-sutil">{formatearMinutos(dia.minutos_extra_aprobados)} extra aprobadas</span>
                )}
                {dia.horas_extra && dia.minutos_extra_aprobados === 0 && (
                  <span className="ma-sutil">Horas extra: {dia.horas_extra.nombre}</span>
                )}
              </dd>
            </div>
          </dl>

          <section className="ma-incidencias" aria-labelledby="ma-incidencias-titulo">
            <h3 id="ma-incidencias-titulo" className="ma-subtitulo">
              Incidencias
            </h3>
            {dia.novedades.length === 0 && dia.licencias.length === 0 && (
              <p className="ma-sutil">Sin atrasos, faltas ni permisos en esta jornada.</p>
            )}
            <ul className="ma-lista-incidencias">
              {dia.novedades.map((n) => (
                <li key={n.id_novedad} className="ma-incidencia">
                  <Etiqueta tono={TONO_NOVEDAD[n.tipo.codigo] ?? "neutral"}>{describirNovedad(n)}</Etiqueta>
                  <Justificacion novedad={n} />
                </li>
              ))}
              {dia.licencias.map((l) => {
                const { tono, icono } = estadoSolicitud(l.estado.codigo);
                return (
                  <li key={l.id_solicitud} className="ma-incidencia">
                    <Etiqueta tono="morado">{l.tipo.nombre}</Etiqueta>
                    <div className="ma-incidencia__estado">
                      <p>
                        Solicitud <Etiqueta tono={tono} icono={icono}>{l.estado.nombre}</Etiqueta>
                      </p>
                      <p className="ma-sutil">
                        {l.fecha_inicio === l.fecha_fin
                          ? `El ${fechaCorta(l.fecha_inicio)}`
                          : `Del ${fechaCorta(l.fecha_inicio)} al ${fechaCorta(l.fecha_fin)}`}
                      </p>
                      {l.motivo_resolucion && <p>Comentario: {l.motivo_resolucion}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}

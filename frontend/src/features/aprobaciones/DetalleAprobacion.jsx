import { useEffect, useState } from "react";
import { CircleCheck, CircleX, ExternalLink, Paperclip, UsersRound } from "lucide-react";
import { descargarComprobanteAprobacion, obtenerAprobacion } from "../../api/aprobaciones";
import { Alerta, Boton, Esqueleto, Etiqueta, Modal } from "../../components/ui";
import { ESTADOS_SOLICITUD, formatearFechaHora, formatearTamano } from "../justificaciones/formato";
import { formatearFechaConDia, formatearPeriodo } from "../solicitud-vacaciones/formato";
import ModalDecision from "./ModalDecision";
import { CATEGORIAS, IMPACTO, describirDias, plural } from "./formato";

function Cobertura({ cobertura, aviso }) {
  if (!cobertura) {
    return (
      <Alerta tono="aviso" titulo="No se pudo calcular el impacto en el equipo">
        {aviso ?? "No se obtuvo la información del equipo del colaborador."}
      </Alerta>
    );
  }
  const impacto = IMPACTO[cobertura.nivel_impacto];
  return (
    <div className="ap-cobertura">
      <p className="ap-cobertura__resumen">
        <Etiqueta tono={impacto.tono} icono={UsersRound}>
          {impacto.texto}
        </Etiqueta>
        <span>
          Hasta <strong>{plural(cobertura.maximo_ausentes_simultaneos, "persona ausente", "personas ausentes")}</strong> a la vez
          de un equipo de {cobertura.equipo_total}
          {cobertura.porcentaje_equipo !== null && ` (${cobertura.porcentaje_equipo} %)`}.
        </span>
      </p>
      {cobertura.maximo_con_pendientes > cobertura.maximo_ausentes_simultaneos && (
        <p className="ap-sutil">
          Si también se aprobaran las solicitudes pendientes de sus compañeros, serían {cobertura.maximo_con_pendientes} a la vez.
        </p>
      )}
      {cobertura.ausencias.length === 0 ? (
        <p className="ap-sutil">Ningún compañero tiene ausencias en esas fechas.</p>
      ) : (
        <ul className="ap-ausencias">
          {cobertura.ausencias.map((ausencia) => (
            <li key={`${ausencia.categoria}-${ausencia.id_solicitud}`}>
              <span className="ap-ausencias__nombre">{ausencia.empleado.nombre_completo}</span>
              <span className="ap-sutil">
                {ausencia.tipo} · {formatearPeriodo(ausencia.fecha_inicio, ausencia.fecha_fin)}
              </span>
              <Etiqueta tono={ausencia.estado_codigo === "APROBADA" ? "exito" : "info"}>
                {ausencia.estado_codigo === "APROBADA" ? "Aprobada" : "Pendiente"}
              </Etiqueta>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Comprobantes({ solicitud, rol }) {
  const [error, setError] = useState(null);
  const [abriendo, setAbriendo] = useState(null);

  const abrir = async (adjunto) => {
    setError(null);
    setAbriendo(adjunto.id_adjunto);
    try {
      const archivo = await descargarComprobanteAprobacion(rol, solicitud.id_solicitud, adjunto.id_adjunto);
      const url = URL.createObjectURL(archivo);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
    } catch (e) {
      setError(e.message);
    } finally {
      setAbriendo(null);
    }
  };

  if (solicitud.adjuntos.length === 0) return <p className="ap-sutil">La solicitud no tiene comprobantes adjuntos.</p>;
  return (
    <>
      <ul className="ap-comprobantes">
        {solicitud.adjuntos.map((adjunto) => (
          <li key={adjunto.id_adjunto}>
            <Paperclip className="ds-icono" aria-hidden="true" />
            <span className="ap-comprobantes__nombre">{adjunto.nombre}</span>
            <span className="ap-sutil">{formatearTamano(adjunto.tamano_bytes)}</span>
            <Boton
              tamano="sm"
              variante="sutil"
              icono={ExternalLink}
              cargando={abriendo === adjunto.id_adjunto}
              onClick={() => abrir(adjunto)}
              aria-label={`Abrir el comprobante ${adjunto.nombre}`}
            >
              Abrir
            </Boton>
          </li>
        ))}
      </ul>
      {error && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo abrir el comprobante">
          {error}
        </Alerta>
      )}
    </>
  );
}

// Criterio 1: fechas, días hábiles, causal, comprobante e impacto de cobertura, y la decisión del supervisor o RRHH.
export default function DetalleAprobacion({ abierta, rol, resolutor, onCerrar, onResuelta }) {
  const [resultado, setResultado] = useState({ clave: null });
  const [decision, setDecision] = useState(null);

  const clave = abierta ? `${abierta.categoria}|${abierta.id_solicitud}` : null;

  useEffect(() => {
    if (!abierta) return undefined;
    let vigente = true;
    obtenerAprobacion(rol, abierta.categoria, abierta.id_solicitud)
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error: error.message }));
    return () => {
      vigente = false;
    };
  }, [abierta, rol, clave]);

  const vista = resultado.clave === clave ? resultado : {};
  const solicitud = vista.datos;
  const pendiente = solicitud?.estado.codigo === "PENDIENTE";
  // Una licencia sobre su tope solo la autoriza RRHH; el supervisor puede rechazarla.
  const soloRrhh = Boolean(solicitud?.requiere_rrhh) && rol === "supervisor";
  const puedeDecidir = pendiente && resolutor;
  const categoria = solicitud ? CATEGORIAS[solicitud.categoria] : null;
  const estado = solicitud ? ESTADOS_SOLICITUD[solicitud.estado.codigo] : null;

  const alResolver = (resuelta, decidida) => {
    setDecision(null);
    onResuelta(resuelta, decidida, solicitud);
  };

  return (
    <>
      <Modal
        abierto={Boolean(abierta) && !decision}
        titulo={solicitud ? `${categoria.texto} de ${solicitud.empleado.nombre_completo}` : "Solicitud de ausencia"}
        tamano="lg"
        onCerrar={onCerrar}
        pie={
          puedeDecidir ? (
            <>
              <Boton variante="sutil" onClick={onCerrar}>
                Cerrar
              </Boton>
              <Boton variante="peligro" icono={CircleX} onClick={() => setDecision("RECHAZADA")}>
                Rechazar
              </Boton>
              <Boton variante="primario" icono={CircleCheck} onClick={() => setDecision("APROBADA")} disabled={soloRrhh}>
                Aprobar
              </Boton>
            </>
          ) : (
            <Boton onClick={onCerrar} data-autofocus>
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
          <div className="ap-detalle">
            <dl className="ap-datos">
              <div>
                <dt>Estado</dt>
                <dd>
                  <Etiqueta tono={estado.tono} icono={estado.icono}>
                    {estado.texto}
                  </Etiqueta>
                </dd>
              </div>
              <div>
                <dt>Colaborador</dt>
                <dd>
                  {solicitud.empleado.nombre_completo}
                  {solicitud.empleado.cargo && (
                    <span className="ap-sutil">
                      {" "}
                      · {solicitud.empleado.cargo}
                      {solicitud.empleado.area && `, ${solicitud.empleado.area}`}
                      {solicitud.empleado.sucursal && ` (${solicitud.empleado.sucursal})`}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{solicitud.tipo}</dd>
              </div>
              <div>
                <dt>Fechas</dt>
                <dd>
                  {formatearFechaConDia(solicitud.fecha_inicio)} – {formatearFechaConDia(solicitud.fecha_fin)}
                </dd>
              </div>
              <div>
                <dt>Duración</dt>
                <dd>{describirDias(solicitud.dias, solicitud.dias_tipo)}</dd>
              </div>
              <div>
                <dt>Haberes</dt>
                <dd>{solicitud.con_goce_haberes ? "Con goce de haberes" : "Sin goce de haberes"}</dd>
              </div>
              {solicitud.motivo && (
                <div>
                  <dt>Motivo</dt>
                  <dd className="ap-texto">{solicitud.motivo}</dd>
                </div>
              )}
              <div>
                <dt>Presentada</dt>
                <dd>{formatearFechaHora(solicitud.creado_en)}</dd>
              </div>
            </dl>

            {solicitud.requiere_rrhh && pendiente && (
              <Alerta tono="aviso" titulo="Requiere autorización de RRHH">
                {soloRrhh
                  ? "Los días solicitados superan el máximo continuo de esta licencia: usted puede rechazarla, pero solo RRHH puede aprobarla."
                  : "Los días solicitados superan el máximo continuo de esta licencia y necesitan una autorización especial."}
              </Alerta>
            )}

            {solicitud.saldo && (
              <section className="ap-seccion" aria-labelledby="ap-saldo-titulo">
                <h3 id="ap-saldo-titulo" className="ap-seccion__titulo">
                  Saldo de vacaciones
                </h3>
                <dl className="ap-saldo">
                  <div>
                    <dt>Acumulados</dt>
                    <dd>{solicitud.saldo.acumulados}</dd>
                  </div>
                  <div>
                    <dt>Gozados</dt>
                    <dd>{solicitud.saldo.gozados}</dd>
                  </div>
                  <div>
                    <dt>En aprobación</dt>
                    <dd>{solicitud.saldo.en_proceso}</dd>
                  </div>
                  <div>
                    <dt>Disponibles</dt>
                    <dd>{solicitud.saldo.disponibles}</dd>
                  </div>
                </dl>
                <p className="ap-sutil">
                  Los días de esta solicitud ya están retenidos en «En aprobación»; al aprobarla se debitan definitivamente.
                </p>
              </section>
            )}

            {solicitud.categoria === "LICENCIA" && (
              <section className="ap-seccion" aria-labelledby="ap-comprobantes-titulo">
                <h3 id="ap-comprobantes-titulo" className="ap-seccion__titulo">
                  Comprobantes ({solicitud.adjuntos.length})
                </h3>
                <Comprobantes solicitud={solicitud} rol={rol} />
              </section>
            )}

            <section className="ap-seccion" aria-labelledby="ap-cobertura-titulo">
              <h3 id="ap-cobertura-titulo" className="ap-seccion__titulo">
                Impacto en la cobertura del equipo
              </h3>
              <Cobertura cobertura={solicitud.cobertura} aviso={solicitud.aviso_cobertura} />
            </section>

            {solicitud.resolucion && (
              <Alerta
                tono={solicitud.estado.codigo === "APROBADA" ? "exito" : "peligro"}
                titulo={solicitud.estado.codigo === "APROBADA" ? "Solicitud aprobada" : "Solicitud rechazada"}
              >
                <p>
                  Por {solicitud.resolucion.resuelto_por ?? "un supervisor"} el {formatearFechaHora(solicitud.resolucion.resuelto_en)}.
                </p>
                {solicitud.resolucion.motivo && <p className="ap-texto">Motivo: {solicitud.resolucion.motivo}</p>}
              </Alerta>
            )}

            {pendiente && !resolutor && (
              <Alerta tono="aviso" titulo="Identifíquese para decidir">
                Ingrese su identificador de empleado en «Revisa», en esta pantalla, para aprobar o rechazar.
              </Alerta>
            )}
          </div>
        )}
      </Modal>

      <ModalDecision
        key={decision ?? "ninguna"}
        decision={decision}
        solicitud={solicitud}
        rol={rol}
        resolutor={resolutor}
        onCancelar={() => setDecision(null)}
        onResuelta={alResolver}
      />
    </>
  );
}

import { X } from "lucide-react";
import { Alerta, Boton, Etiqueta, Tarjeta } from "../../components/ui";
import { formatearFecha, TONO_ESTADO } from "./reglas";

const formatearMomento = (iso) =>
  new Intl.DateTimeFormat("es-BO", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));

// Detalle histórico de una solicitud: es el destino de las alertas de resultado (RF-34).
export default function DetalleSolicitud({ solicitud, onCerrar, ref }) {
  const rechazada = solicitud.estado_codigo === "RECHAZADA";

  return (
    <Tarjeta
      ref={ref}
      tabIndex={-1}
      titulo={`Detalle de la solicitud: ${solicitud.tipo_nombre}`}
      nivelTitulo={2}
      className="licencias-tarjeta licencias-detalle"
      acciones={
        <Boton variante="sutil" tamano="sm" soloIcono icono={X} aria-label="Cerrar detalle" onClick={onCerrar} />
      }
    >
      <dl className="licencias-detalle__datos">
        <div>
          <dt>Estado</dt>
          <dd>
            <Etiqueta tono={TONO_ESTADO[solicitud.estado_codigo] ?? "neutral"}>{solicitud.estado_nombre}</Etiqueta>
          </dd>
        </div>
        <div>
          <dt>Fechas</dt>
          <dd>
            {formatearFecha(solicitud.fecha_inicio)} – {formatearFecha(solicitud.fecha_fin)} ({solicitud.dias_solicitados}{" "}
            día(s))
          </dd>
        </div>
        <div>
          <dt>Haberes</dt>
          <dd>{solicitud.es_con_goce_haberes ? "Con goce" : "Sin goce"}</dd>
        </div>
        {solicitud.resuelto_en && (
          <div>
            <dt>Resuelta el</dt>
            <dd>{formatearMomento(solicitud.resuelto_en)}</dd>
          </div>
        )}
        {solicitud.motivo && (
          <div>
            <dt>Motivo de la solicitud</dt>
            <dd className="licencias-detalle__texto">{solicitud.motivo}</dd>
          </div>
        )}
      </dl>

      {/* Criterio 2: la justificación del rechazo se lee completa y con claridad. */}
      {rechazada && (
        <Alerta tono="peligro" titulo="Justificación del rechazo">
          <p className="licencias-detalle__texto">{solicitud.motivo_resolucion ?? "El supervisor no registró una justificación."}</p>
        </Alerta>
      )}
      {!rechazada && solicitud.motivo_resolucion && (
        <Alerta tono="info" titulo="Observación del supervisor">
          <p className="licencias-detalle__texto">{solicitud.motivo_resolucion}</p>
        </Alerta>
      )}
    </Tarjeta>
  );
}

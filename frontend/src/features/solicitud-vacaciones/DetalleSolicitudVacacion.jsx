import { X } from "lucide-react";
import { Alerta, Boton, Etiqueta, Tarjeta } from "../../components/ui";
import { ESTADOS, formatearPeriodo, plural } from "./formato";

const formatearMomento = (iso) =>
  new Intl.DateTimeFormat("es-BO", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));

// Detalle de una solicitud de vacaciones: es el destino de las alertas de resultado (RF-34).
export default function DetalleSolicitudVacacion({ solicitud, onCerrar, ref }) {
  const rechazada = solicitud.estado_codigo === "RECHAZADA";
  const estado = ESTADOS[solicitud.estado_codigo] ?? { tono: "neutral", texto: solicitud.estado_nombre };

  return (
    <Tarjeta
      ref={ref}
      tabIndex={-1}
      titulo="Detalle de la solicitud de vacaciones"
      nivelTitulo={2}
      className="solicitud-vacaciones-tarjeta"
      acciones={<Boton variante="sutil" tamano="sm" soloIcono icono={X} aria-label="Cerrar detalle" onClick={onCerrar} />}
    >
      <dl className="solicitud-vacaciones-detalle">
        <div>
          <dt>Estado</dt>
          <dd>
            <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
          </dd>
        </div>
        <div>
          <dt>Periodo</dt>
          <dd>
            {formatearPeriodo(solicitud.fecha_inicio, solicitud.fecha_fin)} ({plural(solicitud.dias_habiles, "día hábil", "días hábiles")})
          </dd>
        </div>
        <div>
          <dt>Enviada el</dt>
          <dd>{formatearMomento(solicitud.creado_en)}</dd>
        </div>
        {solicitud.resuelto_en && (
          <div>
            <dt>Resuelta el</dt>
            <dd>{formatearMomento(solicitud.resuelto_en)}</dd>
          </div>
        )}
      </dl>

      {rechazada && (
        <Alerta tono="peligro" titulo="Justificación del rechazo">
          <p className="solicitud-vacaciones-detalle__texto">
            {solicitud.motivo_resolucion ?? "El supervisor no registró una justificación."}
          </p>
        </Alerta>
      )}
      {!rechazada && solicitud.motivo_resolucion && (
        <Alerta tono="info" titulo="Observación del supervisor">
          <p className="solicitud-vacaciones-detalle__texto">{solicitud.motivo_resolucion}</p>
        </Alerta>
      )}
    </Tarjeta>
  );
}

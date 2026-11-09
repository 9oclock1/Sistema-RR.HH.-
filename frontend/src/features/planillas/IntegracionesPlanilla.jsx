import { Banknote, Calculator, CircleCheck, CircleX, Clock, Hourglass, RotateCw, Send, TriangleAlert } from "lucide-react";
import { Boton, Etiqueta } from "../../components/ui";
import { formatearMomento } from "../condiciones/formato";

const DESTINOS = [
  { clave: "contabilidad", nombre: "Contabilidad", detalle: "Asiento contable de la planilla", icono: Calculator },
  { clave: "pagos", nombre: "Pagos", detalle: "Orden de pago a los colaboradores", icono: Banknote },
];

// Estado visible de una integración: primero la respuesta del sistema, después el envío. Siempre con texto e
// ícono, no solo color.
function estadoIntegracion(integracion) {
  const { estado, envio } = integracion;
  if (estado === "CONFIRMADA") {
    const cuando = integracion.respondida_en ? formatearMomento(integracion.respondida_en) : null;
    return {
      tono: "exito",
      icono: CircleCheck,
      etiqueta: "Confirmada",
      nota: [integracion.referencia && `Referencia ${integracion.referencia}`, cuando && `Confirmada el ${cuando}`]
        .filter(Boolean)
        .join(" · "),
    };
  }
  if (estado === "RECHAZADA") {
    return { tono: "peligro", icono: CircleX, etiqueta: "Rechazada", nota: `Motivo: ${integracion.motivo}`, reenviar: true };
  }
  if (envio?.estado === "FALLIDO") {
    return {
      tono: "peligro",
      icono: TriangleAlert,
      etiqueta: "Envío fallido",
      nota: `${envio.ultimo_error ?? "Pub/Sub rechazó el mensaje"}. Corrija la configuración y vuelva a enviarlo.`,
      reenviar: true,
    };
  }
  if (envio?.estado === "ENTREGADO") {
    return {
      tono: "info",
      icono: Hourglass,
      etiqueta: "Esperando confirmación",
      nota: `Enviada el ${formatearMomento(envio.entregado_en)}`,
    };
  }
  if (envio?.intentos > 0) {
    return {
      tono: "aviso",
      icono: RotateCw,
      etiqueta: "Reintentando el envío",
      nota: `${envio.ultimo_error ?? "No se pudo enviar"}. Se volverá a intentar${
        envio.proximo_intento_en ? ` el ${formatearMomento(envio.proximo_intento_en)}` : ""
      }; no se pierde.`,
    };
  }
  return { tono: "neutral", icono: Clock, etiqueta: "En cola de envío", nota: "Se enviará en unos segundos." };
}

// Criterio 4: estado de cada integración de la planilla aprobada.
export default function IntegracionesPlanilla({ planilla, reenviando, puedeReenviar, onReenviar }) {
  const cerrada = planilla.estado === "CERRADA";
  return (
    <section className="planilla-integraciones" aria-labelledby="planilla-integraciones-titulo">
      <div className="planilla-integraciones__encabezado">
        <h2 id="planilla-integraciones-titulo" className="planilla-detalle__titulo">
          Integraciones
        </h2>
        <p className="conceptos-nota">
          {cerrada
            ? `Contabilidad y Pagos confirmaron: planilla cerrada el ${formatearMomento(planilla.cerrada_en)}`
            : "La planilla se cierra cuando Contabilidad y Pagos confirman. El estado se actualiza solo."}
        </p>
      </div>
      <ul className="planilla-integraciones__lista" aria-live="polite">
        {DESTINOS.map(({ clave, nombre, detalle, icono: Icono }) => {
          const estado = estadoIntegracion(planilla.integraciones[clave]);
          return (
            <li key={clave} className="planilla-integracion">
              <div className="planilla-integracion__cabecera">
                <Icono className="ds-icono planilla-integracion__icono" aria-hidden="true" />
                <div className="planilla-integracion__nombre">
                  <strong>{nombre}</strong>
                  <span className="conceptos-nota">{detalle}</span>
                </div>
                <Etiqueta tono={estado.tono} icono={estado.icono}>
                  {estado.etiqueta}
                </Etiqueta>
              </div>
              {estado.nota && <p className="planilla-integracion__nota">{estado.nota}</p>}
              {estado.reenviar && !cerrada && (
                <Boton
                  tamano="sm"
                  icono={Send}
                  className="planilla-integracion__accion"
                  cargando={reenviando === clave}
                  disabled={!puedeReenviar || Boolean(reenviando)}
                  onClick={() => onReenviar(clave)}
                  aria-label={`Reenviar a ${nombre}`}
                >
                  Reenviar
                </Boton>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

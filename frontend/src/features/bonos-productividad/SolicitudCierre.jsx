import { useEffect, useState } from "react";
import { CircleCheck, CircleX, Clock, RotateCw, Send } from "lucide-react";
import { obtenerSolicitudCierre, solicitarCierreVentas } from "../../api/bonosProductividad";
import { Alerta, Boton, Etiqueta, useAvisos } from "../../components/ui";
import { useRol, useUsuario } from "../../context/sesion";
import { formatearMes, formatearMomento } from "./formato";

const INTERVALO_MS = 3000;

function estadoEnvio(solicitud) {
  if (!solicitud) return null;
  if (solicitud.estado === "ENTREGADO") {
    return {
      tono: "exito",
      icono: CircleCheck,
      etiqueta: "Enviada a Ventas",
      nota: `Publicada en Pub/Sub el ${formatearMomento(solicitud.entregado_en)} · mensaje ${solicitud.id_mensaje}`,
    };
  }
  if (solicitud.estado === "FALLIDO") {
    return {
      tono: "peligro",
      icono: CircleX,
      etiqueta: "Envío fallido",
      nota: `${solicitud.ultimo_error ?? "Pub/Sub rechazó el mensaje"}. Puede volver a solicitarla.`,
    };
  }
  if (solicitud.intentos > 0) {
    return {
      tono: "aviso",
      icono: RotateCw,
      etiqueta: "Reintentando el envío",
      nota: `${solicitud.ultimo_error ?? "No se pudo enviar"}. Se volverá a intentar${
        solicitud.proximo_intento_en ? ` el ${formatearMomento(solicitud.proximo_intento_en)}` : ""
      }; no se pierde.`,
    };
  }
  return { tono: "neutral", icono: Clock, etiqueta: "En cola de envío", nota: "Se publicará en unos segundos." };
}

export default function SolicitudCierre({ periodo, valido }) {
  const avisar = useAvisos();
  const rol = useRol();
  const idEmpleado = useUsuario();
  const [carga, setCarga] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!valido) return undefined;
    let vigente = true;
    obtenerSolicitudCierre(periodo)
      .then((respuesta) => vigente && setCarga(respuesta))
      .catch(() => vigente && setCarga({ periodo, solicitud: null }));
    return () => {
      vigente = false;
    };
  }, [periodo, valido]);

  const solicitud = carga?.periodo === periodo ? carga.solicitud : null;
  const pendiente = solicitud?.estado === "PENDIENTE";

  useEffect(() => {
    if (!pendiente) return undefined;
    const temporizador = setInterval(() => {
      obtenerSolicitudCierre(periodo)
        .then((respuesta) => setCarga((previa) => (previa?.periodo === respuesta.periodo ? respuesta : previa)))
        .catch(() => {});
    }, INTERVALO_MS);
    return () => clearInterval(temporizador);
  }, [pendiente, periodo]);

  const enviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      setCarga(await solicitarCierreVentas(periodo, { idEmpleado, rol }));
      avisar({
        tono: "exito",
        titulo: "Solicitud en cola de envío",
        mensaje: `Cierre de ventas de ${formatearMes(periodo)} para Ventas y Marketing`,
      });
    } catch (e) {
      setError({ periodo, mensaje: e.message });
    } finally {
      setEnviando(false);
    }
  };

  const estado = estadoEnvio(solicitud);
  const errorDelMes = error?.periodo === periodo ? error.mensaje : null;

  return (
    <>
      <div className="conceptos-filtros condiciones-periodo" aria-live="polite">
        <Boton
          icono={Send}
          cargando={enviando}
          disabled={!valido || !idEmpleado || enviando || pendiente}
          onClick={enviar}
        >
          Solicitar cierre de ventas
        </Boton>
        {estado && (
          <Etiqueta tono={estado.tono} icono={estado.icono}>
            {estado.etiqueta}
          </Etiqueta>
        )}
        <span className="conceptos-nota">
          {estado?.nota ??
            (idEmpleado
              ? "Pide por Pub/Sub a Ventas y Marketing (grupo E) el cierre de ventas del mes; su respuesta se procesa sola."
              : "Elija su usuario de prueba en la barra superior para solicitar el cierre.")}
        </span>
      </div>
      {errorDelMes && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo solicitar el cierre" onCerrar={() => setError(null)}>
          {errorDelMes}
        </Alerta>
      )}
    </>
  );
}

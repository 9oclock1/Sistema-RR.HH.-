import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { reintentarSolicitudCrm } from "../../api/desempenoGlobal";
import { Alerta, Boton, useAvisos } from "../../components/ui";
import { formatearMomento } from "../ciclos-evaluacion/ciclo";
import { estadoSolicitudCrm } from "./desempenoGlobal";

// Estado de la solicitud de métricas que el cierre del ciclo publica para el CRM (CA2) y de lo que ya respondió.
// El administrador puede volver a intentarla si la publicación falló.
export default function SolicitudCrm({ rol, esAdmin, idCiclo, crm, alCambiar }) {
  const avisar = useAvisos();
  const [reintentando, setReintentando] = useState(false);
  const { solicitud, metricas_recibidas: recibidas, colaboradores_con_metricas: conMetricas } = crm;

  async function reintentar() {
    setReintentando(true);
    try {
      await reintentarSolicitudCrm(rol, idCiclo);
      avisar({ tono: "exito", titulo: "Solicitud en cola", mensaje: "Se publicará en unos segundos." });
      alCambiar();
    } catch (falla) {
      avisar({ tono: "peligro", titulo: "No se pudo reintentar la solicitud", mensaje: falla.message });
    } finally {
      setReintentando(false);
    }
  }

  if (!solicitud) {
    return (
      <Alerta tono="info" titulo="Sin solicitud de métricas al CRM">
        Este ciclo no tiene una solicitud de métricas del CRM registrada.
      </Alerta>
    );
  }

  const estado = estadoSolicitudCrm(solicitud.estado);
  const titulo = `Solicitud de métricas al CRM: ${estado.texto}`;

  if (solicitud.estado === "ENTREGADO") {
    return (
      <Alerta tono="exito" titulo={titulo}>
        Se publicó el {formatearMomento(solicitud.entregado_en)} con el periodo y los colaboradores de atención al cliente y cajas.{" "}
        {recibidas > 0
          ? `El CRM ya respondió con las métricas de ${conMetricas} colaborador(es).`
          : "La respuesta del CRM es asíncrona: aún no llegaron las métricas."}
      </Alerta>
    );
  }

  if (solicitud.estado === "FALLIDO") {
    return (
      <Alerta
        tono="peligro"
        role="alert"
        titulo={titulo}
        acciones={
          esAdmin ? (
            <Boton tamano="sm" icono={RotateCcw} cargando={reintentando} onClick={reintentar}>
              Reintentar publicación
            </Boton>
          ) : null
        }
      >
        No se pudo publicar tras {solicitud.intentos} intento(s){solicitud.ultimo_error ? `: ${solicitud.ultimo_error}.` : "."} El consolidado
        sigue disponible sin las métricas del CRM.
      </Alerta>
    );
  }

  if (solicitud.estado === "OMITIDO") {
    return (
      <Alerta tono="info" titulo={titulo}>
        {solicitud.ultimo_error ?? "El ciclo no tiene colaboradores a quienes el CRM les mida métricas."}
      </Alerta>
    );
  }

  return (
    <Alerta tono="info" titulo={titulo}>
      Se publica poco después de cerrar el ciclo.{solicitud.ultimo_error ? ` Último intento: ${solicitud.ultimo_error}.` : ""}
    </Alerta>
  );
}

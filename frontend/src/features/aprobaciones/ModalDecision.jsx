import { useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { resolverAprobacion } from "../../api/aprobaciones";
import { Alerta, Boton, CampoAreaTexto, Modal } from "../../components/ui";
import { formatearFecha } from "../solicitud-vacaciones/formato";
import { describirDias } from "./formato";

const MAX_MOTIVO = 500;

// Confirma la decisión sobre una solicitud. Aprobar pide confirmación; rechazar exige la justificación,
// que el colaborador leerá en su alerta (KAN-54). Quien lo usa le da una `key` distinta por decisión para partir limpio.
export default function ModalDecision({ decision, solicitud, rol, resolutor, onCancelar, onResuelta }) {
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState(null);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const refMotivo = useRef(null);
  const refError = useRef(null);

  const rechazo = decision === "RECHAZADA";

  useEffect(() => {
    if (errorGeneral) refError.current?.focus();
  }, [errorGeneral]);

  const confirmar = async () => {
    setErrorGeneral(null);
    if (rechazo && !motivo.trim()) {
      setErrorMotivo("Escriba el motivo del rechazo: el colaborador lo leerá.");
      refMotivo.current?.focus();
      return;
    }
    setProcesando(true);
    try {
      const resuelta = await resolverAprobacion(rol, resolutor.id, solicitud.categoria, solicitud.id_solicitud, {
        decision,
        motivo: motivo.trim(),
      });
      onResuelta(resuelta, decision);
    } catch (error) {
      const deCampo = error.detalles?.find((d) => d.campo === "motivo");
      if (deCampo) {
        setErrorMotivo(deCampo.mensaje);
        refMotivo.current?.focus();
      } else {
        setErrorGeneral(error.message);
      }
    } finally {
      setProcesando(false);
    }
  };

  const nombre = solicitud?.empleado.nombre_completo ?? "el colaborador";

  return (
    <Modal
      abierto={Boolean(decision)}
      titulo={rechazo ? "Rechazar solicitud" : "Aprobar solicitud"}
      tamano="sm"
      onCerrar={onCancelar}
      bloqueado={procesando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCancelar} disabled={procesando} data-autofocus={rechazo ? undefined : true}>
            Cancelar
          </Boton>
          <Boton
            variante={rechazo ? "peligro" : "primario"}
            icono={rechazo ? CircleX : CircleCheck}
            onClick={confirmar}
            cargando={procesando}
          >
            {rechazo ? "Confirmar rechazo" : "Confirmar aprobación"}
          </Boton>
        </>
      }
    >
      {solicitud && (
        <div className="ap-decision">
          <p>
            {rechazo ? "Va a rechazar" : "Va a aprobar"} la solicitud de <strong>{nombre}</strong>:{" "}
            {solicitud.tipo.toLowerCase()} del {formatearFecha(solicitud.fecha_inicio)} al{" "}
            {formatearFecha(solicitud.fecha_fin)} ({describirDias(solicitud.dias, solicitud.dias_tipo)}).
          </p>
          {rechazo ? (
            <p className="ap-sutil">Se liberarán los días retenidos y se avisará al colaborador con su justificación.</p>
          ) : (
            <p className="ap-sutil">
              {solicitud.categoria === "VACACIONES"
                ? "Los días se debitarán definitivamente del saldo. "
                : ""}
              Se informará la indisponibilidad a Producción o Entregas según el área, y se avisará al colaborador.
            </p>
          )}

          {errorGeneral && (
            <Alerta ref={refError} tabIndex={-1} tono="peligro" role="alert" titulo="No se pudo registrar la decisión">
              {errorGeneral}
            </Alerta>
          )}

          {rechazo && (
            <CampoAreaTexto
              ref={refMotivo}
              id="ap-motivo-rechazo"
              etiqueta="Motivo del rechazo"
              requerido
              filas={4}
              maxLength={MAX_MOTIVO}
              value={motivo}
              onChange={(evento) => {
                setMotivo(evento.target.value);
                if (errorMotivo) setErrorMotivo(null);
              }}
              error={errorMotivo}
              ayuda={`${motivo.length} de ${MAX_MOTIVO} caracteres.`}
              disabled={procesando}
              data-autofocus
            />
          )}
        </div>
      )}
    </Modal>
  );
}

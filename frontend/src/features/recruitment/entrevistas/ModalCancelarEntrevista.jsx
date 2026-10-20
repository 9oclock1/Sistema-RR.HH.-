import { useState } from "react";
import { Alerta, Boton, CampoAreaTexto, Modal } from "../../../components/ui";
import { cancelarEntrevista } from "../../../api/entrevistas";
import { MAX_MOTIVO, formatearCita } from "./reglasEntrevista";

const errorDeCampo = (error, campo) => error?.errores?.find((e) => e.campo === campo)?.mensaje;

// RF-15: cancela una entrevista vigente; el motivo es obligatorio porque se incluye en el correo al candidato.
export default function ModalCancelarEntrevista({ entrevista, sesion, onCancelada, onVolver }) {
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);

  const confirmar = async (evento) => {
    evento.preventDefault();
    if (!motivo.trim()) {
      setError({ errores: [{ campo: "motivo", mensaje: "Indique el motivo de la cancelación; se incluye en el correo al candidato." }] });
      return;
    }
    setProcesando(true);
    setError(null);
    try {
      onCancelada(await cancelarEntrevista(entrevista.id_entrevista, motivo.trim(), sesion));
    } catch (falla) {
      setError(falla);
      setProcesando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo="Cancelar entrevista"
      onCerrar={onVolver}
      bloqueado={procesando}
      pie={
        <>
          <Boton variante="sutil" onClick={onVolver} disabled={procesando}>
            Volver
          </Boton>
          <Boton type="submit" form="en-form-cancelar" variante="peligro" cargando={procesando}>
            Cancelar entrevista
          </Boton>
        </>
      }
    >
      <form id="en-form-cancelar" className="pl-formulario" onSubmit={confirmar} noValidate>
        <p className="pl-texto">
          Se cancelará la entrevista del <strong>{formatearCita(entrevista)}</strong> con {entrevista.nombre_entrevistador}.
        </p>
        <CampoAreaTexto
          etiqueta="Motivo"
          requerido
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={MAX_MOTIVO}
          filas={3}
          ayuda={`${motivo.length}/${MAX_MOTIVO} caracteres. Se incluye en el correo al candidato.`}
          error={errorDeCampo(error, "motivo")}
          data-autofocus
        />
        {error && !error.errores?.length && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo cancelar la entrevista">
            {error.message}
          </Alerta>
        )}
      </form>
    </Modal>
  );
}

import { useState } from "react";
import { Alerta, Boton, CampoTexto, Modal, Selector } from "../../components/ui";

const ID_FORMULARIO = "simular-confirmacion-formulario";

const OPCIONES_RESULTADO = [
  { valor: "CONFIRMADA", etiqueta: "Confirmada" },
  { valor: "RECHAZADA", etiqueta: "Rechazada" },
];

// Contabilidad y Pagos no existen en este sistema: en vez de esperar su respuesta de verdad, se simula
// desde aquí. Se publica igual en Pub/Sub y se recibe por la suscripción real, con el mismo efecto que una
// confirmación genuina (RF-47, criterio 4).
export default function SimularConfirmacionModal({ nombreDestino, onConfirmar, onCerrar }) {
  const [resultado, setResultado] = useState("CONFIRMADA");
  const [referencia, setReferencia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const enviar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar({ resultado, referencia: referencia.trim() || undefined, motivo: motivo.trim() || undefined });
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo={`Simular confirmación de ${nombreDestino}`}
      onCerrar={onCerrar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form={ID_FORMULARIO} cargando={enviando}>
            {enviando ? "Enviando…" : "Simular respuesta"}
          </Boton>
        </>
      }
    >
      <form id={ID_FORMULARIO} className="concepto-formulario" onSubmit={enviar} noValidate>
        <p className="concepto-nota">
          {nombreDestino} no está implementado en este sistema: esto publica en Pub/Sub la misma respuesta que
          enviaría de verdad. Se aplicará en unos segundos, cuando RRHH la reciba por su suscripción.
        </p>
        {error && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo aplicar la simulación">
            {error}
          </Alerta>
        )}
        <Selector
          id="simular-resultado"
          etiqueta="Resultado"
          value={resultado}
          onChange={(evento) => setResultado(evento.target.value)}
          opciones={OPCIONES_RESULTADO}
          data-autofocus
        />
        {resultado === "CONFIRMADA" ? (
          <CampoTexto
            id="simular-referencia"
            etiqueta="Referencia (opcional)"
            value={referencia}
            onChange={(evento) => setReferencia(evento.target.value)}
            maxLength={60}
            ayuda="Por ejemplo, el número de asiento o de orden de pago."
          />
        ) : (
          <CampoTexto
            id="simular-motivo"
            etiqueta="Motivo del rechazo"
            requerido
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            maxLength={255}
          />
        )}
      </form>
    </Modal>
  );
}

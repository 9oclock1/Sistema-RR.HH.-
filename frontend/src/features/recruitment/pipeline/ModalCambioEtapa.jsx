import { useState } from "react";
import { Alerta, Boton, CampoAreaTexto, Etiqueta, Modal, Selector } from "../../../components/ui";
import { CODIGO_ETAPA, nombreCompleto, tonoEtapa } from "./reglas";

const MAX_MOTIVO = 1000;

const errorDeCampo = (error, campo) => error?.errores?.find((e) => e.campo === campo)?.mensaje;

/**
 * RF-14: confirma el cambio de etapa de un postulante. El destino llega elegido al soltar la tarjeta en una columna
 * o se elige aquí (botón «Mover»). Al rechazar se pide un motivo opcional. Contratar se formaliza en su propio
 * modal (ModalContratacion): al elegir «Contratado» se pasa a él.
 */
export default function ModalCambioEtapa({ postulacion, destinos, idDestinoInicial, onCerrar, onConfirmar, onFormalizar }) {
  const [idDestino, setIdDestino] = useState(idDestinoInicial ? String(idDestinoInicial) : "");
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);

  const destino = destinos.find((d) => String(d.id_etapa) === idDestino);
  const rechazo = destino?.codigo === CODIGO_ETAPA.RECHAZADO;

  const elegirDestino = (evento) => {
    const elegido = destinos.find((d) => String(d.id_etapa) === evento.target.value);
    if (elegido?.codigo === CODIGO_ETAPA.CONTRATADO) {
      onFormalizar(elegido.id_etapa);
      return;
    }
    setIdDestino(evento.target.value);
  };

  const confirmar = async (evento) => {
    evento.preventDefault();
    if (!destino) return;
    setProcesando(true);
    setError(null);
    try {
      await onConfirmar({ id_etapa: destino.id_etapa, ...(motivo.trim() && { motivo: motivo.trim() }) });
    } catch (falla) {
      setError(falla);
      setProcesando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo="Cambiar etapa"
      onCerrar={onCerrar}
      bloqueado={procesando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCerrar} disabled={procesando}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            form="pl-form-cambio"
            variante={rechazo ? "peligro" : "primario"}
            cargando={procesando}
            disabled={!destino}
          >
            {rechazo ? "Rechazar" : "Cambiar etapa"}
          </Boton>
        </>
      }
    >
      <form id="pl-form-cambio" className="pl-formulario" onSubmit={confirmar} noValidate>
        <p className="pl-cambio">
          <strong>{nombreCompleto(postulacion)}</strong>
          <span className="pl-sutil">pasa de</span>
          <Etiqueta tono={tonoEtapa(postulacion.codigo_etapa)}>{postulacion.nombre_etapa}</Etiqueta>
          {destino && (
            <>
              <span className="pl-sutil">a</span>
              <Etiqueta tono={tonoEtapa(destino.codigo)}>{destino.nombre}</Etiqueta>
            </>
          )}
        </p>

        <Selector
          etiqueta="Nueva etapa"
          requerido
          value={idDestino}
          onChange={elegirDestino}
          textoVacio="Seleccione la etapa"
          opciones={destinos.map((d) => ({
            valor: String(d.id_etapa),
            etiqueta: d.codigo === CODIGO_ETAPA.CONTRATADO ? `${d.nombre} (formalizar contratación)` : d.nombre,
          }))}
          error={errorDeCampo(error, "id_etapa")}
          data-autofocus={idDestinoInicial ? undefined : true}
        />

        <CampoAreaTexto
          etiqueta={destino?.solicita_motivo ? "Motivo (opcional)" : "Comentario (opcional)"}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={MAX_MOTIVO}
          filas={3}
          ayuda={`${motivo.length}/${MAX_MOTIVO} caracteres. Queda en el historial del postulante.`}
          error={errorDeCampo(error, "motivo")}
          data-autofocus={idDestinoInicial ? true : undefined}
        />

        {rechazo && (
          <Alerta tono="aviso">
            La postulación se archivará y se notificará el cierre del proceso. Este cambio no se puede deshacer.
          </Alerta>
        )}
        {error && !error.errores?.length && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo cambiar la etapa">
            {error.message}
          </Alerta>
        )}
      </form>
    </Modal>
  );
}

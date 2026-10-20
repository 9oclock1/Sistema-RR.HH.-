import { useState } from "react";
import { Alerta, Boton, CampoAreaTexto, Etiqueta, Modal, Selector } from "../../../components/ui";
import { CODIGO_ETAPA, nombreCompleto, tonoEtapa } from "./reglas";

const MAX_MOTIVO = 1000;

const errorDeCampo = (error, campo) => error?.errores?.find((e) => e.campo === campo)?.mensaje;

/**
 * RF-14: confirma el cambio de etapa de un postulante. El destino llega elegido al soltar la tarjeta en una columna
 * o se elige aquí (botón «Mover»). Al rechazar se pide un motivo opcional; al contratar, el cargo operativo.
 */
export default function ModalCambioEtapa({ postulacion, destinos, idDestinoInicial, cargos, onCerrar, onConfirmar }) {
  const [idDestino, setIdDestino] = useState(idDestinoInicial ? String(idDestinoInicial) : "");
  const [motivo, setMotivo] = useState("");
  const [idCargo, setIdCargo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);

  const destino = destinos.find((d) => String(d.id_etapa) === idDestino);
  const cargo = cargos.find((c) => String(c.id_cargo_operativo) === idCargo);
  const rechazo = destino?.codigo === CODIGO_ETAPA.RECHAZADO;
  const faltaCargo = destino?.requiere_cargo && !idCargo;

  const confirmar = async (evento) => {
    evento.preventDefault();
    if (!destino || faltaCargo) return;
    setProcesando(true);
    setError(null);
    try {
      await onConfirmar({
        id_etapa: destino.id_etapa,
        ...(motivo.trim() && { motivo: motivo.trim() }),
        ...(destino.requiere_cargo && { id_cargo_operativo: Number(idCargo) }),
      });
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
            disabled={!destino || faltaCargo}
          >
            {rechazo ? "Rechazar" : destino?.codigo === CODIGO_ETAPA.CONTRATADO ? "Contratar" : "Cambiar etapa"}
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
          onChange={(e) => setIdDestino(e.target.value)}
          textoVacio="Seleccione la etapa"
          opciones={destinos.map((d) => ({ valor: String(d.id_etapa), etiqueta: d.nombre }))}
          error={errorDeCampo(error, "id_etapa")}
          data-autofocus={idDestinoInicial ? undefined : true}
        />

        {destino?.requiere_cargo && (
          <Selector
            etiqueta="Cargo operativo"
            requerido
            value={idCargo}
            onChange={(e) => setIdCargo(e.target.value)}
            textoVacio="Seleccione el cargo"
            opciones={cargos.map((c) => ({ valor: String(c.id_cargo_operativo), etiqueta: c.nombre }))}
            ayuda={cargo ? `Sus datos se enviarán a ${cargo.nombre_modulo}.` : undefined}
            error={errorDeCampo(error, "id_cargo_operativo")}
            data-autofocus={idDestinoInicial ? true : undefined}
          />
        )}

        <CampoAreaTexto
          etiqueta={destino?.solicita_motivo ? "Motivo (opcional)" : "Comentario (opcional)"}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={MAX_MOTIVO}
          filas={3}
          ayuda={`${motivo.length}/${MAX_MOTIVO} caracteres. Queda en el historial del postulante.`}
          error={errorDeCampo(error, "motivo")}
          data-autofocus={idDestinoInicial && !destino?.requiere_cargo ? true : undefined}
        />

        {destino?.codigo === CODIGO_ETAPA.CONTRATADO && (
          <Alerta tono="info">
            Al confirmar se envía el alta del colaborador a Contabilidad y al módulo operativo de su cargo. Este cambio
            cierra el proceso de selección y no se puede deshacer.
          </Alerta>
        )}
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

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import Boton from "./Boton";
import "./Modal.css";

export default function Modal({
  abierto,
  titulo,
  onCerrar,
  pie,
  tamano = "md",
  bloqueado = false,
  cerrarAlClicFuera = false,
  children,
}) {
  const ref = useRef(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (abierto && !dialogo.open) {
      dialogo.showModal();
      dialogo.querySelector("[data-autofocus]")?.focus();
    }
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  const cerrar = (evento) => {
    evento?.preventDefault();
    if (!bloqueado) onCerrar();
  };

  const alHacerClic = (evento) => {
    if (cerrarAlClicFuera && evento.target === ref.current) cerrar();
  };

  return (
    <dialog
      ref={ref}
      className={`ds-modal ds-modal--${tamano}`}
      aria-labelledby={idTitulo}
      onCancel={cerrar}
      onClick={alHacerClic}
    >
      <div className="ds-modal__encabezado">
        <h2 id={idTitulo} className="ds-modal__titulo">
          {titulo}
        </h2>
        <Boton variante="sutil" soloIcono icono={X} aria-label="Cerrar" onClick={cerrar} disabled={bloqueado} />
      </div>
      <div className="ds-modal__cuerpo">{children}</div>
      {pie && <div className="ds-modal__pie">{pie}</div>}
    </dialog>
  );
}

// Confirmación obligatoria antes de una acción destructiva. El foco inicial queda en Cancelar.
export function ModalConfirmacion({
  abierto,
  titulo,
  textoConfirmar,
  textoCancelar = "Cancelar",
  variante = "peligro",
  procesando = false,
  onConfirmar,
  onCancelar,
  children,
}) {
  return (
    <Modal
      abierto={abierto}
      titulo={titulo}
      onCerrar={onCancelar}
      bloqueado={procesando}
      tamano="sm"
      pie={
        <>
          <Boton variante="sutil" onClick={onCancelar} disabled={procesando} data-autofocus>
            {textoCancelar}
          </Boton>
          <Boton variante={variante} onClick={onConfirmar} cargando={procesando}>
            {textoConfirmar}
          </Boton>
        </>
      }
    >
      {children}
    </Modal>
  );
}

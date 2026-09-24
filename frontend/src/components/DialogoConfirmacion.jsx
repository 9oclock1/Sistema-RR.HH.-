import { useEffect, useId, useRef } from "react";

export default function DialogoConfirmacion({
  abierto,
  titulo,
  children,
  textoConfirmar,
  textoProcesando,
  procesando,
  onConfirmar,
  onCancelar,
}) {
  const ref = useRef(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  const cancelar = (evento) => {
    evento.preventDefault();
    if (!procesando) onCancelar();
  };

  return (
    <dialog ref={ref} className="dialogo" aria-labelledby={idTitulo} onCancel={cancelar}>
      <h2 id={idTitulo}>{titulo}</h2>
      <div className="dialogo-cuerpo">{children}</div>
      <div className="dialogo-acciones">
        <button type="button" className="boton" onClick={cancelar} disabled={procesando}>
          Cancelar
        </button>
        <button type="button" className="boton boton-peligro-solido" onClick={onConfirmar} disabled={procesando}>
          {procesando ? textoProcesando : textoConfirmar}
        </button>
      </div>
    </dialog>
  );
}

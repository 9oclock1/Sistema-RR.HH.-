import { useEffect, useRef, useState } from "react";

const ID_CAMPO = "id-empleado";

export default function IdentificacionEmpleado({ error, procesando, enfocar, onIdentificar, onEditar }) {
  const [valor, setValor] = useState("");
  const [errorVacio, setErrorVacio] = useState(false);
  const refCampo = useRef(null);
  const mensajeError = errorVacio ? "Ingrese su identificador de empleado." : error;

  useEffect(() => {
    if (error || enfocar) refCampo.current?.focus();
  }, [error, enfocar]);

  const cambiar = (evento) => {
    setValor(evento.target.value);
    setErrorVacio(false);
    onEditar();
  };

  const enviar = (evento) => {
    evento.preventDefault();
    const idEmpleado = valor.trim();
    if (!idEmpleado) {
      setErrorVacio(true);
      refCampo.current?.focus();
      return;
    }
    onIdentificar(idEmpleado);
  };

  const descripciones = [`${ID_CAMPO}-ayuda`, mensajeError && `${ID_CAMPO}-error`].filter(Boolean).join(" ");

  return (
    <form className="tarjeta marcaje-tarjeta" onSubmit={enviar} noValidate aria-labelledby="identificacion-titulo">
      <h2 id="identificacion-titulo">Identificación</h2>
      <div className="campo">
        <label htmlFor={ID_CAMPO}>Identificador de empleado</label>
        <input
          id={ID_CAMPO}
          ref={refCampo}
          value={valor}
          onChange={cambiar}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={mensajeError ? true : undefined}
          aria-describedby={descripciones}
        />
        <p id={`${ID_CAMPO}-ayuda`} className="campo-ayuda">
          Uso temporal hasta que el sistema cuente con inicio de sesión.
        </p>
        {mensajeError && (
          <p id={`${ID_CAMPO}-error`} className="campo-error">
            {mensajeError}
          </p>
        )}
      </div>
      <button type="submit" className="boton boton-primario" disabled={procesando}>
        {procesando ? "Verificando…" : "Continuar"}
      </button>
    </form>
  );
}

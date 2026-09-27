import { useEffect, useRef, useState } from "react";
import { Boton, CampoTexto, Tarjeta } from "../../components/ui";

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

  return (
    <Tarjeta titulo="Identificación" nivelTitulo={2} className="marcaje-tarjeta">
      <form className="marcaje-identificacion" onSubmit={enviar} noValidate>
        <CampoTexto
          id="id-empleado"
          ref={refCampo}
          etiqueta="Identificador de empleado"
          ayuda="Uso temporal hasta que el sistema cuente con inicio de sesión."
          error={mensajeError}
          requerido
          value={valor}
          onChange={cambiar}
          autoComplete="off"
          spellCheck={false}
        />
        <Boton variante="primario" type="submit" cargando={procesando}>
          {procesando ? "Verificando…" : "Continuar"}
        </Boton>
      </form>
    </Tarjeta>
  );
}

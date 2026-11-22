import { useEffect, useRef, useState } from "react";
import { Alerta } from "../../components/ui";

// Estado del formulario de desvinculación con errores por campo del backend y alertas de conflicto (409).
export default function useFormulario({ inicial, etiquetas, prefijo, onGuardar }) {
  const [valores, setValores] = useState(inicial);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviosFallidos, setEnviosFallidos] = useState(0);
  const refResumen = useRef(null);
  const idCampo = (campo) => `${prefijo}-${campo}`;

  useEffect(() => {
    if (enviosFallidos) refResumen.current?.focus();
  }, [enviosFallidos]);

  const limpiarErrorCampo = (campo) => {
    setError((actual) => {
      if (!actual?.campos[campo]) return actual;
      const campos = { ...actual.campos };
      delete campos[campo];
      return { ...actual, campos };
    });
  };

  const cambiar = (evento) => {
    const { name, type, value, checked } = evento.target;
    setValores((actuales) => ({ ...actuales, [name]: type === "checkbox" ? checked : value }));
    limpiarErrorCampo(name);
  };

  const establecerCampo = (campo, valor) => {
    setValores((actuales) => ({ ...actuales, [campo]: valor }));
    limpiarErrorCampo(campo);
  };

  const marcarErrores = (campos) => {
    setError({ general: null, campos });
    setEnviosFallidos((total) => total + 1);
  };

  const enviar = async (valoresAEnviar = valores) => {
    setEnviando(true);
    setError(null);
    try {
      await onGuardar(valoresAEnviar);
      setEnviando(false);
    } catch (errorGuardado) {
      const campos = Object.fromEntries((errorGuardado.detalles ?? []).map((d) => [d.campo, d.mensaje]));
      const esConflicto = errorGuardado.estado === 409;
      setError({
        general: esConflicto || !Object.keys(campos).length ? errorGuardado.message : null,
        campos,
      });
      setEnviosFallidos((total) => total + 1);
      setEnviando(false);
      throw errorGuardado;
    }
  };

  const propsCampo = (campo) => ({
    id: idCampo(campo),
    name: campo,
    etiqueta: etiquetas[campo],
    value: valores[campo],
    onChange: cambiar,
    error: error?.campos[campo],
  });

  const enfocar = (evento, campo) => {
    evento.preventDefault();
    document.getElementById(idCampo(campo))?.focus();
  };

  const orden = Object.keys(etiquetas);
  const erroresCampos = Object.entries(error?.campos ?? {}).sort(([a], [b]) => orden.indexOf(a) - orden.indexOf(b));
  const resumen = (Boolean(error?.general) || erroresCampos.length > 0) && (
    <Alerta
      ref={refResumen}
      tabIndex={-1}
      tono="peligro"
      role="alert"
      titulo={error.general ?? "Revise los campos marcados."}
    >
      {!error.general && erroresCampos.length > 0 && (
        <ul>
          {erroresCampos.map(([campo, mensaje]) => (
            <li key={campo}>
              <a href={`#${idCampo(campo)}`} onClick={(evento) => enfocar(evento, campo)}>
                {etiquetas[campo] ?? campo}: {mensaje}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Alerta>
  );

  return { valores, setValores, cambiar, establecerCampo, marcarErrores, enviar, enviando, propsCampo, resumen };
}

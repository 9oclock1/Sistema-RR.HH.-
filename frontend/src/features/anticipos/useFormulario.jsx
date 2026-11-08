import { useEffect, useRef, useState } from "react";
import { Alerta } from "../../components/ui";

// Estado de un formulario con errores por campo del backend y resumen enfocable tras un envío fallido.
export default function useFormulario({ inicial, etiquetas, prefijo, onGuardar }) {
  const [valores, setValores] = useState(inicial);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviosFallidos, setEnviosFallidos] = useState(0);
  const refResumen = useRef(null);
  const idCampo = (campo) => `${prefijo}-${campo}`;

  // Solo tras un envío fallido: corregir un campo no debe mover el foco.
  useEffect(() => {
    if (enviosFallidos) refResumen.current?.focus();
  }, [enviosFallidos]);

  const cambiar = (evento) => {
    const { name, type, value, checked } = evento.target;
    setValores((actuales) => ({ ...actuales, [name]: type === "checkbox" ? checked : value }));
    setError((actual) => {
      if (!actual?.campos[name]) return actual;
      const campos = { ...actual.campos };
      delete campos[name];
      return { ...actual, campos };
    });
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await onGuardar(valores);
      setEnviando(false);
    } catch (errorGuardado) {
      const campos = Object.fromEntries((errorGuardado.detalles ?? []).map((d) => [d.campo, d.mensaje]));
      setError({ general: Object.keys(campos).length ? null : errorGuardado.message, campos });
      setEnviosFallidos((total) => total + 1);
      setEnviando(false);
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

  // En el orden del formulario, no en el que llegan del backend.
  const orden = Object.keys(etiquetas);
  const erroresCampos = Object.entries(error?.campos ?? {}).sort(([a], [b]) => orden.indexOf(a) - orden.indexOf(b));
  const resumen = (Boolean(error?.general) || erroresCampos.length > 0) && (
    <Alerta ref={refResumen} tabIndex={-1} tono="peligro" role="alert" titulo={error.general ?? "Revise los campos marcados."}>
      {erroresCampos.length > 0 && (
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

  return { valores, setValores, cambiar, enviar, enviando, propsCampo, resumen };
}

import { useEffect, useRef, useState } from "react";
import { Alerta } from "../../components/ui";

export default function useFormularioPlantilla({ inicial, etiquetas, prefijo, onGuardar, validar, tituloConflicto }) {
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
    const { name, value } = evento.target;
    setValores((actuales) => ({ ...actuales, [name]: value }));
    setError((actual) => {
      if (!actual?.campos[name]) return actual;
      const campos = { ...actual.campos };
      delete campos[name];
      return { ...actual, campos };
    });
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    const camposInvalidos = validar?.(valores) ?? {};
    if (Object.keys(camposInvalidos).length > 0) {
      setError({ general: null, campos: camposInvalidos });
      setEnviosFallidos((total) => total + 1);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await onGuardar(valores);
      setEnviando(false);
    } catch (errorGuardado) {
      const campos = Object.fromEntries((errorGuardado.detalles ?? []).map((d) => [d.campo, d.mensaje]));
      setError({
        general: Object.keys(campos).length ? null : errorGuardado.message,
        campos,
        estado: errorGuardado.estado,
        mensaje: errorGuardado.message,
      });
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
  const hayConflicto = error?.estado === 409 && Boolean(tituloConflicto);
  const resumen = (Boolean(error?.general) || erroresCampos.length > 0) && (
    <Alerta
      ref={refResumen}
      tabIndex={-1}
      tono={hayConflicto ? "aviso" : "peligro"}
      role="alert"
      titulo={hayConflicto ? tituloConflicto : (error.general ?? "Revise los campos marcados.")}
    >
      {hayConflicto && <p className="pl-alerta-texto">{error.mensaje}</p>}
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

  return { valores, enviar, enviando, propsCampo, resumen };
}

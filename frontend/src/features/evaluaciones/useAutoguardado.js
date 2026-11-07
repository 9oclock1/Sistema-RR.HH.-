import { useCallback, useEffect, useRef, useState } from "react";

export const RETRASO_AUTOGUARDADO_MS = 800;

export default function useAutoguardado({
  guardar,
  retraso = RETRASO_AUTOGUARDADO_MS,
  esDefinitivo = () => false,
}) {
  const [estado, setEstado] = useState("inactivo");
  const [error, setError] = useState(null);
  const [guardadoEn, setGuardadoEn] = useState(null);

  const cola = useRef(new Map());
  const temporizador = useRef(null);
  const enCurso = useRef(null);
  const montado = useRef(false);
  const funciones = useRef({ guardar, esDefinitivo });

  useEffect(() => {
    funciones.current = { guardar, esDefinitivo };
  });

  const vaciar = useCallback(() => {
    clearTimeout(temporizador.current);
    temporizador.current = null;
    if (enCurso.current) return enCurso.current;
    if (cola.current.size === 0) return Promise.resolve();

    const ciclo = (async () => {
      await null;
      try {
        while (cola.current.size > 0) {
          const lote = [...cola.current].map(([id_pregunta, id_nivel]) => ({
            id_pregunta,
            id_nivel,
          }));
          cola.current.clear();
          if (montado.current) setEstado("guardando");
          try {
            await funciones.current.guardar(lote);
          } catch (falla) {
            if (funciones.current.esDefinitivo(falla)) {
              cola.current.clear();
            } else {
              for (const { id_pregunta, id_nivel } of lote) {
                if (!cola.current.has(id_pregunta))
                  cola.current.set(id_pregunta, id_nivel);
              }
            }
            throw falla;
          }
        }
        if (montado.current) {
          setEstado("guardado");
          setGuardadoEn(new Date());
          setError(null);
        }
      } catch (falla) {
        if (montado.current) {
          setEstado("error");
          setError(falla);
        }
        throw falla;
      } finally {
        enCurso.current = null;
      }
    })();

    enCurso.current = ciclo;
    return ciclo;
  }, []);

  const encolar = useCallback(
    (idPregunta, idNivel) => {
      cola.current.set(idPregunta, idNivel);
      setEstado("pendiente");
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        vaciar().catch(() => {});
      }, retraso);
    },
    [retraso, vaciar],
  );

  const guardarAhora = useCallback(() => {
    if (cola.current.size === 0 && !enCurso.current) return Promise.resolve();
    return vaciar();
  }, [vaciar]);

  const reintentar = useCallback(() => vaciar().catch(() => {}), [vaciar]);

  useEffect(() => {
    const pendientes = cola.current;
    montado.current = true;
    return () => {
      montado.current = false;
      clearTimeout(temporizador.current);
      if (pendientes.size > 0) vaciar().catch(() => {});
    };
  }, [vaciar]);

  const sinGuardar =
    estado === "pendiente" || estado === "guardando" || estado === "error";
  useEffect(() => {
    if (!sinGuardar) return undefined;
    const avisar = (evento) => {
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sinGuardar]);

  return { estado, error, guardadoEn, encolar, guardarAhora, reintentar };
}

import { useEffect, useState } from 'react';
import { getCursosCapacitacion, getOrdenesServicioEmitidas } from '../../../api/capacitacionesApi';

export function useCursos(rol) {
  const [resultado, setResultado] = useState({ rol: null, cursos: [], error: null });

  useEffect(() => {
    const controller = new AbortController();

    getCursosCapacitacion({ rol, signal: controller.signal })
      .then((cursos) => setResultado({ rol, cursos, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado({ rol, cursos: [], error });
      });

    return () => controller.abort();
  }, [rol]);

  return { cursos: resultado.cursos, error: resultado.error, cargando: resultado.rol !== rol };
}

export function useOrdenesServicio(idCurso, rol) {
  const clave = idCurso ? `${idCurso}#${rol}` : null;
  const [resultado, setResultado] = useState({ clave: null, ordenes: [], error: null });

  useEffect(() => {
    if (!idCurso) return undefined;
    const controller = new AbortController();

    getOrdenesServicioEmitidas(idCurso, { rol, signal: controller.signal })
      .then((ordenes) => setResultado({ clave, ordenes, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado({ clave, ordenes: [], error });
      });

    return () => controller.abort();
  }, [idCurso, rol, clave]);

  const vigente = clave !== null && resultado.clave === clave;
  return {
    ordenes: vigente ? resultado.ordenes : [],
    error: vigente ? resultado.error : null,
    cargando: clave !== null && !vigente,
  };
}

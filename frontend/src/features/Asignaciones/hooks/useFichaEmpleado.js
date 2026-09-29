import { useCallback, useEffect, useState } from 'react';
import { getFichaEmpleado } from '../../../api/empleadosApi';

export function useFichaEmpleado(idEmpleado) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ clave: null, ficha: null, error: null });

  const clave = idEmpleado ? `${idEmpleado}#${version}` : null;

  useEffect(() => {
    if (!idEmpleado) return undefined;
    const controller = new AbortController();

    getFichaEmpleado(idEmpleado, { signal: controller.signal })
      .then((ficha) => setResultado({ clave, ficha, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado({ clave, ficha: null, error });
      });

    return () => controller.abort();
  }, [idEmpleado, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const reemplazar = useCallback((ficha) => setResultado({ clave, ficha, error: null }), [clave]);

  const vigente = clave !== null && resultado.clave === clave;
  return {
    ficha: vigente ? resultado.ficha : null,
    error: vigente ? resultado.error : null,
    cargando: clave !== null && !vigente,
    recargar,
    reemplazar,
  };
}

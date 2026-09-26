import { useCallback, useEffect, useState } from 'react';
import departamentosApi from '../api/departamentosApi';

export function useDepartamentosActivos() {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ version: -1, departamentos: [], error: null });

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => departamentosApi.suscribirCambios(recargar), [recargar]);

  useEffect(() => {
    const controller = new AbortController();

    departamentosApi
      .listarActivas({ signal: controller.signal })
      .then((departamentos) => setResultado({ version, departamentos, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado((previo) => ({ version, departamentos: previo.departamentos, error }));
      });

    return () => controller.abort();
  }, [version]);

  return {
    departamentos: resultado.departamentos,
    error: resultado.error,
    cargando: resultado.version === -1,
    recargar,
  };
}

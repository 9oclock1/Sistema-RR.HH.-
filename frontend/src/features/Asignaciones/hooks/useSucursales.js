import { useCallback, useEffect, useState } from 'react';
import { getSucursales } from '../../../api/sucursalesApi';

export function useSucursales() {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ version: -1, sucursales: [], error: null });

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    getSucursales({ signal: controller.signal })
      .then((sucursales) => setResultado({ version, sucursales, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado((previo) => ({ version, sucursales: previo.sucursales, error }));
      });

    return () => controller.abort();
  }, [version]);

  return {
    sucursales: resultado.sucursales,
    error: resultado.error,
    cargando: resultado.version === -1,
    recargar,
  };
}

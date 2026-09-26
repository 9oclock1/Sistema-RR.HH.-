import { useCallback, useEffect, useState } from 'react';
import { getCargos } from '../../../api/cargosApi';
import departamentosApi from '../../../api/departamentosApi';

export function useCargos(areaId) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ clave: null, cargos: [], error: null });

  const clave = `${areaId || 'todas'}#${version}`;

  useEffect(() => {
    const controller = new AbortController();

    getCargos(areaId, { signal: controller.signal })
      .then((cargos) => setResultado({ clave, cargos, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado((previo) => ({ clave, cargos: previo.cargos, error }));
      });

    return () => controller.abort();
  }, [areaId, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => departamentosApi.suscribirCambios(recargar), [recargar]);

  return {
    cargos: resultado.cargos,
    error: resultado.error,
    cargando: resultado.clave !== clave,
    recargar,
  };
}

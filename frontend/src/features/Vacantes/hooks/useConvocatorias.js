import { useCallback, useEffect, useState } from 'react';
import { getConvocatorias } from '../../../api/convocatoriasApi';

export function useConvocatorias(estado) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ clave: null, convocatorias: [], error: null });

  const clave = `${estado || 'todas'}#${version}`;

  useEffect(() => {
    const controller = new AbortController();

    getConvocatorias(estado, { signal: controller.signal })
      .then((convocatorias) => setResultado({ clave, convocatorias, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado((previo) => ({ clave, convocatorias: previo.convocatorias, error }));
      });

    return () => controller.abort();
  }, [estado, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return {
    convocatorias: resultado.convocatorias,
    error: resultado.error,
    cargando: resultado.clave !== clave,
    recargar,
  };
}

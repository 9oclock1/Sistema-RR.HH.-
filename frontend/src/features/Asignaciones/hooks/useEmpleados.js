import { useCallback, useEffect, useState } from 'react';
import { getEmpleados } from '../../../api/empleadosApi';

export function useEmpleados() {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ version: -1, empleados: [], error: null });

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    getEmpleados({ signal: controller.signal })
      .then((empleados) => setResultado({ version, empleados, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado((previo) => ({ version, empleados: previo.empleados, error }));
      });

    return () => controller.abort();
  }, [version]);

  return {
    empleados: resultado.empleados,
    error: resultado.error,
    cargando: resultado.version === -1,
    recargar,
  };
}

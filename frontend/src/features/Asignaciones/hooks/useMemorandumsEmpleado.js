import { useCallback, useEffect, useState } from 'react';
import { getMemorandumsEmpleado } from '../../../api/empleadosApi';

export function useMemorandumsEmpleado(idEmpleado) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ clave: null, memorandums: [], error: null });

  const clave = `${idEmpleado}#${version}`;

  useEffect(() => {
    const controller = new AbortController();

    getMemorandumsEmpleado(idEmpleado, { signal: controller.signal })
      .then((memorandums) => setResultado({ clave, memorandums, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado({ clave, memorandums: [], error });
      });

    return () => controller.abort();
  }, [idEmpleado, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const vigente = resultado.clave === clave;
  return {
    memorandums: vigente ? resultado.memorandums : [],
    error: vigente ? resultado.error : null,
    cargando: !vigente,
    recargar,
  };
}

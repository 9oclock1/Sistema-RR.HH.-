import { useCallback, useEffect, useState } from 'react';
import { getKardexEmpleado } from '../../../api/kardexApi';

export function useKardex(idEmpleado, rol) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ clave: null, kardex: null, error: null });

  const clave = idEmpleado ? `${idEmpleado}#${rol}#${version}` : null;

  useEffect(() => {
    if (!idEmpleado) return undefined;
    const controller = new AbortController();

    getKardexEmpleado(idEmpleado, { rol, signal: controller.signal })
      .then((kardex) => setResultado({ clave, kardex, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado({ clave, kardex: null, error });
      });

    return () => controller.abort();
  }, [idEmpleado, rol, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const vigente = clave !== null && resultado.clave === clave;
  return {
    kardex: vigente ? resultado.kardex : null,
    error: vigente ? resultado.error : null,
    cargando: clave !== null && !vigente,
    recargar,
  };
}

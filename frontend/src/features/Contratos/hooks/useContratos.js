import { useCallback, useEffect, useState } from 'react';
import { getCatalogosContrato, getHistorialContratos } from '../../../api/contratosApi';

const CATALOGOS_VACIOS = { tipos_contrato: [], tipos_jornada: [], tipos_modificacion: [] };

export function useCatalogosContrato(rol) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ clave: null, catalogos: CATALOGOS_VACIOS, error: null });

  const clave = `${rol}#${version}`;

  useEffect(() => {
    const controller = new AbortController();

    getCatalogosContrato({ rol, signal: controller.signal })
      .then((catalogos) => setResultado({ clave, catalogos, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado({ clave, catalogos: CATALOGOS_VACIOS, error });
      });

    return () => controller.abort();
  }, [rol, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { ...resultado.catalogos, error: resultado.error, cargando: resultado.clave !== clave, recargar };
}

export function useHistorialContratos(idEmpleado, rol) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ clave: null, historial: [], error: null });

  const clave = idEmpleado ? `${idEmpleado}#${rol}#${version}` : null;

  useEffect(() => {
    if (!idEmpleado) return undefined;
    const controller = new AbortController();

    getHistorialContratos(idEmpleado, { rol, signal: controller.signal })
      .then((historial) => setResultado({ clave, historial, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado({ clave, historial: [], error });
      });

    return () => controller.abort();
  }, [idEmpleado, rol, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const vigente = clave !== null && resultado.clave === clave;
  return {
    historial: vigente ? resultado.historial : [],
    error: vigente ? resultado.error : null,
    cargando: clave !== null && !vigente,
    recargar,
  };
}

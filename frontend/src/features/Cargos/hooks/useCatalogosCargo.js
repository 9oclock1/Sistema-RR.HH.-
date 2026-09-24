import { useEffect, useState } from 'react';
import { getDepartamentosActivos } from '../../../api/departamentosApi';
import { getNivelesSalariales } from '../../../api/nivelesSalarialesApi';

export function useCatalogosCargo() {
  const [catalogos, setCatalogos] = useState({
    cargando: true,
    departamentos: [],
    niveles: [],
    errorDepartamentos: null,
    errorNiveles: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const opciones = { signal: controller.signal };

    Promise.allSettled([getDepartamentosActivos(opciones), getNivelesSalariales(opciones)]).then(
      ([departamentos, niveles]) => {
        if (controller.signal.aborted) return;
        setCatalogos({
          cargando: false,
          departamentos: departamentos.status === 'fulfilled' ? departamentos.value : [],
          niveles: niveles.status === 'fulfilled' ? niveles.value : [],
          errorDepartamentos: departamentos.status === 'rejected' ? departamentos.reason : null,
          errorNiveles: niveles.status === 'rejected' ? niveles.reason : null,
        });
      }
    );

    return () => controller.abort();
  }, []);

  return catalogos;
}

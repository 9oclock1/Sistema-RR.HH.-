import { useEffect, useState } from 'react';
import departamentosApi from '../../../api/departamentosApi';
import { getNivelesSalariales } from '../../../api/nivelesSalarialesApi';

export function useCatalogosCargo() {
  const [catalogos, setCatalogos] = useState({
    cargando: true,
    departamentos: [],
    niveles: [],
    errorDepartamentos: null,
    errorNiveles: null,
  });
  // Se incrementa cuando otra pantalla crea, edita o da de baja un área.
  const [version, setVersion] = useState(0);

  useEffect(() => departamentosApi.suscribirCambios(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    const controller = new AbortController();
    const opciones = { signal: controller.signal };

    Promise.allSettled([departamentosApi.listarActivas(opciones), getNivelesSalariales(opciones)]).then(
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
  }, [version]);

  return catalogos;
}

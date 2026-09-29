import { useEffect, useState } from 'react';
import { getNivelesEducacion } from '../../../api/convocatoriasApi';

// Catálogo fijo del backend (BACHILLER … DOCTORADO): se pide una vez al montar.
export function useNivelesEducacion() {
  const [resultado, setResultado] = useState({ niveles: [], error: null, cargando: true });

  useEffect(() => {
    const controller = new AbortController();

    getNivelesEducacion({ signal: controller.signal })
      .then((niveles) => setResultado({ niveles, error: null, cargando: false }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setResultado({ niveles: [], error, cargando: false });
      });

    return () => controller.abort();
  }, []);

  return resultado;
}

import { useCallback, useEffect, useState } from "react";
import { getTiposMemorandum } from "../../../api/memorandumsApi";

export function useTiposMemorandum(clasificacion) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({
    version: -1,
    tipos: [],
    error: null,
  });

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    getTiposMemorandum(clasificacion, { signal: controller.signal })
      .then((tipos) => setResultado({ version, tipos, error: null }))
      .catch((error) => {
        if (error.name === "AbortError") return;
        setResultado((previo) => ({ version, tipos: previo.tipos, error }));
      });

    return () => controller.abort();
  }, [clasificacion, version]);

  return {
    tipos: resultado.tipos,
    error: resultado.error,
    cargando: resultado.version !== version,
    recargar,
  };
}

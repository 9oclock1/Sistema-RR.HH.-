import { useCallback, useEffect, useState } from "react";

export default function useRecurso(cargar) {
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState({ intento: -1 });

  useEffect(() => {
    let vigente = true;
    cargar()
      .then((datos) => vigente && setEstado({ intento, datos }))
      .catch((error) => vigente && setEstado({ intento, error }));
    return () => {
      vigente = false;
    };
  }, [cargar, intento]);

  const cargando = estado.intento !== intento;
  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  return { datos: estado.datos ?? null, error: cargando ? null : (estado.error ?? null), cargando, reintentar };
}

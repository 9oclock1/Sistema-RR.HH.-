import { useEffect, useRef, useState } from "react";

// Ancho disponible del contenedor, para dibujar el gráfico en píxeles reales y no escalar el texto.
export default function useAncho(inicial = 600) {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(inicial);
  useEffect(() => {
    const elemento = ref.current;
    if (!elemento || typeof ResizeObserver === "undefined") return undefined;
    const observador = new ResizeObserver(([entrada]) => {
      const nuevo = Math.floor(entrada.contentRect.width);
      if (nuevo > 0) setAncho(nuevo);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return [ref, ancho];
}

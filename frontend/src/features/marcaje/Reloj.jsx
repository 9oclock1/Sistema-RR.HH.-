import { useEffect, useState } from "react";
import { formatearHoraConSegundos } from "./formato";

export default function Reloj() {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <time className="marcaje-reloj__hora" dateTime={ahora.toISOString()}>
      {formatearHoraConSegundos(ahora)}
    </time>
  );
}

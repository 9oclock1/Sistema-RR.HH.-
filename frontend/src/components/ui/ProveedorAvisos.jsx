import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { ContextoAvisos } from "./avisos";
import "./utilidades.css";
import "./Avisos.css";

const ICONOS = { exito: CircleCheck, aviso: TriangleAlert, peligro: CircleAlert, info: Info };
const DURACION = 5000;

function Aviso({ aviso, onCerrar }) {
  const { tono, titulo, mensaje, duracion } = aviso;
  const Icono = ICONOS[tono] ?? Info;
  const [pausado, setPausado] = useState(false);
  const restante = useRef(duracion);

  useEffect(() => {
    if (pausado || !restante.current) return;
    const inicio = Date.now();
    const temporizador = setTimeout(onCerrar, restante.current);
    return () => {
      clearTimeout(temporizador);
      restante.current -= Date.now() - inicio;
    };
  }, [pausado, onCerrar]);

  return (
    <div
      className={`ds-aviso ds-aviso--${tono}`}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <Icono className="ds-icono ds-aviso__icono" aria-hidden="true" />
      <div className="ds-aviso__texto">
        <p className="ds-aviso__titulo">{titulo}</p>
        {mensaje && <p className="ds-aviso__mensaje">{mensaje}</p>}
      </div>
      <button type="button" className="ds-aviso__cerrar ds-foco" aria-label="Cerrar aviso" onClick={onCerrar}>
        <X className="ds-icono" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ProveedorAvisos({ children }) {
  const [avisos, setAvisos] = useState([]);
  const siguienteId = useRef(0);

  const cerrar = useCallback((id) => {
    setAvisos((actuales) => actuales.filter((aviso) => aviso.id !== id));
  }, []);

  const avisar = useCallback(({ tono = "info", titulo, mensaje, duracion = DURACION }) => {
    const id = ++siguienteId.current;
    setAvisos((actuales) => [...actuales, { id, tono, titulo, mensaje, duracion }]);
    return id;
  }, []);

  return (
    <ContextoAvisos.Provider value={avisar}>
      {children}
      <div className="ds-avisos" role="status" aria-live="polite">
        {avisos.map((aviso) => (
          <Aviso key={aviso.id} aviso={aviso} onCerrar={() => cerrar(aviso.id)} />
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
}

import { useId, useRef } from "react";
import Contador from "./Contador";
import "./utilidades.css";
import "./Pestanas.css";

// pestanas: [{ id, etiqueta, contador?, contenido }]. Flechas, Inicio y Fin mueven el foco entre pestañas.
export default function Pestanas({ pestanas, activa, onCambiar, etiqueta, className = "" }) {
  const base = useId();
  const lista = useRef(null);
  const indiceActivo = Math.max(
    0,
    pestanas.findIndex((pestana) => pestana.id === activa),
  );
  const actual = pestanas[indiceActivo];

  const moverA = (indice) => {
    const destino = pestanas[(indice + pestanas.length) % pestanas.length];
    onCambiar(destino.id);
    lista.current.querySelector(`[data-pestana="${destino.id}"]`)?.focus();
  };

  const alPresionarTecla = (evento) => {
    const acciones = {
      ArrowRight: () => moverA(indiceActivo + 1),
      ArrowLeft: () => moverA(indiceActivo - 1),
      Home: () => moverA(0),
      End: () => moverA(pestanas.length - 1),
    };
    const accion = acciones[evento.key];
    if (accion) {
      evento.preventDefault();
      accion();
    }
  };

  return (
    <div className={`ds-pestanas ${className}`}>
      <div className="ds-pestanas__lista" role="tablist" aria-label={etiqueta} ref={lista} onKeyDown={alPresionarTecla}>
        {pestanas.map((pestana) => {
          const seleccionada = pestana.id === actual?.id;
          return (
            <button
              key={pestana.id}
              type="button"
              role="tab"
              id={`${base}-pestana-${pestana.id}`}
              aria-controls={`${base}-panel-${pestana.id}`}
              aria-selected={seleccionada}
              tabIndex={seleccionada ? 0 : -1}
              data-pestana={pestana.id}
              className="ds-pestanas__pestana ds-foco"
              onClick={() => onCambiar(pestana.id)}
            >
              {pestana.etiqueta}
              {pestana.contador !== undefined && <Contador>{pestana.contador}</Contador>}
            </button>
          );
        })}
      </div>
      {actual && (
        <div
          role="tabpanel"
          id={`${base}-panel-${actual.id}`}
          aria-labelledby={`${base}-pestana-${actual.id}`}
          className="ds-pestanas__panel"
          tabIndex={0}
        >
          {actual.contenido}
        </div>
      )}
    </div>
  );
}

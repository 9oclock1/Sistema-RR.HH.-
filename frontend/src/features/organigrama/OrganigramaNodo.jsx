// src/features/organigrama/OrganigramaNodo.jsx
import { useState } from 'react';

export default function OrganigramaNodo({ nodo, nodoSeleccionado, onSeleccionar }) {
  const [expandido, setExpandido] = useState(true);
  const hijos = nodo.hijos ?? [];
  const empleados = nodo.empleados ?? [];
  const seleccionado = nodoSeleccionado?.id_cargo === nodo.id_cargo;
  const tieneHijos = hijos.length > 0;
  const total = empleados.length;
  const ocupante =
    total === 0 ? 'Vacante' : total === 1 ? empleados[0].nombre : `${total} empleados`;

  function alTeclear(e) {
    if (e.target !== e.currentTarget) return; // ignora teclas que vienen del botón +/−
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSeleccionar(nodo);
    }
  }

  return (
    <li className="organigrama__node">
      <div
        className={`organigrama__box${seleccionado ? ' organigrama__box--selected' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => onSeleccionar(nodo)} // Criterio 2
        onKeyDown={alTeclear}
      >
        {tieneHijos && (
          <button
            type="button"
            className="organigrama__toggle"
            aria-label={expandido ? 'Contraer rama' : 'Expandir rama'}
            aria-expanded={expandido}
            onClick={(e) => {
              e.stopPropagation(); // no dispara la selección del nodo
              setExpandido((prev) => !prev);
            }}
          >
            {expandido ? '−' : '+'}
          </button>
        )}
        <span className="organigrama__box-title">{nodo.cargo}</span>
        <span
          className={`organigrama__box-holder${total === 0 ? ' organigrama__box-holder--vacant' : ''}`}
        >
          {ocupante}
        </span>
      </div>

      {tieneHijos && expandido && (
        <ul className="organigrama__children">
          {hijos.map((hijo) => (
            <OrganigramaNodo
              key={hijo.id_cargo}
              nodo={hijo}
              nodoSeleccionado={nodoSeleccionado}
              onSeleccionar={onSeleccionar}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
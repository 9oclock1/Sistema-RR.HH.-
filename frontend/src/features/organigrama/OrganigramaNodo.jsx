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
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSeleccionar(nodo);
    }
  }

  return (
    <li className="organigrama__node">
      {/* El botón +/− va como hermano del nodo seleccionable, nunca adentro:
          un <button> dentro de un role="button" es un elemento interactivo
          anidado y axe lo marca como error de accesibilidad. */}
      <div className="organigrama__node-inner">
        <div
          className={`organigrama__box${seleccionado ? ' organigrama__box--selected' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => onSeleccionar(nodo)} // Criterio 2
          onKeyDown={alTeclear}
        >
          <span className="organigrama__box-title">{nodo.cargo}</span>
          <span className={total === 0 ? 'ui-muted' : 'ui-table__sub'}>{ocupante}</span>
        </div>

        {tieneHijos && (
          <button
            type="button"
            className="ui-icon-btn organigrama__toggle"
            aria-label={expandido ? 'Contraer rama' : 'Expandir rama'}
            aria-expanded={expandido}
            onClick={() => setExpandido((prev) => !prev)}
          >
            {expandido ? '−' : '+'}
          </button>
        )}
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
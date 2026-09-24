import { useState } from 'react';
import { nuevaFuncion } from '../utils/cargoFormulario';
import { IconoCerrar, IconoMas } from './Iconos';

export default function FuncionesInput({ funciones, onChange, error, errorId }) {
  const [enfocarId, setEnfocarId] = useState(null);

  const agregar = () => {
    const funcion = nuevaFuncion();
    onChange([...funciones, funcion]);
    setEnfocarId(funcion.id);
  };

  const actualizar = (id, texto) => onChange(funciones.map((f) => (f.id === id ? { ...f, texto } : f)));

  const quitar = (id) => onChange(funciones.filter((f) => f.id !== id));

  const manejarTecla = (evento, indice) => {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    if (indice === funciones.length - 1 && funciones[indice].texto.trim()) agregar();
  };

  return (
    <fieldset className="cargos-field cargos-funciones" aria-describedby={error ? errorId : undefined}>
      <legend className="cargos-field__label">
        Funciones clave <span className="cargos-field__optional">opcional</span>
      </legend>

      {funciones.length === 0 ? (
        <p className="cargos-funciones__empty">Aún no agregaste funciones.</p>
      ) : (
        <ol className="cargos-funciones__list">
          {funciones.map((funcion, indice) => (
            <li key={funcion.id} className="cargos-funciones__item">
              <span className="cargos-funciones__index" aria-hidden="true">
                {indice + 1}
              </span>
              <input
                type="text"
                className="cargos-input"
                value={funcion.texto}
                placeholder="Ej. Atender la caja registradora"
                aria-label={`Función ${indice + 1}`}
                aria-invalid={error ? true : undefined}
                autoFocus={funcion.id === enfocarId}
                onChange={(e) => actualizar(funcion.id, e.target.value)}
                onKeyDown={(e) => manejarTecla(e, indice)}
              />
              <button
                type="button"
                className="cargos-icon-btn"
                aria-label={`Quitar función ${indice + 1}`}
                title="Quitar"
                onClick={() => quitar(funcion.id)}
              >
                <IconoCerrar size={14} />
              </button>
            </li>
          ))}
        </ol>
      )}

      <button type="button" className="cargos-btn cargos-btn--dashed" onClick={agregar}>
        <IconoMas size={14} /> Agregar función
      </button>

      {error && (
        <p id={errorId} className="cargos-field__error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

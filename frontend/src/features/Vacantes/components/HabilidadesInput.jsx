import { useState } from 'react';
import { IconoCerrar, IconoMas } from '../../../components/Iconos';
import { nuevaHabilidad } from '../utils/vacanteFormulario';

// Mismo patrón que FuncionesInput de Cargos: una fila por habilidad, Enter en la última agrega otra.
export default function HabilidadesInput({ habilidades, onChange, error, errorId, etiquetaExtra }) {
  const [enfocarId, setEnfocarId] = useState(null);

  const agregar = () => {
    const habilidad = nuevaHabilidad();
    onChange([...habilidades, habilidad]);
    setEnfocarId(habilidad.id);
  };

  const actualizar = (id, texto) => onChange(habilidades.map((h) => (h.id === id ? { ...h, texto } : h)));

  const quitar = (id) => onChange(habilidades.filter((h) => h.id !== id));

  const manejarTecla = (evento, indice) => {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    if (indice === habilidades.length - 1 && habilidades[indice].texto.trim()) agregar();
  };

  return (
    <fieldset className="ui-field vacantes-lista" aria-describedby={error ? errorId : undefined}>
      <legend className="ui-field__label">
        Habilidades clave {etiquetaExtra}
      </legend>

      {habilidades.length === 0 ? (
        <p className="vacantes-lista__empty">Aún no agregaste habilidades.</p>
      ) : (
        <ol className="vacantes-lista__list">
          {habilidades.map((habilidad, indice) => (
            <li key={habilidad.id} className="vacantes-lista__item">
              <span className="vacantes-lista__index" aria-hidden="true">
                {indice + 1}
              </span>
              <input
                type="text"
                className="ui-input"
                value={habilidad.texto}
                maxLength={100}
                placeholder="Ej. Contabilidad NIIF"
                aria-label={`Habilidad ${indice + 1}`}
                aria-invalid={error ? true : undefined}
                autoFocus={habilidad.id === enfocarId}
                onChange={(e) => actualizar(habilidad.id, e.target.value)}
                onKeyDown={(e) => manejarTecla(e, indice)}
              />
              <button
                type="button"
                className="ui-icon-btn"
                aria-label={`Quitar habilidad ${indice + 1}`}
                title="Quitar"
                onClick={() => quitar(habilidad.id)}
              >
                <IconoCerrar size={14} />
              </button>
            </li>
          ))}
        </ol>
      )}

      <button type="button" className="ui-btn ui-btn--dashed" onClick={agregar}>
        <IconoMas size={14} /> Agregar habilidad
      </button>

      {error && (
        <p id={errorId} className="ui-field__error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

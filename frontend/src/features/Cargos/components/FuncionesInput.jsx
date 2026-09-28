import { useState } from 'react';
import { CircleAlert, Plus, X } from 'lucide-react';
import { Boton, CampoTexto } from '../../../components/ui';
import { nuevaFuncion } from '../utils/cargoFormulario';

export default function FuncionesInput({ id, className = '', funciones, onChange, error }) {
  const [enfocarId, setEnfocarId] = useState(null);
  const idError = `${id}-error`;

  const agregar = () => {
    const funcion = nuevaFuncion();
    onChange([...funciones, funcion]);
    setEnfocarId(funcion.id);
  };

  const actualizar = (idFuncion, texto) => onChange(funciones.map((f) => (f.id === idFuncion ? { ...f, texto } : f)));

  const quitar = (idFuncion) => onChange(funciones.filter((f) => f.id !== idFuncion));

  const manejarTecla = (evento, indice) => {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    if (indice === funciones.length - 1 && funciones[indice].texto.trim()) agregar();
  };

  return (
    <fieldset id={id} className={`cargo-funciones ${className}`} aria-describedby={error ? idError : undefined}>
      <legend className="ds-campo__etiqueta">
        Funciones clave
        <span className="ds-campo__requerido" aria-hidden="true">
          *
        </span>
      </legend>

      {funciones.length === 0 ? (
        <p className="cargo-funciones__vacio">Aún no agregó funciones.</p>
      ) : (
        <ol className="cargo-funciones__lista">
          {funciones.map((funcion, indice) => (
            <li key={funcion.id} className="cargo-funciones__item">
              <span className="cargo-funciones__indice" aria-hidden="true">
                {indice + 1}
              </span>
              <CampoTexto
                className="cargo-funciones__campo"
                value={funcion.texto}
                placeholder="Ej. Atender la caja registradora"
                aria-label={`Función ${indice + 1}`}
                aria-invalid={error ? true : undefined}
                autoFocus={funcion.id === enfocarId}
                onChange={(e) => actualizar(funcion.id, e.target.value)}
                onKeyDown={(e) => manejarTecla(e, indice)}
              />
              <Boton
                variante="sutil"
                soloIcono
                icono={X}
                aria-label={`Quitar función ${indice + 1}`}
                title="Quitar"
                onClick={() => quitar(funcion.id)}
              />
            </li>
          ))}
        </ol>
      )}

      <Boton variante="sutil" icono={Plus} className="cargo-funciones__agregar" onClick={agregar}>
        Agregar función
      </Boton>

      {error && (
        <p id={idError} className="ds-campo__error">
          <CircleAlert className="ds-icono" aria-hidden="true" />
          {error}
        </p>
      )}
    </fieldset>
  );
}

import { useState } from 'react';
import { CircleAlert, Plus, X } from 'lucide-react';
import { Boton, CampoTexto } from '../../../components/ui';
import { nuevaHabilidad } from '../utils/vacanteFormulario';

// Mismo patrón que FuncionesInput de Cargos: una fila por habilidad, Enter en la última agrega otra.
export default function HabilidadesInput({ id, habilidades, onChange, error, ayuda }) {
  const [enfocarId, setEnfocarId] = useState(null);
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;
  const descritoPor = [error && idError, ayuda && idAyuda].filter(Boolean).join(' ') || undefined;

  const agregar = () => {
    const habilidad = nuevaHabilidad();
    onChange([...habilidades, habilidad]);
    setEnfocarId(habilidad.id);
  };

  const actualizar = (idHabilidad, texto) => onChange(habilidades.map((h) => (h.id === idHabilidad ? { ...h, texto } : h)));

  const quitar = (idHabilidad) => onChange(habilidades.filter((h) => h.id !== idHabilidad));

  const manejarTecla = (evento, indice) => {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    if (indice === habilidades.length - 1 && habilidades[indice].texto.trim()) agregar();
  };

  return (
    <fieldset id={id} className="vacante-habilidades" aria-describedby={descritoPor}>
      <legend className="vacante-habilidades__etiqueta">Habilidades clave</legend>

      {habilidades.length === 0 ? (
        <p className="vacante-habilidades__vacio">Aún no agregaste habilidades.</p>
      ) : (
        <ol className="vacante-habilidades__lista">
          {habilidades.map((habilidad, indice) => (
            <li key={habilidad.id} className="vacante-habilidades__item">
              <span className="vacante-habilidades__indice" aria-hidden="true">
                {indice + 1}
              </span>
              <CampoTexto
                className="vacante-habilidades__campo"
                value={habilidad.texto}
                maxLength={100}
                placeholder="Ej. Contabilidad NIIF"
                aria-label={`Habilidad ${indice + 1}`}
                aria-invalid={error ? true : undefined}
                autoFocus={habilidad.id === enfocarId}
                onChange={(e) => actualizar(habilidad.id, e.target.value)}
                onKeyDown={(e) => manejarTecla(e, indice)}
              />
              <Boton
                variante="sutil"
                soloIcono
                icono={X}
                aria-label={`Quitar habilidad ${indice + 1}`}
                title="Quitar"
                onClick={() => quitar(habilidad.id)}
              />
            </li>
          ))}
        </ol>
      )}

      <Boton variante="sutil" tamano="sm" icono={Plus} className="vacante-habilidades__agregar" onClick={agregar}>
        Agregar habilidad
      </Boton>

      {error && (
        <p id={idError} className="vacante-habilidades__error">
          <CircleAlert className="ds-icono" aria-hidden="true" />
          {error}
        </p>
      )}
      {ayuda && (
        <p id={idAyuda} className="vacante-habilidades__ayuda">
          {ayuda}
        </p>
      )}
    </fieldset>
  );
}

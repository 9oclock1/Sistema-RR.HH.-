import { useId } from 'react';
import { formatearFecha, formatearRangoSalarial } from '../utils/formato';
import { IconoAlerta, IconoLapiz } from './Iconos';

const FUNCIONES_VISIBLES = 2;
const TONOS = 4; 

function ResumenFunciones({ funciones }) {
  if (funciones.length === 0) return <span className="cargos-muted">—</span>;

  const visibles = funciones.slice(0, FUNCIONES_VISIBLES);
  const ocultas = funciones.slice(FUNCIONES_VISIBLES);

  return (
    <ul className="cargos-chips">
      {visibles.map((funcion, i) => (
        <li key={i} className="cargos-chip" title={funcion}>
          {funcion}
        </li>
      ))}
      {ocultas.length > 0 && (
        <li className="cargos-chip cargos-chip--more" title={ocultas.join('\n')}>
          +{ocultas.length}
        </li>
      )}
    </ul>
  );
}

function FilasCargando() {
  return Array.from({ length: 3 }, (_, i) => (
    <tr key={i} className="cargos-table__skeleton" aria-hidden="true">
      {Array.from({ length: 6 }, (_, j) => (
        <td key={j}>
          <span className="cargos-skeleton" />
        </td>
      ))}
    </tr>
  ));
}

export default function CargosTable({
  cargos,
  cargando,
  error,
  onReintentar,
  areaId,
  onCambiarArea,
  departamentos,
  errorDepartamentos,
  niveles,
  idEnEdicion,
  onEditar,
}) {
  const uid = useId();
  const nivelesPorId = new Map(niveles.map((n) => [n.id_nivel, n]));
  const hayFiltro = Boolean(areaId);

  return (
    <section className="cargos-card cargos-table-card" aria-labelledby={`${uid}-titulo`}>
      <header className="cargos-card__header">
        <div>
          <h3 id={`${uid}-titulo`} className="cargos-card__title">
            Cargos registrados
            {!cargando && !error && <span className="cargos-count">{cargos.length}</span>}
          </h3>
          <p className="cargos-card__subtitle">Solo se muestran los cargos activos.</p>
        </div>

        <div className="cargos-filter">
          <label htmlFor={`${uid}-area`} className="cargos-filter__label">
            Área
          </label>
          <select
            id={`${uid}-area`}
            className="cargos-input cargos-select cargos-select--pill"
            value={areaId}
            onChange={(e) => onCambiarArea(e.target.value)}
            disabled={Boolean(errorDepartamentos)}
            title={errorDepartamentos ? 'No se pudieron cargar las áreas' : undefined}
          >
            <option value="">Todas las áreas</option>
            {departamentos.map((d) => (
              <option key={d.id_departamento} value={String(d.id_departamento)}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? (
        <div className="cargos-alert cargos-alert--error" role="alert">
          <IconoAlerta />
          <span>{error.message}</span>
          <button type="button" className="cargos-btn cargos-btn--ghost cargos-btn--sm" onClick={onReintentar}>
            Reintentar
          </button>
        </div>
      ) : (
        <div className="cargos-table__scroll">
          <table className="cargos-table" aria-busy={cargando}>
            <thead>
              <tr>
                <th scope="col">Cargo</th>
                <th scope="col">Área</th>
                <th scope="col">Nivel salarial</th>
                <th scope="col">Funciones</th>
                <th scope="col">Modificado</th>
                <th scope="col">
                  <span className="cargos-sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <FilasCargando />
              ) : cargos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cargos-table__empty">
                    {hayFiltro ? 'No hay cargos activos en esta área.' : 'Todavía no hay cargos registrados.'}
                  </td>
                </tr>
              ) : (
                cargos.map((cargo) => {
                  const nivel = nivelesPorId.get(cargo.id_nivel_salarial);
                  const tono = ((cargo.id_nivel_salarial - 1) % TONOS) + 1;
                  const enEdicion = cargo.id_cargo === idEnEdicion;
                  const fecha = formatearFecha(cargo.fecha_modificacion);

                  return (
                    <tr key={cargo.id_cargo} className={enEdicion ? 'is-editing' : undefined}>
                      <td>
                        <div className="cargos-table__name">{cargo.nombre}</div>
                        {cargo.perfil_requerido && (
                          <div className="cargos-table__profile" title={cargo.perfil_requerido}>
                            {cargo.perfil_requerido}
                          </div>
                        )}
                      </td>
                      <td>{cargo.departamento ?? <span className="cargos-muted">Sin área</span>}</td>
                      <td>
                        <span className={`cargos-badge cargos-badge--tone-${tono}`}>{cargo.nivel_salarial}</span>
                        {nivel && <div className="cargos-table__range">{formatearRangoSalarial(nivel)}</div>}
                      </td>
                      <td>
                        <ResumenFunciones funciones={cargo.funciones} />
                      </td>
                      <td className="cargos-table__date">
                        {fecha ? (
                          <>
                            <div>{fecha.dia}</div>
                            <div className="cargos-muted">{fecha.hora}</div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="cargos-table__actions">
                        <button
                          type="button"
                          className="cargos-icon-btn"
                          onClick={() => onEditar(cargo)}
                          aria-label={`Editar ${cargo.nombre}`}
                          aria-pressed={enEdicion}
                          title="Editar"
                        >
                          <IconoLapiz />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

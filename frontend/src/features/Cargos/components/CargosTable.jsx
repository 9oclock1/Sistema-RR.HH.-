import { useId } from 'react';
import FilasCargando from '../../../components/FilasCargando';
import { IconoAlerta, IconoLapiz } from '../../../components/Iconos';
import { formatearFechaHora, formatearMonto } from '../utils/formato';
import { CLASE_BADGE_NIVEL } from '../utils/nivelesSalariales';

const FUNCIONES_VISIBLES = 2;
const COLUMNAS = 8;

function ResumenFunciones({ funciones }) {
  if (funciones.length === 0) return <span className="ui-muted">—</span>;

  const visibles = funciones.slice(0, FUNCIONES_VISIBLES);
  const ocultas = funciones.slice(FUNCIONES_VISIBLES);

  return (
    <ul className="ui-chips">
      {visibles.map((funcion, i) => (
        <li key={i} className="ui-chip" title={funcion}>
          {funcion}
        </li>
      ))}
      {ocultas.length > 0 && (
        <li className="ui-chip ui-chip--more" title={ocultas.join('\n')}>
          +{ocultas.length}
        </li>
      )}
    </ul>
  );
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
  idEnEdicion,
  onEditar,
}) {
  const uid = useId();
  const hayFiltro = Boolean(areaId);

  return (
    <section className="ui-card ui-table-card" aria-labelledby={`${uid}-titulo`}>
      <header className="ui-card__header">
        <div>
          <h3 id={`${uid}-titulo`} className="ui-card__title">
            Cargos registrados
            {!cargando && !error && <span className="ui-count">{cargos.length}</span>}
          </h3>
          <p className="ui-card__subtitle">Solo se muestran los cargos activos.</p>
        </div>

        <div className="ui-filter">
          <label htmlFor={`${uid}-area`} className="ui-filter__label">
            Área
          </label>
          <select
            id={`${uid}-area`}
            className="ui-input ui-select ui-select--pill"
            value={areaId}
            onChange={(e) => onCambiarArea(e.target.value)}
            disabled={Boolean(errorDepartamentos)}
            title={errorDepartamentos ? 'No se pudieron cargar las áreas' : undefined}
          >
            <option value="">Todas las áreas</option>
            {departamentos.map((d) => (
              <option key={d.id_departamento} value={d.id_departamento}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? (
        <div className="ui-alert ui-alert--error" role="alert">
          <IconoAlerta />
          <span>{error.message}</span>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onReintentar}>
            Reintentar
          </button>
        </div>
      ) : (
        <div className="ui-table__scroll">
          <table className="ui-table" aria-busy={cargando}>
            <thead>
              <tr>
                <th scope="col">Cargo</th>
                <th scope="col">Área</th>
                <th scope="col">Nivel salarial</th>
                <th scope="col">Salario base</th>
                <th scope="col">Funciones</th>
                <th scope="col">Requisitos mínimos</th>
                <th scope="col">Modificaciones</th>
                <th scope="col">
                  <span className="ui-sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <FilasCargando columnas={COLUMNAS} />
              ) : cargos.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS} className="ui-table__empty">
                    {hayFiltro ? 'No hay cargos activos en esta área.' : 'Todavía no hay cargos registrados.'}
                  </td>
                </tr>
              ) : (
                cargos.map((cargo) => {
                  const claseNivel = CLASE_BADGE_NIVEL[cargo.nivel_salarial] ?? '';
                  const enEdicion = cargo.id_cargo === idEnEdicion;
                  // requisitos_minimos es el «perfil requerido» de RF-17 (así se llama la columna en la BD y en la API).
                  const requisitos = cargo.requisitos_minimos?.trim();

                  return (
                    <tr key={cargo.id_cargo} className={enEdicion ? 'is-editing' : undefined}>
                      <td>
                        <div className="ui-table__name">
                          {cargo.nombre} <span className="ui-code">{cargo.codigo}</span>
                        </div>
                      </td>
                      <td>{cargo.departamento}</td>
                      <td>
                        <span className={`ui-badge ${claseNivel}`.trim()}>{cargo.nivel_salarial}</span>
                      </td>
                      <td className="ui-table__num">{formatearMonto(cargo.salario_base_referencial)}</td>
                      <td>
                        <ResumenFunciones funciones={cargo.funciones} />
                      </td>
                      <td>
                        {requisitos ? (
                          <div className="cargos-requisitos" title={requisitos}>
                            {requisitos}
                          </div>
                        ) : (
                          <span className="ui-muted">No especificado</span>
                        )}
                      </td>
                      <td className="ui-table__num" title="Último cambio de nivel salarial o de salario">
                        {formatearFechaHora(cargo.fecha_modificacion) ?? <span className="ui-muted">—</span>}
                      </td>
                      <td className="ui-table__actions">
                        <div className="ui-actions">
                          <button
                            type="button"
                            className="ui-icon-btn"
                            onClick={() => onEditar(cargo)}
                            aria-label={`Editar ${cargo.nombre}`}
                            aria-pressed={enEdicion}
                            title="Editar"
                          >
                            <IconoLapiz />
                          </button>
                        </div>
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

import { useId } from 'react';
import FilasCargando from '../../../components/FilasCargando';
import { IconoAlerta, IconoArchivar, IconoCheck, IconoLapiz } from '../../../components/Iconos';

const COLUMNAS = 4;

function AccionesFila({ area, enEdicion, confirmando, bajaEnCurso, onEditar, onPedirBaja, onCancelarBaja, onConfirmarBaja }) {
  if (confirmando) {
    return (
      <div className="ui-actions">
        <span className="ui-actions__prompt">¿Dar de baja?</span>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onCancelarBaja} disabled={bajaEnCurso}>
          Cancelar
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--danger ui-btn--sm"
          onClick={() => onConfirmarBaja(area)}
          disabled={bajaEnCurso}
          autoFocus
        >
          {bajaEnCurso ? 'Procesando…' : 'Dar de baja'}
        </button>
      </div>
    );
  }

  return (
    <div className="ui-actions">
      <button
        type="button"
        className="ui-icon-btn"
        onClick={() => onEditar(area)}
        aria-label={`Editar ${area.nombre}`}
        aria-pressed={enEdicion}
        title="Editar"
      >
        <IconoLapiz />
      </button>
      <button
        type="button"
        className="ui-icon-btn ui-icon-btn--danger"
        onClick={() => onPedirBaja(area)}
        aria-label={`Dar de baja ${area.nombre}`}
        title="Dar de baja"
      >
        <IconoArchivar />
      </button>
    </div>
  );
}

export default function DepartamentosTable({
  areas,
  cargando,
  error,
  onReintentar,
  alerta,
  idEnEdicion,
  idConfirmandoBaja,
  bajaEnCurso,
  onEditar,
  onPedirBaja,
  onCancelarBaja,
  onConfirmarBaja,
}) {
  const uid = useId();

  const subareasPorPadre = new Map();
  areas.forEach(({ id_departamento_padre: idPadre }) => {
    if (idPadre) subareasPorPadre.set(idPadre, (subareasPorPadre.get(idPadre) ?? 0) + 1);
  });

  return (
    <section className="ui-card ui-table-card" aria-labelledby={`${uid}-titulo`}>
      <header className="ui-card__header">
        <div>
          <h3 id={`${uid}-titulo`} className="ui-card__title">
            Áreas registradas
            {!cargando && !error && <span className="ui-count">{areas.length}</span>}
          </h3>
          <p className="ui-card__subtitle">Solo se muestran las áreas activas.</p>
        </div>
      </header>

      {alerta && (
        <div className={`ui-alert ui-alert--${alerta.tipo}`} role={alerta.tipo === 'error' ? 'alert' : 'status'}>
          {alerta.tipo === 'error' ? <IconoAlerta /> : <IconoCheck />}
          <span>{alerta.texto}</span>
        </div>
      )}

      {error && areas.length === 0 ? (
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
                <th scope="col">Área</th>
                <th scope="col">Depende de</th>
                <th scope="col">Sub-áreas</th>
                <th scope="col">
                  <span className="ui-sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <FilasCargando columnas={COLUMNAS} />
              ) : areas.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS} className="ui-table__empty">
                    Todavía no hay áreas activas registradas.
                  </td>
                </tr>
              ) : (
                areas.map((area) => {
                  const enEdicion = area.id_departamento === idEnEdicion;
                  const confirmando = area.id_departamento === idConfirmandoBaja;
                  const subareas = subareasPorPadre.get(area.id_departamento) ?? 0;
                  const clase = confirmando ? 'is-confirming' : enEdicion ? 'is-editing' : undefined;

                  return (
                    <tr key={area.id_departamento} className={clase}>
                      <td>
                        <div className="ui-table__name">
                          {area.nombre} <span className="ui-code">{area.codigo}</span>
                        </div>
                        {area.descripcion && (
                          <div className="ui-table__sub" title={area.descripcion}>
                            {area.descripcion}
                          </div>
                        )}
                      </td>
                      <td>{area.departamento_padre ?? <span className="ui-muted">Nivel superior</span>}</td>
                      <td className="ui-table__num">{subareas > 0 ? subareas : <span className="ui-muted">—</span>}</td>
                      <td className="ui-table__actions">
                        <AccionesFila
                          area={area}
                          enEdicion={enEdicion}
                          confirmando={confirmando}
                          bajaEnCurso={bajaEnCurso}
                          onEditar={onEditar}
                          onPedirBaja={onPedirBaja}
                          onCancelarBaja={onCancelarBaja}
                          onConfirmarBaja={onConfirmarBaja}
                        />
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

import { useId } from 'react';
import FilasCargando from '../../../components/FilasCargando';
import { IconoAlerta, IconoCheck, IconoLapiz } from '../../../components/Iconos';
import { formatearAnios, formatearFecha } from '../utils/formato';
import { ETIQUETAS_CAMPO } from '../utils/vacanteFormulario';

const COLUMNAS = 5;
const HABILIDADES_VISIBLES = 2;

const ESTADOS = {
  borrador: { etiqueta: 'Borrador', clase: 'ui-badge--tone-1' },
  publicada: { etiqueta: 'Publicada', clase: 'ui-badge--tone-2' },
  cerrada: { etiqueta: 'Cerrada', clase: 'vacantes-badge--cerrada' },
};

const FILTROS = [
  { valor: '', etiqueta: 'Todos los estados' },
  { valor: 'borrador', etiqueta: 'Borradores' },
  { valor: 'publicada', etiqueta: 'Publicadas' },
  { valor: 'cerrada', etiqueta: 'Cerradas' },
];

const MENSAJES_VACIO = {
  '': 'Todavía no hay vacantes registradas.',
  borrador: 'No hay borradores.',
  publicada: 'No hay vacantes publicadas.',
  cerrada: 'No hay vacantes cerradas.',
};

const nombresPendientes = (campos) => campos.map((c) => ETIQUETAS_CAMPO[c] ?? c).join(', ');

function ResumenHabilidades({ habilidades }) {
  if (habilidades.length === 0) return <span className="ui-muted">Sin habilidades</span>;

  const visibles = habilidades.slice(0, HABILIDADES_VISIBLES);
  const ocultas = habilidades.slice(HABILIDADES_VISIBLES);

  return (
    <ul className="ui-chips">
      {visibles.map((habilidad) => (
        <li key={habilidad} className="ui-chip" title={habilidad}>
          {habilidad}
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

function Estado({ vacante }) {
  const { etiqueta, clase } = ESTADOS[vacante.estado];
  const pendientes = vacante.campos_pendientes;

  return (
    <>
      <span className={`ui-badge ${clase}`}>{etiqueta}</span>
      {vacante.estado === 'borrador' && pendientes.length > 0 && (
        <div className="vacantes-falta">Falta: {nombresPendientes(pendientes)}</div>
      )}
      {vacante.estado === 'borrador' && pendientes.length === 0 && (
        <div className="ui-table__sub vacantes-listo">Listo para publicar</div>
      )}
      {vacante.estado === 'cerrada' && vacante.esta_activa && <div className="ui-table__sub">Venció el plazo</div>}
    </>
  );
}

function Plazo({ vacante }) {
  const limite = formatearFecha(vacante.fecha_limite_postulacion);

  if (vacante.estado === 'borrador') {
    return limite ? <div className="ui-table__num">Hasta {limite}</div> : <span className="ui-muted">Sin fecha límite</span>;
  }
  return (
    <>
      <div className="ui-table__num">Hasta {limite}</div>
      <div className="ui-table__sub">Publicada {formatearFecha(vacante.fecha_publicacion)}</div>
    </>
  );
}

function AccionesFila({ vacante, enEdicion, confirmando, enProceso, onEditar, onPublicar, onPedirCierre, onCancelarCierre, onConfirmarCierre }) {
  if (confirmando) {
    return (
      <div className="ui-actions">
        <span className="ui-actions__prompt">¿Cerrar postulaciones?</span>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onCancelarCierre} disabled={enProceso}>
          Cancelar
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--danger ui-btn--sm"
          onClick={() => onConfirmarCierre(vacante)}
          disabled={enProceso}
          autoFocus
        >
          {enProceso ? 'Cerrando…' : 'Cerrar'}
        </button>
      </div>
    );
  }

  if (vacante.estado === 'borrador') {
    const pendientes = vacante.campos_pendientes;
    return (
      <div className="ui-actions">
        <button
          type="button"
          className="ui-icon-btn"
          onClick={() => onEditar(vacante)}
          aria-label={`Editar ${vacante.titulo_puesto}`}
          aria-pressed={enEdicion}
          title="Editar"
        >
          <IconoLapiz />
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--primary ui-btn--sm"
          onClick={() => onPublicar(vacante)}
          disabled={enProceso || pendientes.length > 0}
          title={pendientes.length > 0 ? `Completa: ${nombresPendientes(pendientes)}` : 'Publicar y abrir postulaciones'}
        >
          {enProceso ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
    );
  }

  if (vacante.estado === 'publicada') {
    return (
      <div className="ui-actions">
        <button
          type="button"
          className="ui-btn ui-btn--ghost ui-btn--sm"
          onClick={() => onPedirCierre(vacante)}
          title="Dejar de aceptar postulaciones"
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="ui-actions">
      <span className="ui-muted">—</span>
    </div>
  );
}

export default function VacantesTable({
  vacantes,
  cargando,
  error,
  onReintentar,
  estado,
  onCambiarEstado,
  niveles,
  alerta,
  idEnEdicion,
  idConfirmandoCierre,
  idEnProceso,
  onEditar,
  onPublicar,
  onPedirCierre,
  onCancelarCierre,
  onConfirmarCierre,
}) {
  const uid = useId();
  const nombreNivel = (codigo) => niveles.find((n) => n.codigo === codigo)?.nombre ?? codigo;

  return (
    <section className="ui-card ui-table-card vacantes-tabla" aria-labelledby={`${uid}-titulo`}>
      <header className="ui-card__header">
        <div>
          <h3 id={`${uid}-titulo`} className="ui-card__title">
            Vacantes
            {!cargando && !error && <span className="ui-count">{vacantes.length}</span>}
          </h3>
          <p className="ui-card__subtitle">Un borrador se publica cuando tiene todos sus requisitos.</p>
        </div>

        <div className="ui-filter">
          <label htmlFor={`${uid}-estado`} className="ui-filter__label">
            Estado
          </label>
          <select
            id={`${uid}-estado`}
            className="ui-input ui-select ui-select--pill"
            value={estado}
            onChange={(e) => onCambiarEstado(e.target.value)}
          >
            {FILTROS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </header>

      {alerta && (
        <div className={`ui-alert ui-alert--${alerta.tipo}`} role={alerta.tipo === 'error' ? 'alert' : 'status'}>
          {alerta.tipo === 'error' ? <IconoAlerta /> : <IconoCheck />}
          <span>{alerta.texto}</span>
        </div>
      )}

      {error && vacantes.length === 0 ? (
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
                <th scope="col">Vacante</th>
                <th scope="col">Estado</th>
                <th scope="col">Requisitos</th>
                <th scope="col">Plazo</th>
                <th scope="col">
                  <span className="ui-sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <FilasCargando columnas={COLUMNAS} />
              ) : vacantes.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS} className="ui-table__empty">
                    {MENSAJES_VACIO[estado]}
                  </td>
                </tr>
              ) : (
                vacantes.map((vacante) => {
                  const enEdicion = vacante.id_convocatoria === idEnEdicion;
                  const confirmando = vacante.id_convocatoria === idConfirmandoCierre;
                  const clase = confirmando ? 'is-confirming' : enEdicion ? 'is-editing' : undefined;
                  const cantidad = vacante.cantidad_vacantes;

                  return (
                    <tr key={vacante.id_convocatoria} className={clase}>
                      <td>
                        <div className="ui-table__name">
                          {vacante.titulo_puesto} <span className="ui-code">{vacante.codigo_convocatoria}</span>
                        </div>
                        <div className="ui-table__sub">
                          {cantidad} {cantidad === 1 ? 'vacante' : 'vacantes'}
                        </div>
                      </td>
                      <td>
                        <Estado vacante={vacante} />
                      </td>
                      <td>
                        <div className="vacantes-requisitos">
                          {vacante.nivel_educacion_min ? nombreNivel(vacante.nivel_educacion_min) : <span className="ui-muted">Sin formación</span>}
                          {' · '}
                          {formatearAnios(vacante.year_experiencia_min)}
                        </div>
                        <ResumenHabilidades habilidades={vacante.habilidades_clave_requeridas} />
                      </td>
                      <td>
                        <Plazo vacante={vacante} />
                      </td>
                      <td className="ui-table__actions">
                        <AccionesFila
                          vacante={vacante}
                          enEdicion={enEdicion}
                          confirmando={confirmando}
                          enProceso={vacante.id_convocatoria === idEnProceso}
                          onEditar={onEditar}
                          onPublicar={onPublicar}
                          onPedirCierre={onPedirCierre}
                          onCancelarCierre={onCancelarCierre}
                          onConfirmarCierre={onConfirmarCierre}
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

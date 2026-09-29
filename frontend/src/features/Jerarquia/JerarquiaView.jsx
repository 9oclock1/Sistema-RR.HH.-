// src/features/jerarquia/JerarquiaView.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import jerarquiaApi from '../../api/jerarquiaApi';
import './JerarquiaView.css';

const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'short',
  timeStyle: 'medium',
});

export default function JerarquiaView() {
  const [cargos, setCargos] = useState([]);
  const [cargandoCargos, setCargandoCargos] = useState(true);
  const [errorCargos, setErrorCargos] = useState(false);
  const [idSeleccionado, setIdSeleccionado] = useState('');
  const [idSuperiorForm, setIdSuperiorForm] = useState('');
  const [subordinados, setSubordinados] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }
  const [guardando, setGuardando] = useState(false);
  const superiorSelectRef = useRef(null);

  const cargarCargos = useCallback(async () => {
    setCargandoCargos(true);
    setErrorCargos(false);
    try {
      const data = await jerarquiaApi.listarCargos();
      setCargos(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorCargos(true);
      setMensaje({ tipo: 'error', texto: err.message || 'No se pudieron cargar los cargos.' });
    } finally {
      setCargandoCargos(false);
    }
  }, []);

  useEffect(() => {
    cargarCargos();
  }, [cargarCargos]);

  const cargoSeleccionado = cargos.find((c) => c.id_cargo === idSeleccionado) || null;

  const cargarDetalle = useCallback(async (id) => {
    if (!id) {
      setSubordinados([]);
      setHistorial([]);
      return;
    }
    try {
      const [subs, hist] = await Promise.all([
        jerarquiaApi.listarSubordinados(id), // criterio 3
        jerarquiaApi.listarHistorial(id), // criterio 4
      ]);
      setSubordinados(Array.isArray(subs) ? subs : []);
      setHistorial(Array.isArray(hist) ? hist : []);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message || 'No se pudo cargar el detalle del cargo.' });
    }
  }, []);

  function seleccionarCargo(id) {
    setIdSeleccionado(id);
    setMensaje(null);
    const cargo = cargos.find((c) => c.id_cargo === id);
    setIdSuperiorForm(cargo?.id_cargo_superior || '');
    cargarDetalle(id);
  }

  async function guardarSuperior(e) {
    e.preventDefault();
    if (!idSeleccionado) return;
    setMensaje(null);
    setGuardando(true);
    try {
      // Criterios 1 y 4: el backend guarda o reemplaza el superior y conserva el historial
      await jerarquiaApi.asignarSuperior(idSeleccionado, idSuperiorForm || null);
      setMensaje({ tipo: 'ok', texto: 'Relación jerárquica guardada correctamente.' });
      await cargarCargos();
      await cargarDetalle(idSeleccionado);
    } catch (err) {
      // Criterio 2: mensaje de rechazo cuando la relación genera un ciclo.
      // El combo vuelve al superior real (no se queda con el valor rechazado)
      // y el foco va al select para que se note el motivo del error.
      const cargoActual = cargos.find((c) => c.id_cargo === idSeleccionado);
      setIdSuperiorForm(cargoActual?.id_cargo_superior || '');
      setMensaje({
        tipo: 'error',
        texto: err.message || 'No se pudo guardar la relación jerárquica.',
      });
      superiorSelectRef.current?.focus();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="ui-section">
      <header className="ui-section__header">
        <p className="ui-eyebrow">Organización</p>
        <h1 className="ui-section__title">Cadena de mando</h1>
      </header>

      <div className="ui-card jer-ficha">
        <div className="ui-card__header">
          <div>
            <h2 className="ui-card__title">Cargo</h2>
            <p className="ui-card__subtitle">Selecciona un cargo para ver y editar su jerarquía.</p>
          </div>
          <div className="ui-filter">
            <label className="ui-filter__label" htmlFor="jer-cargo-select">
              Cargo
            </label>
            <select
              id="jer-cargo-select"
              className="ui-input ui-select ui-select--pill"
              value={idSeleccionado}
              onChange={(e) => seleccionarCargo(e.target.value)}
              disabled={cargandoCargos || errorCargos}
              title={errorCargos ? 'No se pudieron cargar los cargos' : undefined}
            >
              <option value="">{cargandoCargos ? 'Cargando…' : 'Selecciona un cargo'}</option>
              {cargos.map((c) => (
                <option key={c.id_cargo} value={c.id_cargo}>
                  {c.nombre} ({c.departamento})
                </option>
              ))}
            </select>
          </div>
        </div>

        {mensaje && (
          <div
            className={`ui-alert ui-alert--${mensaje.tipo === 'ok' ? 'success' : 'error'}`}
            role={mensaje.tipo === 'error' ? 'alert' : 'status'}
          >
            <span>{mensaje.texto}</span>
          </div>
        )}

        {!cargoSeleccionado ? (
          <p className="jer-vacio">Selecciona un cargo para ver su jerarquía.</p>
        ) : (
          <>
            <div className="jer-identidad">
              <div className="jer-avatar">{cargoSeleccionado.nombre.slice(0, 2).toUpperCase()}</div>
              <div className="jer-identidad__texto">
                <p className="jer-identidad__nombre">{cargoSeleccionado.nombre}</p>
                <p className="ui-muted">{cargoSeleccionado.departamento}</p>
              </div>
            </div>

            {/* Criterios 1 y 4: asignar o reemplazar el superior directo */}
            <form className="jer-bloque" onSubmit={guardarSuperior}>
              <h3 className="jer-bloque__titulo">Superior directo</h3>
              <div className="jer-bloque__form">
                <div className="ui-field">
                  <label className="ui-field__label" htmlFor="jer-superior-select">
                    Asignar como superior a
                  </label>
                  <select
                    id="jer-superior-select"
                    ref={superiorSelectRef}
                    className="ui-input ui-select"
                    value={idSuperiorForm}
                    onChange={(e) => setIdSuperiorForm(e.target.value)}
                  >
                    <option value="">Sin superior</option>
                    {cargos
                      .filter((c) => c.id_cargo !== idSeleccionado)
                      .map((c) => (
                        <option key={c.id_cargo} value={c.id_cargo}>
                          {c.nombre} ({c.departamento})
                        </option>
                      ))}
                  </select>
                </div>
                <button type="submit" className="ui-btn ui-btn--primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>

            {/* Criterio 3: subordinados */}
            <div className="jer-bloque">
              <h3 className="jer-bloque__titulo">
                Cargos que dependen de este <span className="ui-count">{subordinados.length}</span>
              </h3>
              {subordinados.length > 0 ? (
                <ul className="ui-chips jer-subordinados">
                  {subordinados.map((s) => (
                    <li key={s.id_cargo} className="ui-chip">
                      {s.nombre} · {s.departamento}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ui-muted">Este cargo no tiene subordinados.</p>
              )}
            </div>

            {/* Criterio 4: historial de cambios, en tabla, cierra la tarjeta */}
            <div className="jer-bloque jer-bloque--ultimo">
              <h3 className="jer-bloque__titulo">Historial de cambios</h3>
              {historial.length > 0 ? (
                <div className="ui-table__scroll jer-historial">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Superior anterior</th>
                        <th>Superior nuevo</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((h) => (
                        <tr key={h.id_historial}>
                          <td>{h.superior_anterior || <span className="ui-muted">Sin superior</span>}</td>
                          <td>{h.superior_nuevo || <span className="ui-muted">Sin superior</span>}</td>
                          <td className="ui-table__num">{FORMATO_FECHA.format(new Date(h.cambiado_en))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="ui-muted">Todavía no hay cambios registrados.</p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
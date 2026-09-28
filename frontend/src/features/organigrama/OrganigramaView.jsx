// src/features/organigrama/OrganigramaView.jsx
import { useState, useEffect, useCallback } from 'react';
import organigramaApi from '../../api/organigramaApi';
import OrganigramaNodo from './OrganigramaNodo';
import './OrganigramaView.css';

export default function OrganigramaView() {
  const [arbol, setArbol] = useState([]);
  const [nodoSeleccionado, setNodoSeleccionado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargarOrganigrama = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const { data } = await organigramaApi.obtenerArbol();
      setArbol(Array.isArray(data) ? data : []); // criterios 1 y 4: siempre el estado vigente
    } catch (err) {
      setError('No se pudo cargar el organigrama.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarOrganigrama();
  }, [cargarOrganigrama]);

  const empleados = nodoSeleccionado?.empleados ?? [];

  return (
    <section className="ui-section">
      <header className="ui-section__header">
        <p className="ui-eyebrow">Organización estructural</p>
        <h1 className="ui-section__title">Organigrama</h1>
      </header>

      <div className="ui-split">
        <div className="ui-card organigrama__tree-card">
          <div className="ui-card__header">
            <div>
              <h2 className="ui-card__title">Estructura jerárquica</h2>
              <p className="ui-card__subtitle">Árbol de cargos vigente, en tiempo real.</p>
            </div>
            {/* Criterio 3: exportar la estructura vigente */}
            <a className="ui-btn ui-btn--primary" href={organigramaApi.urlExportar()} download>
              Exportar
            </a>
          </div>

          {error && (
            <div className="ui-alert ui-alert--error" role="alert">
              <span>{error}</span>
            </div>
          )}

          <div className="organigrama__tree">
            {cargando && <p className="ui-muted">Cargando organigrama...</p>}
            {!cargando && !error && arbol.length === 0 && (
              <p className="ui-muted">Todavía no hay cargos con jerarquía definida.</p>
            )}
            {!cargando && arbol.length > 0 && (
              <ul className="organigrama__root">
                {arbol.map((nodo) => (
                  <OrganigramaNodo
                    key={nodo.id_cargo}
                    nodo={nodo}
                    nodoSeleccionado={nodoSeleccionado}
                    onSeleccionar={(n) => setNodoSeleccionado({ ...n, empleados: n.empleados ?? [] })}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Criterio 2: detalle del nodo seleccionado */}
        <aside className="ui-split__aside">
          <div className="ui-card">
            <div className="ui-card__header">
              <div>
                <h2 className="ui-card__title">Detalle del cargo</h2>
              </div>
            </div>

            {!nodoSeleccionado ? (
              <p className="ui-muted">Selecciona un cargo del árbol para ver su detalle.</p>
            ) : (
              <>
                <div className="organigrama__detail-identidad">
                  <div className="organigrama__detail-avatar">
                    {nodoSeleccionado.cargo.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="ui-table__name">{nodoSeleccionado.cargo}</p>
                    <p className="ui-muted">{nodoSeleccionado.departamento || '—'}</p>
                  </div>
                </div>

                <div className="organigrama__detail-bloque">
                  <h3 className="organigrama__detail-titulo">
                    {empleados.length > 1 ? 'Empleados' : 'Empleado'}
                  </h3>
                  {empleados.length === 0 ? (
                    <p className="ui-muted">Vacante</p>
                  ) : (
                    <ul className="ui-chips organigrama__detail-empleados">
                      {empleados.map((emp) => (
                        <li key={emp.id_empleado} className="ui-chip">
                          {emp.nombre}
                          {emp.sucursal ? ` · ${emp.sucursal}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
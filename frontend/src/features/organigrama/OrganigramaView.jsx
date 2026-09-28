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
      setArbol(Array.isArray(data) ? data : []); // Criterios 1 y 4: siempre el estado vigente
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
    <section className="organigrama">
      <header className="organigrama__header">
        <h2 className="organigrama__title">Organigrama</h2>
        {/* Criterio 3: descarga directa con la estructura vigente */}
        <a className="organigrama__export" href={organigramaApi.urlExportar()} download>
          Exportar
        </a>
      </header>

      <div className="organigrama__layout">
        <div className="organigrama__tree">
          {cargando && <p className="organigrama__empty">Cargando organigrama...</p>}
          {error && <p className="organigrama__error">{error}</p>}
          {!cargando && !error && arbol.length === 0 && (
            <p className="organigrama__empty">Todavía no hay cargos con jerarquía definida.</p>
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

        {/* Criterio 2: detalle del nodo seleccionado */}
        <aside className="organigrama__detail">
          {nodoSeleccionado ? (
            <>
              <h3 className="organigrama__detail-title">{nodoSeleccionado.cargo}</h3>
              <p className="organigrama__detail-row">
                <span className="organigrama__detail-label">Área</span>
                <span>{nodoSeleccionado.departamento || '—'}</span>
              </p>
              <div className="organigrama__detail-row">
                <span className="organigrama__detail-label">
                  {empleados.length > 1 ? 'Empleados' : 'Empleado'}
                </span>
                {empleados.length === 0 ? (
                  <span>Vacante</span>
                ) : (
                  <ul className="organigrama__people">
                    {empleados.map((emp, i) => (
                      <li key={emp.id_empleado} className="organigrama__person">
                        <span className="organigrama__index">{i + 1}</span>
                        <span>
                          {emp.nombre}
                          {emp.sucursal ? ` · ${emp.sucursal}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="organigrama__empty">Selecciona un cargo del árbol para ver su detalle.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
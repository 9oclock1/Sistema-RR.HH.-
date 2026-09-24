// src/features/organizacion/OrganizacionView.jsx
import { useState, useEffect, useCallback } from 'react';
import departamentosApi from '../../api/departamentosApi';
import DepartamentoFormModal from '../../components/DepartamentoFormModal';
import './OrganizacionView.css';

export default function OrganizacionView() {
  const [areas, setAreas] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [areaSeleccionada, setAreaSeleccionada] = useState(null);
  const [mensajeBaja, setMensajeBaja] = useState('');
  const [huboErrorBaja, setHuboErrorBaja] = useState(false);

  const cargarAreas = useCallback(async () => {
    try {
      const data = await departamentosApi.listarActivas();
      setAreas(Array.isArray(data) ? data : []);
    } catch {
      setAreas([]);
      setHuboErrorBaja(true);
      setMensajeBaja('No se pudieron cargar las áreas.');
    }
  }, []);

  useEffect(() => {
    cargarAreas();
  }, [cargarAreas]);

  function abrirModalNueva() {
    setAreaSeleccionada(null);
    setModalAbierto(true);
  }

  function abrirModalEditar(area) {
    setAreaSeleccionada(area);
    setModalAbierto(true);
  }

  async function onGuardado() {
    setModalAbierto(false);
    await cargarAreas();
  }

  async function confirmarBaja(area) {
    setMensajeBaja('');
    setHuboErrorBaja(false);

    const confirmado = window.confirm(`¿Dar de baja el área "${area.nombre}"?`);
    if (!confirmado) return;

    try {
      await departamentosApi.darDeBaja(area.id_departamento);
      setMensajeBaja(`Área "${area.nombre}" dada de baja correctamente.`);
      await cargarAreas();
    } catch (err) {
      setHuboErrorBaja(true);
      setMensajeBaja(err.message || 'No se pudo dar de baja el área.');
    }
  }

  return (
    <section className="organizacion-view">
      <header className="encabezado">
        <h2>Áreas y departamentos</h2>
        <button className="btn-primario" onClick={abrirModalNueva}>
          + Nueva área
        </button>
      </header>

      {mensajeBaja && (
        <p className={huboErrorBaja ? 'mensaje-error' : 'mensaje-ok'}>
          {mensajeBaja}
        </p>
      )}

      {areas.length ? (
        <table className="tabla-areas">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {areas.map((area) => (
              <tr key={area.id_departamento}>
                <td>{area.nombre}</td>
                <td>
                  {area.tipo === 'departamento'
                    ? 'Departamento'
                    : 'Sección operativa'}
                </td>
                <td>{area.descripcion || '—'}</td>

                <td className="acciones-tabla">
                  <button
                    className="btn-link"
                    onClick={() => abrirModalEditar(area)}
                  >
                    Editar
                  </button>

                  <button
                    className="btn-link peligro"
                    onClick={() => confirmarBaja(area)}
                  >
                    Dar de baja
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="vacio">No hay áreas activas registradas.</p>
      )}

      {modalAbierto && (
        <DepartamentoFormModal
          area={areaSeleccionada}
          onGuardado={onGuardado}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </section>
  );
}
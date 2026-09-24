// src/components/DepartamentoFormModal.jsx
import { useState } from 'react';
import departamentosApi from '../api/departamentosApi';
import './DepartamentoFormModal.css';

export default function DepartamentoFormModal({ area, onGuardado, onCerrar }) {
  const esEdicion = !!area;

  const [form, setForm] = useState({
    nombre: area?.nombre || '',
    descripcion: area?.descripcion || '',
    tipo: area?.tipo || 'departamento',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      if (esEdicion) {
        // Criterio 2: conserva el id, solo actualiza nombre/descripción
        await departamentosApi.actualizar(area.id_departamento, {
          nombre: form.nombre,
          descripcion: form.descripcion,
        });
      } else {
        // Criterio 1
        await departamentosApi.crear(form);
      }
      onGuardado();
    } catch (err) {
      setError(err.message || 'Ocurrió un error al guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-card">
        <h3>{esEdicion ? 'Modificar área' : 'Registrar nueva área'}</h3>

        <form onSubmit={handleSubmit}>
          <label>Nombre</label>
          <input
            name="nombre"
            type="text"
            value={form.nombre}
            onChange={handleChange}
            required
            placeholder="Ej: Panadería"
          />

          <label>Descripción</label>
          <textarea
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
            placeholder="Descripción del área..."
          />

          {!esEdicion && (
            <>
              <label>Tipo</label>
              <select name="tipo" value={form.tipo} onChange={handleChange}>
                <option value="departamento">Departamento</option>
                <option value="seccion_operativa">Sección operativa</option>
              </select>
            </>
          )}

          {error && <p className="mensaje-error">{error}</p>}

          <div className="acciones">
            <button type="button" className="btn-secundario" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
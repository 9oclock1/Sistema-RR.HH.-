import React, { useState, useEffect } from 'react';
import { getCargos, createCargo } from '../../api/cargosApi';
import './Cargos.css';

export default function CargosList() {
  const [cargos, setCargos] = useState([]);
  const [filtroArea, setFiltroArea] = useState('');
  const [errorValidacion, setErrorValidacion] = useState(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    id_nivel_salarial: '',
    id_departamento: '',
    perfil_requerido: ''
  });

  useEffect(() => {
    cargarDatos();
  }, [filtroArea]);

  const cargarDatos = async () => {
    try {
      const data = await getCargos(filtroArea);
      setCargos(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errorValidacion) setErrorValidacion(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.id_nivel_salarial) {
      setErrorValidacion("El nombre del cargo y el nivel salarial son obligatorios.");
      return;
    }

    try {
      const payload = {
        ...formData,
        id_nivel_salarial: parseInt(formData.id_nivel_salarial),
        id_departamento: formData.id_departamento ? parseInt(formData.id_departamento) : null
      };

      await createCargo(payload);
      
      setFormData({ nombre: '', id_nivel_salarial: '', id_departamento: '', perfil_requerido: '' });
      cargarDatos();
    } catch (error) {
      setErrorValidacion(error.message);
    }
  };

  return (
    <div className="cargos-container">
      <header className="cargos-header">
        <h2>Catálogo de Cargos</h2>
        <p>Gestión de puestos y niveles salariales de la organización</p>
      </header>

      <div className="cargos-layout">
        <section className="cargos-form-section">
          <h3>Registrar Nuevo Cargo</h3>
          
          {errorValidacion && (
            <div className="alert-error">
              {errorValidacion}
            </div>
          )}

          <form onSubmit={handleSubmit} className="cargos-form">
            <div className="form-group">
              <label>Nombre del Cargo *</label>
              <input 
                type="text" 
                name="nombre" 
                value={formData.nombre} 
                onChange={handleInputChange}
                placeholder="Ej. Analista Contable"
              />
            </div>

            <div className="form-group">
              <label>Nivel Salarial *</label>
              <select 
                name="id_nivel_salarial" 
                value={formData.id_nivel_salarial} 
                onChange={handleInputChange}
              >
                <option value="">Seleccione un nivel...</option>
                <option value="1">Nivel 1 - Operativo</option>
                <option value="2">Nivel 2 - Técnico</option>
                <option value="3">Nivel 3 - Jefatura</option>
              </select>
            </div>

            <div className="form-group">
              <label>Departamento (Opcional)</label>
              <select 
                name="id_departamento" 
                value={formData.id_departamento} 
                onChange={handleInputChange}
              >
                <option value="">Sin departamento asignado</option>
                <option value="1">Administración</option>
                <option value="2">Ventas</option>
              </select>
            </div>

            <div className="form-group">
              <label>Perfil Requerido</label>
              <textarea 
                name="perfil_requerido" 
                value={formData.perfil_requerido} 
                onChange={handleInputChange}
                placeholder="Conocimientos, experiencia..."
                rows="3"
              ></textarea>
            </div>

            <button type="submit" className="btn-submit">Guardar Cargo</button>
          </form>
        </section>

        <section className="cargos-list-section">
          <div className="list-controls">
            <h3>Cargos Registrados</h3>
            <div className="filter-group">
              <label>Filtrar por Departamento:</label>
              <select 
                value={filtroArea} 
                onChange={(e) => setFiltroArea(e.target.value)}
              >
                <option value="">Todos los departamentos</option>
                <option value="1">Administración</option>
                <option value="2">Ventas</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="cargos-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cargo</th>
                  <th>Nivel Salarial</th>
                  <th>Departamento</th>
                </tr>
              </thead>
              <tbody>
                {cargos.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-state">No hay cargos registrados.</td>
                  </tr>
                ) : (
                  cargos.map(cargo => (
                    <tr key={cargo.id_cargo}>
                      <td>{cargo.id_cargo}</td>
                      <td>{cargo.nombre}</td>
                      <td>Nivel {cargo.id_nivel_salarial}</td>
                      <td>{cargo.id_departamento ? `Dept. ${cargo.id_departamento}` : 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
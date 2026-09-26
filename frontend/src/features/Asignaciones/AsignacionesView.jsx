import { useId, useState } from 'react';
import FichaEmpleado from './components/FichaEmpleado';
import { useEmpleados } from './hooks/useEmpleados';
import { useFichaEmpleado } from './hooks/useFichaEmpleado';
import './Asignaciones.css';

export default function AsignacionesView() {
  const uid = useId();
  const [idEmpleado, setIdEmpleado] = useState('');
  const empleados = useEmpleados();
  const ficha = useFichaEmpleado(idEmpleado);

  const selector = (
    <div className="ui-filter">
      <label htmlFor={`${uid}-empleado`} className="ui-filter__label">
        Empleado
      </label>
      <select
        id={`${uid}-empleado`}
        className="ui-input ui-select ui-select--pill"
        value={idEmpleado}
        onChange={(e) => setIdEmpleado(e.target.value)}
        disabled={empleados.cargando || Boolean(empleados.error)}
        title={empleados.error ? 'No se pudieron cargar los empleados' : undefined}
      >
        <option value="">{empleados.cargando ? 'Cargando…' : 'Selecciona un empleado'}</option>
        {empleados.empleados.map((e) => (
          <option key={e.id_empleado} value={e.id_empleado}>
            {e.nombre_completo} · CI {e.numero_documento}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section className="ui-section" aria-labelledby="asignaciones-titulo">
      <header className="ui-section__header">
        <p className="ui-eyebrow">Organización estructural</p>
        <h2 id="asignaciones-titulo" className="ui-section__title">
          Asignación de personal
        </h2>
      </header>

      <FichaEmpleado
        ficha={ficha.ficha}
        cargando={ficha.cargando}
        error={ficha.error}
        onReintentar={ficha.recargar}
        selector={selector}
      />
    </section>
  );
}

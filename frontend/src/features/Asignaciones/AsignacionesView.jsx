import { useEffect, useId, useState } from 'react';
import { createAsignacion } from '../../api/asignacionesApi';
import { useCargos } from '../Cargos/hooks/useCargos';
import AsignacionForm from './components/AsignacionForm';
import FichaEmpleado from './components/FichaEmpleado';
import { useEmpleados } from './hooks/useEmpleados';
import { useFichaEmpleado } from './hooks/useFichaEmpleado';
import { useSucursales } from './hooks/useSucursales';
import './Asignaciones.css';

const DURACION_AVISO_MS = 4000;

export default function AsignacionesView() {
  const uid = useId();
  const [idEmpleado, setIdEmpleado] = useState('');
  const empleados = useEmpleados();
  const ficha = useFichaEmpleado(idEmpleado);
  const catalogoCargos = useCargos('');
  const catalogoSucursales = useSucursales();

  const [formKey, setFormKey] = useState(0);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    if (!aviso) return undefined;
    const timer = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
    return () => clearTimeout(timer);
  }, [aviso]);

  const seleccionarEmpleado = (id) => {
    setIdEmpleado(id);
    setAviso(null);
    setFormKey((k) => k + 1);
  };

  const asignar = async (payload) => {
    try {
      const fichaActualizada = await createAsignacion(payload);
      const { cargo, sucursal } = fichaActualizada.asignacion_actual;
      ficha.reemplazar(fichaActualizada);
      setAviso({ texto: `${fichaActualizada.nombre_completo} asignado a ${cargo.nombre} en ${sucursal.nombre}.` });
      setFormKey((k) => k + 1);
      empleados.recargar();
    } catch (error) {
      if (error.status === 400) {
        catalogoCargos.recargar();
        catalogoSucursales.recargar();
      }
      throw error;
    }
  };

  const selector = (
    <div className="ui-filter">
      <label htmlFor={`${uid}-empleado`} className="ui-filter__label">
        Empleado
      </label>
      <select
        id={`${uid}-empleado`}
        className="ui-input ui-select ui-select--pill"
        value={idEmpleado}
        onChange={(e) => seleccionarEmpleado(e.target.value)}
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

      <div className="ui-split">
        <div className="ui-split__aside">
          <AsignacionForm
            key={`${idEmpleado}#${formKey}`}
            empleado={ficha.ficha}
            cargos={catalogoCargos.cargos}
            cargandoCargos={catalogoCargos.cargando}
            errorCargos={catalogoCargos.error}
            sucursales={catalogoSucursales.sucursales}
            cargandoSucursales={catalogoSucursales.cargando}
            errorSucursales={catalogoSucursales.error}
            aviso={aviso?.texto}
            onAsignar={asignar}
          />
        </div>

        <FichaEmpleado
          ficha={ficha.ficha}
          cargando={ficha.cargando}
          error={ficha.error}
          onReintentar={ficha.recargar}
          selector={selector}
        />
      </div>
    </section>
  );
}

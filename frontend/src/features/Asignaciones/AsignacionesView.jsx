import { useState } from 'react';
import { Link } from 'react-router';
import { createAsignacion } from '../../api/asignacionesApi';
import { EncabezadoPagina, Selector, useAvisos } from '../../components/ui';
import { useCargos } from '../Cargos/hooks/useCargos';
import AsignacionForm from './components/AsignacionForm';
import FichaEmpleado from './components/FichaEmpleado';
import { useEmpleados } from './hooks/useEmpleados';
import { useFichaEmpleado } from './hooks/useFichaEmpleado';
import { useSucursales } from './hooks/useSucursales';
import './Asignaciones.css';

export default function AsignacionesView() {
  const avisar = useAvisos();
  const [idEmpleado, setIdEmpleado] = useState('');
  const empleados = useEmpleados();
  const ficha = useFichaEmpleado(idEmpleado);
  const catalogoCargos = useCargos('');
  const catalogoSucursales = useSucursales();

  const [formKey, setFormKey] = useState(0);

  const seleccionarEmpleado = (id) => {
    setIdEmpleado(id);
    setFormKey((k) => k + 1);
  };

  const asignar = async (payload) => {
    try {
      const fichaActualizada = await createAsignacion(payload);
      const { cargo, sucursal } = fichaActualizada.asignacion_actual;
      ficha.reemplazar(fichaActualizada);
      avisar({
        tono: 'exito',
        titulo: 'Asignación registrada',
        mensaje: `${fichaActualizada.nombre_completo} asignado a ${cargo.nombre} en ${sucursal.nombre}.`,
      });
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
    <Selector
      className="asig-selector"
      aria-label="Empleado"
      value={idEmpleado}
      onChange={(e) => seleccionarEmpleado(e.target.value)}
      disabled={empleados.cargando || Boolean(empleados.error)}
      title={empleados.error ? 'No se pudieron cargar los empleados' : undefined}
      textoVacio={empleados.cargando ? 'Cargando…' : 'Selecciona un empleado'}
      opciones={empleados.empleados.map((e) => ({
        valor: e.id_empleado,
        etiqueta: `${e.nombre_completo} · CI ${e.numero_documento}`,
      }))}
    />
  );

  return (
    <section className="asig" aria-labelledby="asignaciones-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Organización' }]}
        enlace={Link}
        titulo="Asignaciones"
        idTitulo="asignaciones-titulo"
        descripcion="Vincula a cada empleado con un cargo y una sucursal, y consulta su historial."
      />

      <div className="asig-split">
        <AsignacionForm
          key={`${idEmpleado}#${formKey}`}
          empleado={ficha.ficha}
          cargos={catalogoCargos.cargos}
          cargandoCargos={catalogoCargos.cargando}
          errorCargos={catalogoCargos.error}
          sucursales={catalogoSucursales.sucursales}
          cargandoSucursales={catalogoSucursales.cargando}
          errorSucursales={catalogoSucursales.error}
          onAsignar={asignar}
        />

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

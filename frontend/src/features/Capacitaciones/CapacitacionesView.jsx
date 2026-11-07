import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { IdCard } from 'lucide-react';
import { createCapacitacion } from '../../api/capacitacionesApi';
import { Alerta, Boton, EncabezadoPagina } from '../../components/ui';
import { useRol } from '../../context/sesion';
import { RUTA_KARDEX } from '../Kardex/ruta';
import { formatearFecha } from '../Vacantes/utils/formato';
import CapacitacionForm from './components/CapacitacionForm';
import './Capacitaciones.css';

export default function CapacitacionesView() {
  const rol = useRol();
  const [parametros, setParametros] = useSearchParams();
  const idEmpleado = parametros.get('empleado') ?? '';
  const [registrada, setRegistrada] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const refResultado = useRef(null);

  useEffect(() => {
    if (registrada) refResultado.current?.focus();
  }, [registrada]);

  const cambiarEmpleado = (id) => setParametros(id ? { empleado: id } : {}, { replace: true });

  const registrar = async (datos) => {
    setRegistrada(await createCapacitacion(datos, { rol }));
    setFormKey((k) => k + 1);
  };

  return (
    <section className="capa" aria-labelledby="capacitaciones-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Expediente' }]}
        enlace={Link}
        titulo="Capacitaciones y certificaciones"
        idTitulo="capacitaciones-titulo"
        descripcion="Registra cursos, carnets y certificaciones aprobadas por el personal con su vigencia y certificado digital."
      />

      <div className="capa-contenido">
        {registrada && (
          <div className="capa-resultado" ref={refResultado} tabIndex={-1}>
            <Alerta
              tono="exito"
              role="status"
              titulo={`«${registrada.curso}» registrado para ${registrada.empleado}`}
              acciones={
                <Boton as={Link} to={`${RUTA_KARDEX}/${registrada.id_empleado}`} tamano="sm" icono={IdCard}>
                  Ver en el Kardex
                </Boton>
              }
            >
              {registrada.fecha_vencimiento
                ? `La certificación vence el ${formatearFecha(registrada.fecha_vencimiento)} y ya forma parte del Kardex del colaborador.`
                : 'La capacitación no tiene vencimiento y ya forma parte del Kardex del colaborador.'}
            </Alerta>
          </div>
        )}

        <CapacitacionForm
          key={formKey}
          idEmpleado={idEmpleado}
          onCambiarEmpleado={cambiarEmpleado}
          onRegistrar={registrar}
        />
      </div>
    </section>
  );
}

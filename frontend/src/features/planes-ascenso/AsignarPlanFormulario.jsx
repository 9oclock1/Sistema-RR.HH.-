import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { getCargos } from '../../api/cargosApi';
import { getEmpleados } from '../../api/empleadosApi';
import { Alerta, Boton, CampoAreaTexto, Selector, Tarjeta } from '../../components/ui';
import useRecurso from '../quejas/casos/useRecurso';

const VACIO = { id_empleado: '', id_cargo_destino: '', observaciones: '' };

const cargarOpciones = () => Promise.all([getEmpleados(), getCargos()]).then(([empleados, cargos]) => ({ empleados, cargos }));

// Criterio 1: el Administrador asigna el plan eligiendo al candidato y el cargo al que aspira; el servidor rechaza
// los cargos sin capacitaciones requeridas.
export default function AsignarPlanFormulario({ onAsignar }) {
  const [formulario, setFormulario] = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  // cargarOpciones está fuera del componente: es la misma función en cada render y no vuelve a disparar la carga.
  const opciones = useRecurso(cargarOpciones);

  const empleados = (opciones.datos?.empleados ?? []).filter((e) => e.activo);
  const empleado = empleados.find((e) => e.id_empleado === formulario.id_empleado);
  const cargos = (opciones.datos?.cargos ?? []).filter((c) => c.id_cargo !== empleado?.id_cargo);

  const cambiar = (evento) => {
    setFormulario((actual) => ({ ...actual, [evento.target.name]: evento.target.value }));
    setError(null);
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await onAsignar({ ...formulario, observaciones: formulario.observaciones.trim() || undefined });
      setFormulario(VACIO);
    } catch (fallo) {
      setError(fallo);
    } finally {
      setEnviando(false);
    }
  };

  const errorDe = (campo) => error?.errores?.find((e) => e.campo === campo)?.mensaje;

  return (
    <Tarjeta nivelTitulo={2} titulo="Asignar plan de ascenso">
      <form className="pa-formulario" onSubmit={enviar} noValidate>
        {opciones.error && (
          <Alerta tono="peligro" titulo="No se pudieron cargar los empleados o los cargos">
            {opciones.error.message}
          </Alerta>
        )}
        <div className="pa-formulario__campos">
          <Selector
            name="id_empleado"
            etiqueta="Candidato"
            requerido
            value={formulario.id_empleado}
            onChange={cambiar}
            textoVacio={opciones.cargando ? 'Cargando…' : 'Seleccione un empleado activo'}
            opciones={empleados.map((e) => ({ valor: e.id_empleado, etiqueta: `${e.nombre_completo} · ${e.cargo}` }))}
            error={errorDe('id_empleado')}
          />
          <Selector
            name="id_cargo_destino"
            etiqueta="Cargo destino"
            requerido
            value={formulario.id_cargo_destino}
            onChange={cambiar}
            textoVacio="Seleccione el cargo al que aspira"
            opciones={cargos.map((c) => ({ valor: c.id_cargo, etiqueta: c.nombre }))}
            error={errorDe('id_cargo_destino')}
          />
        </div>
        <CampoAreaTexto
          name="observaciones"
          etiqueta="Observaciones"
          ayuda="Opcional. Hasta 500 caracteres."
          maxLength={500}
          rows={2}
          value={formulario.observaciones}
          onChange={cambiar}
        />
        {error && !error.errores?.length && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo asignar el plan">
            {error.message}
          </Alerta>
        )}
        <div>
          <Boton
            type="submit"
            variante="primario"
            icono={UserPlus}
            cargando={enviando}
            disabled={!formulario.id_empleado || !formulario.id_cargo_destino}
          >
            Asignar plan
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

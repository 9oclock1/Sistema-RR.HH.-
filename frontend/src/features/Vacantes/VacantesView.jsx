import { useEffect, useRef, useState } from 'react';
import {
  cerrarConvocatoria,
  createConvocatoria,
  publicarConvocatoria,
  updateConvocatoria,
} from '../../api/convocatoriasApi';
import { useCargos } from '../Cargos/hooks/useCargos';
import VacanteForm from './components/VacanteForm';
import VacantesTable from './components/VacantesTable';
import { useConvocatorias } from './hooks/useConvocatorias';
import { useNivelesEducacion } from './hooks/useNivelesEducacion';
import { formatearFecha } from './utils/formato';
import './Vacantes.css';

const DURACION_AVISO_MS = 4000;

export default function VacantesView() {
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const { convocatorias, cargando, error, recargar } = useConvocatorias(estadoFiltro);
  const catalogoCargos = useCargos('');
  const { niveles } = useNivelesEducacion();

  const [vacanteEnEdicion, setVacanteEnEdicion] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [aviso, setAviso] = useState(null);
  const formRef = useRef(null);

  const [idConfirmandoCierre, setIdConfirmandoCierre] = useState(null);
  const [idEnProceso, setIdEnProceso] = useState(null);
  const [alerta, setAlerta] = useState(null);

  useEffect(() => {
    if (!aviso) return undefined;
    const timer = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
    return () => clearTimeout(timer);
  }, [aviso]);

  useEffect(() => {
    if (alerta?.tipo !== 'success') return undefined;
    const timer = setTimeout(() => setAlerta(null), DURACION_AVISO_MS);
    return () => clearTimeout(timer);
  }, [alerta]);

  const abrirFormulario = (vacante) => {
    setVacanteEnEdicion(vacante);
    setFormKey((k) => k + 1);
  };

  const iniciarEdicion = (vacante) => {
    setAviso(null);
    setIdConfirmandoCierre(null);
    abrirFormulario(vacante);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // Tras guardar, el borrador queda abierto: lo habitual es completarlo en varias pasadas antes de publicarlo.
  const guardar = async (payload) => {
    const guardada = vacanteEnEdicion
      ? await updateConvocatoria(vacanteEnEdicion.id_convocatoria, payload)
      : await createConvocatoria(payload);

    setAviso({ texto: `Borrador ${guardada.codigo_convocatoria} ${vacanteEnEdicion ? 'actualizado' : 'guardado'}.` });
    abrirFormulario(guardada);
    recargar();
  };

  // Publicar y cerrar comparten el mismo manejo: una fila en proceso, alerta en la tabla y recarga siempre,
  // porque un 409 significa que el estado cambió por otro lado.
  const ejecutarAccion = async (vacante, accion, mensajeExito) => {
    setAlerta(null);
    setIdEnProceso(vacante.id_convocatoria);
    try {
      const actualizada = await accion(vacante.id_convocatoria);
      setAlerta({ tipo: 'success', texto: mensajeExito(actualizada) });
      if (vacanteEnEdicion?.id_convocatoria === vacante.id_convocatoria) abrirFormulario(null);
    } catch (err) {
      setAlerta({ tipo: 'error', texto: err.message });
    } finally {
      setIdEnProceso(null);
      setIdConfirmandoCierre(null);
      recargar();
    }
  };

  const publicar = (vacante) =>
    ejecutarAccion(
      vacante,
      publicarConvocatoria,
      (v) => `${v.codigo_convocatoria} publicada. Recibe postulaciones hasta el ${formatearFecha(v.fecha_limite_postulacion)}.`
    );

  const pedirCierre = (vacante) => {
    setAlerta(null);
    setIdConfirmandoCierre(vacante.id_convocatoria);
  };

  const confirmarCierre = (vacante) =>
    ejecutarAccion(
      vacante,
      cerrarConvocatoria,
      (v) => `${v.codigo_convocatoria} cerrada. Las postulaciones registradas se conservan.`
    );

  return (
    <section className="ui-section vacantes" aria-labelledby="vacantes-titulo">
      <header className="ui-section__header">
        <p className="ui-eyebrow">Reclutamiento</p>
        <h2 id="vacantes-titulo" className="ui-section__title">
          Gestión de vacantes
        </h2>
      </header>

      <div className="ui-split">
        <div ref={formRef} className="ui-split__aside">
          <VacanteForm
            key={formKey}
            convocatoria={vacanteEnEdicion}
            cargos={catalogoCargos.cargos}
            errorCargos={catalogoCargos.error}
            cargandoCargos={catalogoCargos.cargando}
            aviso={aviso?.texto}
            onGuardar={guardar}
            onCancelar={() => abrirFormulario(null)}
          />
        </div>

        <VacantesTable
          vacantes={convocatorias}
          cargando={cargando}
          error={error}
          onReintentar={recargar}
          estado={estadoFiltro}
          onCambiarEstado={setEstadoFiltro}
          niveles={niveles}
          alerta={alerta}
          idEnEdicion={vacanteEnEdicion?.id_convocatoria}
          idConfirmandoCierre={idConfirmandoCierre}
          idEnProceso={idEnProceso}
          onEditar={iniciarEdicion}
          onPublicar={publicar}
          onPedirCierre={pedirCierre}
          onCancelarCierre={() => setIdConfirmandoCierre(null)}
          onConfirmarCierre={confirmarCierre}
        />
      </div>
    </section>
  );
}

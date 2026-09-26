import { useEffect, useRef, useState } from 'react';
import { createConvocatoria, updateConvocatoria } from '../../api/convocatoriasApi';
import { useCargos } from '../Cargos/hooks/useCargos';
import VacanteForm from './components/VacanteForm';
import './Vacantes.css';

const DURACION_AVISO_MS = 4000;

export default function VacantesView() {
  const catalogoCargos = useCargos('');

  const [vacanteEnEdicion, setVacanteEnEdicion] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [aviso, setAviso] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (!aviso) return undefined;
    const timer = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
    return () => clearTimeout(timer);
  }, [aviso]);

  const abrirFormulario = (vacante) => {
    setVacanteEnEdicion(vacante);
    setFormKey((k) => k + 1);
  };

  // Tras guardar, el borrador queda abierto: lo habitual es completarlo en varias pasadas antes de publicarlo.
  const guardar = async (payload) => {
    const guardada = vacanteEnEdicion
      ? await updateConvocatoria(vacanteEnEdicion.id_convocatoria, payload)
      : await createConvocatoria(payload);

    setAviso({ texto: `Borrador ${guardada.codigo_convocatoria} ${vacanteEnEdicion ? 'actualizado' : 'guardado'}.` });
    abrirFormulario(guardada);
  };

  return (
    <section className="ui-section" aria-labelledby="vacantes-titulo">
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
      </div>
    </section>
  );
}

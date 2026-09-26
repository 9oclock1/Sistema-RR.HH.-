import { useEffect, useRef, useState } from 'react';
import { createCargo, updateCargo } from '../../api/cargosApi';
import { useDepartamentosActivos } from '../../hooks/useDepartamentosActivos';
import CargoForm from './components/CargoForm';
import CargosTable from './components/CargosTable';
import { useCargos } from './hooks/useCargos';
import './Cargos.css';

const DURACION_AVISO_MS = 4000;

export default function CargosList() {
  const [areaFiltro, setAreaFiltro] = useState('');
  const { cargos, cargando, error, recargar } = useCargos(areaFiltro);
  const areas = useDepartamentosActivos();

  const [cargoEnEdicion, setCargoEnEdicion] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [aviso, setAviso] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (!aviso) return undefined;
    const timer = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
    return () => clearTimeout(timer);
  }, [aviso]);

  const abrirFormulario = (cargo) => {
    setCargoEnEdicion(cargo);
    setFormKey((k) => k + 1);
  };

  const iniciarEdicion = (cargo) => {
    setAviso(null);
    abrirFormulario(cargo);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const guardar = async (payload) => {
    const guardado = cargoEnEdicion
      ? await updateCargo(cargoEnEdicion.id_cargo, payload)
      : await createCargo(payload);

    setAviso({ texto: `Cargo «${guardado.nombre}» ${cargoEnEdicion ? 'actualizado' : 'creado'}.` });
    abrirFormulario(null);
    recargar();
  };

  return (
    <section className="ui-section" aria-labelledby="cargos-titulo">
      <header className="ui-section__header">
        <p className="ui-eyebrow">Organización estructural</p>
        <h2 id="cargos-titulo" className="ui-section__title">
          Catálogo de cargos
        </h2>
      </header>

      <div className="ui-split">
        <div ref={formRef} className="ui-split__aside">
          <CargoForm
            key={formKey}
            cargo={cargoEnEdicion}
            departamentos={areas.departamentos}
            errorDepartamentos={areas.error}
            cargandoCatalogos={areas.cargando}
            aviso={aviso?.texto}
            onGuardar={guardar}
            onCancelar={() => abrirFormulario(null)}
          />
        </div>

        <CargosTable
          cargos={cargos}
          cargando={cargando}
          error={error}
          onReintentar={recargar}
          areaId={areaFiltro}
          onCambiarArea={setAreaFiltro}
          departamentos={areas.departamentos}
          errorDepartamentos={areas.error}
          idEnEdicion={cargoEnEdicion?.id_cargo}
          onEditar={iniciarEdicion}
        />
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { createCargo, updateCargo } from '../../api/cargosApi';
import CargoForm from './components/CargoForm';
import CargosTable from './components/CargosTable';
import { useCargos } from './hooks/useCargos';
import { useCatalogosCargo } from './hooks/useCatalogosCargo';
import './Cargos.css';

const DURACION_AVISO_MS = 4000;

export default function CargosList() {
  const [areaFiltro, setAreaFiltro] = useState('');
  const { cargos, cargando, error, recargar } = useCargos(areaFiltro);
  const catalogos = useCatalogosCargo();

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
    <section className="cargos" aria-labelledby="cargos-titulo">
      <header className="cargos__header">
        <p className="cargos__eyebrow">Organización estructural</p>
        <h2 id="cargos-titulo" className="cargos__title">
          Catálogo de cargos
        </h2>
      </header>

      <div className="cargos__layout">
        <div ref={formRef} className="cargos__form-col">
          <CargoForm
            key={formKey}
            cargo={cargoEnEdicion}
            departamentos={catalogos.departamentos}
            niveles={catalogos.niveles}
            errorDepartamentos={catalogos.errorDepartamentos}
            errorNiveles={catalogos.errorNiveles}
            cargandoCatalogos={catalogos.cargando}
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
          departamentos={catalogos.departamentos}
          errorDepartamentos={catalogos.errorDepartamentos}
          niveles={catalogos.niveles}
          idEnEdicion={cargoEnEdicion?.id_cargo}
          onEditar={iniciarEdicion}
        />
      </div>
    </section>
  );
}

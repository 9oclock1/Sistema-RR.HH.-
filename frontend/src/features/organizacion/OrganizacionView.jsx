import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import departamentosApi from '../../api/departamentosApi';
import { EncabezadoPagina } from '../../components/ui';
import { useDepartamentosActivos } from '../../hooks/useDepartamentosActivos';
import DepartamentoForm from './components/DepartamentoForm';
import DepartamentosTable from './components/DepartamentosTable';
import './OrganizacionView.css';

const DURACION_AVISO_MS = 4000;

export default function OrganizacionView() {
  const { departamentos: areas, cargando, error, recargar } = useDepartamentosActivos();

  const [areaEnEdicion, setAreaEnEdicion] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [aviso, setAviso] = useState(null);
  const formRef = useRef(null);

  const [idConfirmandoBaja, setIdConfirmandoBaja] = useState(null);
  const [bajaEnCurso, setBajaEnCurso] = useState(false);
  const [alertaBaja, setAlertaBaja] = useState(null);
  useEffect(() => {
    if (!aviso) return undefined;
    const timer = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
    return () => clearTimeout(timer);
  }, [aviso]);

  useEffect(() => {
    if (alertaBaja?.tipo !== 'success') return undefined;
    const timer = setTimeout(() => setAlertaBaja(null), DURACION_AVISO_MS);
    return () => clearTimeout(timer);
  }, [alertaBaja]);

  const abrirFormulario = (area) => {
    setAreaEnEdicion(area);
    setFormKey((k) => k + 1);
  };

  const iniciarEdicion = (area) => {
    setAviso(null);
    setIdConfirmandoBaja(null);
    abrirFormulario(area);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const guardar = async (payload) => {
    const guardada = areaEnEdicion
      ? await departamentosApi.actualizar(areaEnEdicion.id_departamento, payload)
      : await departamentosApi.crear(payload);

    setAviso({ texto: `Área «${guardada.nombre}» ${areaEnEdicion ? 'actualizada' : 'creada'}.` });
    abrirFormulario(null);
  };

  const pedirBaja = (area) => {
    setAlertaBaja(null);
    setIdConfirmandoBaja(area.id_departamento);
  };

  const confirmarBaja = async (area) => {
    setBajaEnCurso(true);
    try {
      await departamentosApi.darDeBaja(area.id_departamento);
      setAlertaBaja({ tipo: 'success', texto: `Área «${area.nombre}» dada de baja.` });
      if (areaEnEdicion?.id_departamento === area.id_departamento) abrirFormulario(null);
    } catch (err) {
      setAlertaBaja({ tipo: 'error', texto: err.message || 'No se pudo dar de baja el área.' });
    } finally {
      setBajaEnCurso(false);
      setIdConfirmandoBaja(null);
    }
  };

  return (
    <section className="organizacion" aria-labelledby="organizacion-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Organización' }]}
        enlace={Link}
        titulo="Áreas"
        idTitulo="organizacion-titulo"
        descripcion="Departamentos y áreas de la empresa."
      />

      <div className="ui-section ui-split">
        <div ref={formRef} className="ui-split__aside">
          <DepartamentoForm
            key={formKey}
            area={areaEnEdicion}
            areas={areas}
            errorAreas={error}
            cargandoAreas={cargando}
            aviso={aviso?.texto}
            onGuardar={guardar}
            onCancelar={() => abrirFormulario(null)}
          />
        </div>

        <DepartamentosTable
          areas={areas}
          cargando={cargando}
          error={error}
          onReintentar={recargar}
          alerta={alertaBaja}
          idEnEdicion={areaEnEdicion?.id_departamento}
          idConfirmandoBaja={idConfirmandoBaja}
          bajaEnCurso={bajaEnCurso}
          onEditar={iniciarEdicion}
          onPedirBaja={pedirBaja}
          onCancelarBaja={() => setIdConfirmandoBaja(null)}
          onConfirmarBaja={confirmarBaja}
        />
      </div>
    </section>
  );
}

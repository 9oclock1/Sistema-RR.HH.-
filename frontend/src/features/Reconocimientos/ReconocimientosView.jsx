import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { createReconocimiento } from '../../api/reconocimientosApi';
import { Alerta, EncabezadoPagina } from '../../components/ui';
import ReconocimientoForm from './components/ReconocimientoForm';
import ReconocimientoPreview from './components/ReconocimientoPreview';
import './Reconocimientos.css';

const VALORES_INICIALES = {
  id_empleado_receptor: '',
  id_tipo_memo: '',
  asunto: '',
  contenido_descripcion: '',
};

export default function ReconocimientosView() {
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [reconocimiento, setReconocimiento] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const refResultado = useRef(null);

  useEffect(() => {
    if (reconocimiento) refResultado.current?.focus();
  }, [reconocimiento]);

  const cambiar = (campo, valor) => setValores((previos) => ({ ...previos, [campo]: valor }));

  const emitir = async (datos) => {
    setReconocimiento(await createReconocimiento(datos));
    setValores(VALORES_INICIALES);
    setFormKey((k) => k + 1);
  };

  return (
    <section className="reco" aria-labelledby="reconocimientos-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Reconocimientos' }]}
        enlace={Link}
        titulo="Felicitaciones"
        idTitulo="reconocimientos-titulo"
        descripcion="Emite memorándums de felicitación por méritos laborales y déjalos registrados en el Kardex del colaborador."
      />

      {reconocimiento && (
        <div className="reco-resultado" ref={refResultado} tabIndex={-1}>
          <Alerta tono="exito" role="status" titulo={`Reconocimiento ${reconocimiento.codigo_cite} emitido correctamente`}>
            <p>El documento de reconocimiento quedó generado y asociado al Kardex del colaborador.</p>
            <p className="reco-documento">
              <span className="reco-documento__etiqueta">Documento PDF</span>
              <code className="reco-documento__ruta">{reconocimiento.documento_pdf_url}</code>
            </p>
          </Alerta>
        </div>
      )}

      <div className="reco-split">
        <ReconocimientoForm key={formKey} valores={valores} onCambiar={cambiar} onEmitir={emitir} />
        <ReconocimientoPreview valores={valores} />
      </div>
    </section>
  );
}

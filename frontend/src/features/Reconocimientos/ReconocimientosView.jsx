import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Download } from 'lucide-react';
import { urlPdfMemorandum } from '../../api/memorandumsApi';
import { createReconocimiento } from '../../api/reconocimientosApi';
import { Alerta, Boton, EncabezadoPagina } from '../../components/ui';
import { useEmpleados } from '../Asignaciones/hooks/useEmpleados';
import { useTiposMemorandum } from '../Memorandums/hooks/useTiposMemorandum';
import { leerEmpleado } from '../marcaje/sesionEmpleado';
import ReconocimientoForm from './components/ReconocimientoForm';
import ReconocimientoPreview from './components/ReconocimientoPreview';
import { CLASIFICACION_RECONOCIMIENTO } from './utils/opciones';
import './Reconocimientos.css';

const VALORES_INICIALES = {
  id_empleado_emisor: '',
  id_empleado_receptor: '',
  id_tipo_memo: '',
  asunto: '',
  contenido_descripcion: '',
};

export default function ReconocimientosView() {
  // Temporal hasta contar con inicio de sesión: quien otorga se elige y se recuerda para los siguientes reconocimientos.
  // Parte de la persona identificada en el módulo de marcaje, si la hay.
  const [valores, setValores] = useState(() => ({ ...VALORES_INICIALES, id_empleado_emisor: leerEmpleado() ?? '' }));
  const empleados = useEmpleados();
  const tipos = useTiposMemorandum(CLASIFICACION_RECONOCIMIENTO);
  const [reconocimiento, setReconocimiento] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const refResultado = useRef(null);

  useEffect(() => {
    if (reconocimiento) refResultado.current?.focus();
  }, [reconocimiento]);

  const cambiar = (campo, valor) => setValores((previos) => ({ ...previos, [campo]: valor }));

  const emitir = async (datos) => {
    setReconocimiento(await createReconocimiento(datos));
    setValores((previos) => ({ ...VALORES_INICIALES, id_empleado_emisor: previos.id_empleado_emisor }));
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
            <div className="reco-documento">
              <Boton
                variante="primario"
                tamano="sm"
                icono={Download}
                href={urlPdfMemorandum(reconocimiento.id_memorandum)}
                download={`${reconocimiento.codigo_cite}.pdf`}
              >
                Descargar PDF
              </Boton>
            </div>
          </Alerta>
        </div>
      )}

      {(empleados.error || tipos.error) && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar los datos del formulario"
          acciones={
            <Boton
              tamano="sm"
              onClick={() => {
                if (empleados.error) empleados.recargar();
                if (tipos.error) tipos.recargar();
              }}
            >
              Reintentar
            </Boton>
          }
        >
          {(empleados.error ?? tipos.error).message}
        </Alerta>
      )}

      <div className="reco-split">
        <ReconocimientoForm
          key={formKey}
          valores={valores}
          empleados={empleados.empleados}
          tipos={tipos.tipos}
          cargando={empleados.cargando || tipos.cargando}
          onCambiar={cambiar}
          onEmitir={emitir}
        />
        <ReconocimientoPreview valores={valores} empleados={empleados.empleados} tipos={tipos.tipos} />
      </div>
    </section>
  );
}

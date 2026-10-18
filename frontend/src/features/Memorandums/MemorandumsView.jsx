import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Download } from 'lucide-react';
import { createMemorandum, urlPdfMemorandum } from '../../api/memorandumsApi';
import { Alerta, Boton, EncabezadoPagina } from '../../components/ui';
import { useEmpleados } from '../Asignaciones/hooks/useEmpleados';
import { leerEmpleado } from '../marcaje/sesionEmpleado';
import MemorandumForm from './components/MemorandumForm';
import { useTiposMemorandum } from './hooks/useTiposMemorandum';
import { CLASIFICACION_AMONESTACION } from './utils/opciones';
import './Memorandums.css';

export default function MemorandumsView() {
  const [resultado, setResultado] = useState(null);
  const [formKey, setFormKey] = useState(0);
  // Temporal hasta contar con inicio de sesión: quien emite se elige y se recuerda para los siguientes memorándums.
  // Parte de la persona identificada en el módulo de marcaje, si la hay.
  const [idEmisor, setIdEmisor] = useState(leerEmpleado);
  const refResultado = useRef(null);
  const empleados = useEmpleados();
  const tipos = useTiposMemorandum(CLASIFICACION_AMONESTACION);

  // El resultado aparece arriba del formulario: se lleva el foco para que no pase inadvertido.
  useEffect(() => {
    if (resultado) refResultado.current?.focus();
  }, [resultado]);

  const emitir = async (datos, receptor) => {
    const respuesta = await createMemorandum(datos);
    setResultado({ ...respuesta, receptor });
    setFormKey((k) => k + 1);
  };

  const memorandum = resultado?.memorandum;
  const receptor = resultado?.receptor ?? 'El empleado';

  return (
    <section className="memo" aria-labelledby="memorandums-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Disciplina' }]}
        enlace={Link}
        titulo="Llamadas de atención"
        idTitulo="memorandums-titulo"
        descripcion="Emite memorándums de llamada de atención y déjalos registrados en el Kardex del empleado."
      />

      <div className="memo-contenido">
        {memorandum && (
          <div className="memo-resultado" ref={refResultado} tabIndex={-1}>
            {resultado.alerta_roja && (
              <Alerta tono="peligro" role="alert" titulo="Alerta roja: el empleado alcanzó el límite de faltas">
                {receptor} ya acumulaba tres o más llamadas de atención en los últimos seis meses. Se recomienda que
                RR.HH. revise su caso.
              </Alerta>
            )}

            <Alerta tono="exito" role="status" titulo={`Memorándum ${memorandum.codigo_cite} emitido correctamente`}>
              <p>El documento oficial quedó generado y asociado al Kardex del empleado.</p>
              <div className="memo-documento">
                <Boton
                  variante="primario"
                  tamano="sm"
                  icono={Download}
                  href={urlPdfMemorandum(memorandum.id_memorandum)}
                  download={`${memorandum.codigo_cite}.pdf`}
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

        <MemorandumForm
          key={formKey}
          empleados={empleados.empleados}
          tipos={tipos.tipos}
          cargando={empleados.cargando || tipos.cargando}
          idEmisorInicial={idEmisor}
          onCambiarEmisor={setIdEmisor}
          onEmitir={emitir}
        />
      </div>
    </section>
  );
}

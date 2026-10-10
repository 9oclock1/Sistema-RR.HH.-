import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { createMemorandum } from '../../api/memorandumsApi';
import { Alerta, EncabezadoPagina } from '../../components/ui';
import MemorandumForm from './components/MemorandumForm';
import './Memorandums.css';

export default function MemorandumsView() {
  const [resultado, setResultado] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const refResultado = useRef(null);

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
              <p className="memo-documento">
                <span className="memo-documento__etiqueta">Documento PDF</span>
                <code className="memo-documento__ruta">{memorandum.documento_pdf_url}</code>
              </p>
            </Alerta>
          </div>
        )}

        <MemorandumForm key={formKey} onEmitir={emitir} />
      </div>
    </section>
  );
}

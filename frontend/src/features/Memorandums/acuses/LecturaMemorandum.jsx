import { useState } from 'react';
import { CheckCircle2, Download } from 'lucide-react';
import { urlPdfMemorandum } from '../../../api/memorandumsApi';
import { Alerta, Boton, CampoAreaTexto, Esqueleto, Etiqueta, Modal, ModalConfirmacion } from '../../../components/ui';
import { claseMemorandum, estadoAcuse, formatearFecha, formatearFechaHora } from './formatoAcuse';

// Mismo límite que valida EmployeeService.
const COMENTARIO_MAX = 2000;

// RF-39 (criterios 2 y 3): lectura del memorándum con el botón para acusar recibo y el descargo opcional.
export default function LecturaMemorandum({ memo, cargando, onCerrar, onAcusar }) {
  const [comentario, setComentario] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);

  const recibido = memo?.acuse_recibo_firmado;
  const vencido = memo?.estado_acuse === 'VENCIDO';
  const estado = memo ? estadoAcuse(memo.estado_acuse) : null;

  const acusar = async () => {
    setProcesando(true);
    setError(null);
    try {
      await onAcusar(comentario.trim());
      setConfirmando(false);
    } catch (falla) {
      setConfirmando(false);
      setError(falla.message);
    } finally {
      setProcesando(false);
    }
  };

  const pie = (
    <>
      <Boton variante="sutil" onClick={onCerrar}>
        Cerrar
      </Boton>
      {memo && !recibido && (
        <Boton variante="primario" icono={CheckCircle2} onClick={() => setConfirmando(true)}>
          Confirmar lectura / Acusar recibo
        </Boton>
      )}
    </>
  );

  return (
    <>
      <Modal abierto titulo={memo ? `Memorándum ${memo.codigo_cite}` : 'Memorándum'} onCerrar={onCerrar} pie={pie} bloqueado={procesando}>
        {cargando || !memo ? (
          <div className="acuse-lectura" aria-busy="true">
            <Esqueleto alto="20px" />
            <Esqueleto alto="120px" />
          </div>
        ) : (
          <div className="acuse-lectura">
            <dl className="acuse-lectura__datos">
              <div>
                <dt>Tipo</dt>
                <dd>
                  <Etiqueta tono={memo.es_reconocimiento ? 'exito' : 'aviso'}>{claseMemorandum(memo)}</Etiqueta>{' '}
                  {memo.tipo_nombre}
                </dd>
              </div>
              <div>
                <dt>Emitido</dt>
                <dd>
                  {formatearFecha(memo.fecha_emision)}
                  {memo.emisor_nombre && ` por ${memo.emisor_nombre}`}
                </dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <Etiqueta tono={estado.tono}>{estado.etiqueta}</Etiqueta>
                </dd>
              </div>
            </dl>

            <h3 className="acuse-lectura__asunto">{memo.asunto}</h3>
            <p className="acuse-lectura__contenido">{memo.contenido_descripcion}</p>

            {memo.documento_pdf_url && (
              <Boton
                variante="predeterminado"
                tamano="sm"
                icono={Download}
                href={urlPdfMemorandum(memo.id_memorandum)}
                download={`${memo.codigo_cite}.pdf`}
                className="acuse-lectura__pdf"
              >
                Descargar documento oficial
              </Boton>
            )}

            {error && (
              <Alerta tono="peligro" role="alert" titulo="No se pudo registrar el acuse">
                {error}
              </Alerta>
            )}

            {recibido ? (
              <Alerta tono="exito" titulo="Notificado y Recibido">
                <p>Acusó recibo el {formatearFechaHora(memo.fecha_hora_acuse)}.</p>
                {memo.comentario_descargo && (
                  <p className="acuse-lectura__descargo">
                    <strong>Su descargo:</strong> {memo.comentario_descargo}
                  </p>
                )}
              </Alerta>
            ) : (
              <>
                <Alerta tono={vencido ? 'peligro' : 'aviso'} titulo="Lectura obligatoria">
                  {vencido
                    ? `El plazo para acusar recibo venció el ${formatearFechaHora(memo.fecha_limite_acuse)} y RR.HH. fue notificado. Aún puede acusar recibo.`
                    : memo.fecha_limite_acuse
                      ? `Confirme que leyó este memorándum antes del ${formatearFechaHora(memo.fecha_limite_acuse)}.`
                      : 'Confirme que leyó este memorándum.'}
                </Alerta>
                <CampoAreaTexto
                  id="acuse-comentario"
                  etiqueta="Descargo o comentario (opcional)"
                  ayuda={`Quedará registrado junto con su acuse. ${comentario.length}/${COMENTARIO_MAX} caracteres.`}
                  value={comentario}
                  onChange={(evento) => setComentario(evento.target.value)}
                  maxLength={COMENTARIO_MAX}
                  filas={4}
                  disabled={procesando}
                />
              </>
            )}
          </div>
        )}
      </Modal>

      <ModalConfirmacion
        abierto={confirmando}
        titulo="¿Acusar recibo del memorándum?"
        textoConfirmar="Acusar recibo"
        variante="primario"
        procesando={procesando}
        onConfirmar={acusar}
        onCancelar={() => setConfirmando(false)}
      >
        <p>
          Se registrarán la fecha y hora exactas, su dirección IP y su usuario
          {comentario.trim() ? ', junto con su descargo' : ''}. Una vez confirmado, el acuse no se puede deshacer ni
          modificar.
        </p>
      </ModalConfirmacion>
    </>
  );
}

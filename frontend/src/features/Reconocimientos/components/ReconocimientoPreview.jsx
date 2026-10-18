import { Star } from 'lucide-react';
import { Tarjeta } from '../../../components/ui';
import { DOCUMENTO } from '../utils/opciones';

const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });

function Dato({ valor, pendiente, className }) {
  return <p className={valor ? className : `${className} reco-doc__pendiente`}>{valor || pendiente}</p>;
}

// Los datos del colaborador y de quien otorga salen de la misma lista que el formulario, que es la del Kardex.
export default function ReconocimientoPreview({ valores, empleados, tipos }) {
  const empleado = empleados.find((opcion) => opcion.id_empleado === valores.id_empleado_receptor);
  const emisor = empleados.find((opcion) => opcion.id_empleado === valores.id_empleado_emisor);
  const idTipo = valores.id_tipo_memo || (tipos.length === 1 ? String(tipos[0].id_tipo_memo) : '');
  const tipo = tipos.find((opcion) => String(opcion.id_tipo_memo) === idTipo);

  return (
    <Tarjeta titulo="Previsualización" className="reco-preview">
      <div className="reco-doc">
        <div className="reco-doc__hoja">
          <div className="reco-doc__membrete">
            <div>
              <p className="reco-doc__institucion">{DOCUMENTO.institucion}</p>
              <p className="reco-doc__meta">{DOCUMENTO.unidad}</p>
            </div>
            <p className="reco-doc__meta">CITE al emitir</p>
          </div>

          <div className="reco-doc__titulo">
            <span className="reco-doc__insignia">
              <Star className="ds-icono" aria-hidden="true" />
            </span>
            <p className="reco-doc__nombre-documento">{DOCUMENTO.titulo}</p>
            <p className="reco-doc__meta reco-doc__mayusculas">{DOCUMENTO.subtitulo}</p>
            <p className="reco-doc__distintivo">{DOCUMENTO.distintivo}</p>
            <p className="reco-doc__meta">{FORMATO_FECHA.format(new Date())}</p>
          </div>

          <div className="reco-doc__homenajeado">
            <p className="reco-doc__meta reco-doc__mayusculas">Se otorga a</p>
            <Dato className="reco-doc__colaborador" valor={empleado?.nombre_completo} pendiente="Nombre del colaborador" />
            <Dato
              className="reco-doc__meta"
              valor={empleado && `${empleado.cargo} · ${empleado.sucursal} · C.I. ${empleado.numero_documento}`}
              pendiente="Cargo · Sucursal · C.I."
            />
          </div>

          <div className="reco-doc__motivo">
            <p className="reco-doc__meta reco-doc__mayusculas">Motivo del reconocimiento</p>
            <Dato className="reco-doc__asunto" valor={valores.asunto.trim()} pendiente="Asunto del reconocimiento" />
            <Dato className="reco-doc__meta" valor={tipo?.nombre} pendiente="Tipo de reconocimiento" />
          </div>

          <Dato
            className="reco-doc__texto"
            valor={valores.contenido_descripcion.trim()}
            pendiente="Aquí aparecerá el texto de reconocimiento mientras lo redactas."
          />
          <p className="reco-doc__texto">{DOCUMENTO.cierre}</p>

          <p className="reco-doc__felicitacion">¡Felicitaciones!</p>

          <div className="reco-doc__firma">
            <Dato className="reco-doc__firmante" valor={emisor?.nombre_completo} pendiente="Quien otorga" />
            <Dato className="reco-doc__meta" valor={emisor?.cargo} pendiente="Cargo" />
            <p className="reco-doc__meta">Otorgado por</p>
          </div>
        </div>
      </div>

      <p className="reco-preview__nota">
        Vista de referencia. El PDF oficial se genera al emitir, con el CITE correlativo y los datos del Kardex.
      </p>
    </Tarjeta>
  );
}

import { Award, FileText, FileWarning } from 'lucide-react';
import { EstadoVacio, Etiqueta, Tabla } from '../../../components/ui';
import { formatearFechaHora } from '../../Cargos/utils/formato';
import { formatearFecha } from '../../Vacantes/utils/formato';
import { Archivo, Celda, SinDato } from './comunes';

const GRAVEDADES = { LEVE: 'Gravedad leve', MODERADA: 'Gravedad moderada', GRAVE: 'Gravedad grave' };

const confirmacion = (memo) => {
  if (memo.acuse_recibo_firmado) {
    return { tono: 'exito', texto: 'Acuse firmado', fecha: memo.fecha_hora_acuse };
  }
  if (memo.fue_notificado) {
    return { tono: 'info', texto: 'Notificado, sin acuse', fecha: memo.fecha_hora_notificacion };
  }
  return { tono: 'neutral', texto: 'Sin notificar', fecha: null };
};

const COLUMNAS = [
  {
    clave: 'tipo',
    titulo: 'Tipo',
    ancho: '19%',
    celda: (memo) =>
      memo.es_reconocimiento ? (
        <Etiqueta tono="exito" icono={Award}>
          Reconocimiento
        </Etiqueta>
      ) : (
        <div className="kardex-celda kardex-celda--inicio">
          <Etiqueta tono={memo.gravedad_falta === 'GRAVE' ? 'peligro' : 'aviso'} icono={FileWarning}>
            Llamada de atención
          </Etiqueta>
          <span className="kardex-celda__sub">{GRAVEDADES[memo.gravedad_falta]}</span>
        </div>
      ),
  },
  {
    clave: 'codigo_cite',
    titulo: 'CITE y fecha',
    ancho: '15%',
    celda: (memo) => <Celda mono principal={memo.codigo_cite} secundario={formatearFecha(memo.fecha_emision)} />,
  },
  {
    clave: 'asunto',
    titulo: 'Motivo',
    celda: (memo) => <Celda principal={memo.asunto} secundario={`${memo.tipo_nombre} · Emitió ${memo.emisor_nombre}`} />,
  },
  {
    clave: 'respaldos',
    titulo: 'Respaldos',
    ancho: '24%',
    celda: (memo) =>
      memo.documento_pdf_url || memo.evidencia_adjunto_url ? (
        <div className="kardex-celda kardex-celda--inicio">
          {memo.documento_pdf_url && <Archivo etiqueta="PDF" ruta={memo.documento_pdf_url} />}
          {memo.evidencia_adjunto_url && <Archivo etiqueta="Evidencia" ruta={memo.evidencia_adjunto_url} />}
        </div>
      ) : (
        <SinDato />
      ),
  },
  {
    clave: 'confirmacion',
    titulo: 'Confirmación',
    ancho: '17%',
    celda: (memo) => {
      const { tono, texto, fecha } = confirmacion(memo);
      return (
        <div className="kardex-celda kardex-celda--inicio">
          <Etiqueta tono={tono}>{texto}</Etiqueta>
          {fecha && <span className="kardex-celda__sub">{formatearFechaHora(fecha)}</span>}
        </div>
      );
    },
  },
];

export default function TablaMemorandums({ memorandums, nombre }) {
  return (
    <Tabla
      className="kardex-tabla"
      descripcion={`Memorándums de ${nombre}`}
      columnas={COLUMNAS}
      filas={memorandums}
      claveFila="id_memorandum"
      vacio={
        <EstadoVacio
          icono={FileText}
          titulo="Sin memorándums"
          mensaje="Este colaborador aún no tiene llamadas de atención ni reconocimientos."
        />
      }
    />
  );
}

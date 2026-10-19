import { FileText } from 'lucide-react';
import { EstadoVacio, Etiqueta, Tabla, TextoTruncado } from '../../../components/ui';
import { formatearMonto } from '../../Cargos/utils/formato';
import { formatearFecha } from '../../Vacantes/utils/formato';
import { Archivo, Celda, SinDato } from './comunes';

const COLUMNAS = [
  {
    clave: 'numero_contrato',
    titulo: 'N.º de contrato',
    ancho: '23%',
    celda: (contrato) => (
      <div className="kardex-celda">
        <div className="kardex-celda__linea">
          <TextoTruncado className="kardex-codigo">{contrato.numero_contrato}</TextoTruncado>
          {contrato.es_adenda && <Etiqueta tono="morado">Adenda</Etiqueta>}
        </div>
        {contrato.motivo_adenda && <TextoTruncado className="kardex-celda__sub">{contrato.motivo_adenda}</TextoTruncado>}
      </div>
    ),
  },
  {
    clave: 'tipo_contrato',
    titulo: 'Tipo y jornada',
    celda: (contrato) => (
      <Celda
        principal={contrato.tipo_contrato}
        secundario={`${contrato.tipo_jornada} · ${contrato.horas_semanales} h semanales`}
      />
    ),
  },
  {
    clave: 'fecha_inicio',
    titulo: 'Vigencia',
    ancho: '16%',
    celda: (contrato) => (
      <Celda
        principal={`Desde ${formatearFecha(contrato.fecha_inicio)}`}
        secundario={contrato.fecha_fin ? `Hasta ${formatearFecha(contrato.fecha_fin)}` : 'Plazo indefinido'}
      />
    ),
  },
  {
    clave: 'haber_mensual_pactado',
    titulo: 'Haber mensual',
    ancho: '12%',
    alinear: 'fin',
    celda: (contrato) => formatearMonto(contrato.haber_mensual_pactado),
  },
  {
    clave: 'esta_vigente',
    titulo: 'Estado',
    ancho: '10%',
    celda: (contrato) =>
      contrato.esta_vigente ? <Etiqueta tono="exito">Vigente</Etiqueta> : <Etiqueta>No vigente</Etiqueta>,
  },
  {
    clave: 'documento_adjunto_url',
    titulo: 'Documento',
    ancho: '17%',
    celda: (contrato) => (contrato.documento_adjunto_url ? <Archivo ruta={contrato.documento_adjunto_url} /> : <SinDato />),
  },
];

export default function TablaContratos({ contratos, nombre }) {
  return (
    <Tabla
      className="kardex-tabla"
      descripcion={`Contratos y adendas de ${nombre}`}
      columnas={COLUMNAS}
      filas={contratos}
      claveFila="id_contrato"
      vacio={
        <EstadoVacio
          icono={FileText}
          titulo="Sin contratos"
          mensaje="Este colaborador aún no tiene contratos ni adendas registrados."
        />
      }
    />
  );
}

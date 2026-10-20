import { Etiqueta, TextoTruncado } from '../../../components/ui';
import { formatearMonto } from '../../Cargos/utils/formato';
import { formatearFecha } from '../../Vacantes/utils/formato';
import { TIPOS_MODIFICACION } from '../utils/opciones';
import { estadoVersion } from '../utils/versiones';

function Dato({ etiqueta, children }) {
  return (
    <div className="contratos-dato">
      <dt>{etiqueta}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function ResumenVersionActual({ version }) {
  const estado = estadoVersion(version);

  return (
    <div className="contratos-actual">
      <div className="contratos-actual__encabezado">
        <TextoTruncado as="h3" className="contratos-actual__titulo">
          Versión {version.numero_version} · <span className="contratos-codigo">{version.numero_contrato}</span>
        </TextoTruncado>
        <Etiqueta tono="morado">{TIPOS_MODIFICACION[version.tipo_modificacion]}</Etiqueta>
        {estado && <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>}
      </div>
      <dl className="contratos-actual__datos">
        <Dato etiqueta="Tipo de contrato">{version.tipo_contrato}</Dato>
        <Dato etiqueta="Jornada">{`${version.tipo_jornada} (${version.horas_semanales} h)`}</Dato>
        <Dato etiqueta="Haber mensual">{formatearMonto(version.haber_mensual_pactado)}</Dato>
        <Dato etiqueta="Rige desde">{formatearFecha(version.fecha_vigencia)}</Dato>
        <Dato etiqueta="Fin del contrato">
          {version.fecha_fin_contrato ? formatearFecha(version.fecha_fin_contrato) : 'Plazo indefinido'}
        </Dato>
      </dl>
    </div>
  );
}

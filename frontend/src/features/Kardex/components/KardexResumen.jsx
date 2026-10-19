import {
  Award,
  Banknote,
  Briefcase,
  Building2,
  CalendarDays,
  FilePen,
  Files,
  FileText,
  FileWarning,
  Gauge,
  Hourglass,
  Inbox,
  MapPin,
  Scale,
  TriangleAlert,
} from 'lucide-react';
import { Etiqueta, Tarjeta, TextoTruncado } from '../../../components/ui';
import { formatearMonto } from '../../Cargos/utils/formato';
import { formatearFecha } from '../../Vacantes/utils/formato';

const cantidad = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

function Tile({ icono: Icono, titulo, children }) {
  return (
    <Tarjeta className="kardex-tile">
      <div className="kardex-tile__encabezado">
        <span className="kardex-tile__icono" aria-hidden="true">
          <Icono className="ds-icono" />
        </span>
        <h3 className="kardex-tile__titulo">{titulo}</h3>
      </div>
      {children}
    </Tarjeta>
  );
}

function Meta({ icono: Icono, children }) {
  return (
    <li>
      {Icono && <Icono className="ds-icono" aria-hidden="true" />}
      <TextoTruncado>{children}</TextoTruncado>
    </li>
  );
}

function Cifra({ valor, singular, plural }) {
  return (
    <span className="kardex-tile__par">
      <span className="kardex-tile__cifra">{valor}</span> {valor === 1 ? singular : plural}
    </span>
  );
}

function Antiguedad({ antiguedad, fechaIngreso }) {
  const { anios, meses } = antiguedad;
  return (
    <Tile icono={Hourglass} titulo="Antigüedad">
      {anios === 0 && meses === 0 ? (
        <p className="kardex-tile__valor">Menos de un mes</p>
      ) : (
        <p className="kardex-tile__cifras">
          {anios > 0 && <Cifra valor={anios} singular="año" plural="años" />}
          {meses > 0 && <Cifra valor={meses} singular="mes" plural="meses" />}
        </p>
      )}
      <ul className="kardex-tile__meta">
        <Meta icono={CalendarDays}>Ingresó el {formatearFecha(fechaIngreso)}</Meta>
      </ul>
    </Tile>
  );
}

function Posicion({ cargo, area, sucursal }) {
  return (
    <Tile icono={Briefcase} titulo="Posición actual">
      <div>
        <TextoTruncado as="p" className="kardex-tile__valor">
          {cargo.nombre}
        </TextoTruncado>
        <TextoTruncado as="p" className="kardex-tile__sub">
          {cargo.nivel_salarial}
        </TextoTruncado>
      </div>
      <ul className="kardex-tile__meta">
        <Meta icono={Building2}>{area.nombre}</Meta>
        <Meta icono={MapPin}>
          {sucursal.nombre}
          {sucursal.ciudad && `, ${sucursal.ciudad}`}
        </Meta>
        {cargo.vigente_desde && <Meta icono={CalendarDays}>En el cargo desde el {formatearFecha(cargo.vigente_desde)}</Meta>}
      </ul>
    </Tile>
  );
}

function Balance({ balance }) {
  const gravedades = [
    [balance.sanciones_graves, 'grave', 'graves'],
    [balance.sanciones_moderadas, 'moderada', 'moderadas'],
    [balance.sanciones_leves, 'leve', 'leves'],
  ]
    .filter(([n]) => n > 0)
    .map(([n, singular, plural]) => cantidad(n, singular, plural))
    .join(', ');

  return (
    <Tile icono={Scale} titulo="Balance disciplinario">
      <dl className="kardex-balance">
        <div className="kardex-balance__item">
          <dt>
            <Award className="ds-icono kardex-balance__icono--positivo" aria-hidden="true" />
            Reconocimientos
          </dt>
          <dd className="kardex-tile__cifra">{balance.total_reconocimientos}</dd>
        </div>
        <div className="kardex-balance__item">
          <dt>
            <FileWarning className="ds-icono kardex-balance__icono--negativo" aria-hidden="true" />
            Sanciones
          </dt>
          <dd className="kardex-tile__cifra">{balance.total_sanciones}</dd>
        </div>
      </dl>
      <ul className="kardex-tile__meta">
        {gravedades && <Meta icono={Gauge}>Gravedad: {gravedades}</Meta>}
        {balance.fecha_ultima_sancion && <Meta icono={CalendarDays}>Última sanción el {formatearFecha(balance.fecha_ultima_sancion)}</Meta>}
        {balance.total_sanciones === 0 && balance.total_reconocimientos === 0 && <Meta icono={Inbox}>Sin memorándums registrados</Meta>}
      </ul>
      {balance.memorandums_sin_acuse > 0 && (
        <Etiqueta tono="aviso" className="kardex-tile__aviso">
          {cantidad(balance.memorandums_sin_acuse, 'memorándum sin acuse', 'memorándums sin acuse')}
        </Etiqueta>
      )}
    </Tile>
  );
}

function Contrato({ contrato, totales }) {
  const registrados = `${cantidad(totales.contratos, 'contrato', 'contratos')} y ${cantidad(totales.adendas, 'adenda', 'adendas')}`;

  return (
    <Tile icono={FilePen} titulo="Estado del contrato">
      {contrato ? (
        <>
          <div className="kardex-tile__fila">
            <TextoTruncado as="p" className="kardex-tile__valor">
              {contrato.tipo_contrato}
            </TextoTruncado>
            <Etiqueta tono="exito">Vigente</Etiqueta>
          </div>
          <ul className="kardex-tile__meta">
            <Meta icono={FileText}>
              <span className="kardex-codigo">{contrato.numero_contrato}</span> · {contrato.tipo_jornada}
            </Meta>
            <Meta icono={CalendarDays}>
              {contrato.fecha_fin ? `Hasta el ${formatearFecha(contrato.fecha_fin)}` : 'Plazo indefinido'}
            </Meta>
            <Meta icono={Banknote}>Haber mensual de {formatearMonto(contrato.haber_mensual_pactado)}</Meta>
            <Meta icono={Files}>{registrados}</Meta>
          </ul>
        </>
      ) : (
        <>
          <div className="kardex-tile__fila">
            <Etiqueta tono="aviso" icono={TriangleAlert}>
              Sin contrato vigente
            </Etiqueta>
          </div>
          <ul className="kardex-tile__meta">
            <Meta icono={Files}>{registrados}</Meta>
          </ul>
        </>
      )}
    </Tile>
  );
}

export default function KardexResumen({ resumen, fechaIngreso }) {
  return (
    <section className="kardex-resumen" aria-label="Resumen del colaborador">
      <Antiguedad antiguedad={resumen.antiguedad} fechaIngreso={fechaIngreso} />
      <Posicion cargo={resumen.cargo_actual} area={resumen.area} sucursal={resumen.sucursal} />
      <Balance balance={resumen.balance_disciplinario} />
      <Contrato contrato={resumen.contrato_vigente} totales={resumen.totales} />
    </section>
  );
}

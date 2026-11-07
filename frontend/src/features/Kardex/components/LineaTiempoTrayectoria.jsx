import { ArrowLeftRight, Briefcase, History, LogIn, MapPin, TrendingUp } from 'lucide-react';
import { EstadoVacio, Etiqueta, TextoTruncado } from '../../../components/ui';
import { formatearFecha } from '../../Vacantes/utils/formato';

const MOVIMIENTOS = {
  ingreso: { icono: LogIn, etiqueta: 'Ingreso', tono: 'info' },
  ascenso: { icono: TrendingUp, etiqueta: 'Ascenso', tono: 'exito' },
  cambioCargo: { icono: Briefcase, etiqueta: 'Cambio de cargo', tono: 'neutral' },
  traslado: { icono: ArrowLeftRight, etiqueta: 'Traslado', tono: 'morado' },
  renovacion: { icono: History, etiqueta: 'Renovación', tono: 'neutral' },
};

const movimientosDe = (hito) => {
  if (!hito.cargo_anterior) return [MOVIMIENTOS.ingreso];

  const movimientos = [];
  if (hito.es_ascenso) movimientos.push(MOVIMIENTOS.ascenso);
  else if (hito.cambio_cargo) movimientos.push(MOVIMIENTOS.cambioCargo);
  if (hito.cambio_sucursal) movimientos.push(MOVIMIENTOS.traslado);
  return movimientos.length > 0 ? movimientos : [MOVIMIENTOS.renovacion];
};

const origenDe = (hito) => {
  if (hito.cambio_cargo && hito.cambio_sucursal) return `${hito.cargo_anterior} en ${hito.sucursal_anterior}`;
  if (hito.cambio_cargo) return hito.cargo_anterior;
  if (hito.cambio_sucursal) return hito.sucursal_anterior;
  return null;
};

function Hito({ hito }) {
  const movimientos = movimientosDe(hito);
  const { icono: Icono } = movimientos[0];
  const origen = origenDe(hito);

  return (
    <li className={`kardex-hito ${hito.es_ascenso ? 'kardex-hito--ascenso' : ''}`}>
      <span className="kardex-hito__marca" aria-hidden="true">
        <Icono className="ds-icono" />
      </span>
      <div className="kardex-hito__cuerpo">
        <p className="kardex-hito__fechas">
          <time dateTime={hito.fecha_inicio}>{formatearFecha(hito.fecha_inicio)}</time>
          {' – '}
          {hito.fecha_fin ? <time dateTime={hito.fecha_fin}>{formatearFecha(hito.fecha_fin)}</time> : 'Actualidad'}
        </p>
        <div className="kardex-hito__encabezado">
          <TextoTruncado as="h3" className="kardex-hito__cargo">
            {hito.cargo}
          </TextoTruncado>
          {movimientos.map((movimiento) => (
            <Etiqueta key={movimiento.etiqueta} tono={movimiento.tono} icono={movimiento.icono}>
              {movimiento.etiqueta}
            </Etiqueta>
          ))}
          {hito.es_vigente && <Etiqueta tono="exito">Vigente</Etiqueta>}
        </div>
        <p className="kardex-hito__detalle">
          <TextoTruncado>{hito.area}</TextoTruncado>
          <span className="kardex-hito__sucursal">
            <MapPin className="ds-icono" aria-hidden="true" />
            <TextoTruncado>
              {hito.sucursal}
              {hito.sucursal_ciudad && `, ${hito.sucursal_ciudad}`}
            </TextoTruncado>
          </span>
        </p>
        {origen && <TextoTruncado as="p" className="kardex-hito__origen">Antes: {origen}</TextoTruncado>}
      </div>
    </li>
  );
}

export default function LineaTiempoTrayectoria({ trayectoria, nombre }) {
  if (trayectoria.length === 0) {
    return (
      <EstadoVacio
        icono={History}
        titulo="Sin trayectoria"
        mensaje="Este colaborador aún no tiene asignaciones de cargo y sucursal registradas."
      />
    );
  }

  return (
    <ol className="kardex-linea" aria-label={`Trayectoria laboral de ${nombre}, de la más antigua a la más reciente`}>
      {trayectoria.map((hito) => (
        <Hito key={hito.id_asignacion} hito={hito} />
      ))}
    </ol>
  );
}

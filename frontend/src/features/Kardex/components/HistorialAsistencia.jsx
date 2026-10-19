import { CalendarCheck } from 'lucide-react';
import { Alerta, EstadoVacio, Etiqueta, Tabla } from '../../../components/ui';
import { formatearDuracion, formatearHora } from '../../marcaje/formato';
import { formatearFecha } from '../../Vacantes/utils/formato';
import { Celda, SinDato } from './comunes';

const TONOS_NOVEDAD = { ATRASO: 'aviso', INASISTENCIA: 'peligro', SALIDA_ANTICIPADA: 'aviso', OMISION_SALIDA: 'neutral' };

const textoNovedad = ({ nombre, minutos, estado }) => {
  const duracion = minutos > 0 ? ` · ${formatearDuracion(minutos)}` : '';
  return `${nombre}${duracion}${estado === 'JUSTIFICADA' ? ' (justificada)' : ''}`;
};

const COLUMNAS = [
  {
    clave: 'fecha_jornada',
    titulo: 'Jornada',
    ancho: '18%',
    celda: (jornada) => <Celda principal={formatearFecha(jornada.fecha_jornada)} secundario={jornada.turno} />,
  },
  {
    clave: 'entrada_en',
    titulo: 'Entrada',
    ancho: '11%',
    celda: (jornada) => (jornada.entrada_en ? formatearHora(jornada.entrada_en) : <SinDato />),
  },
  {
    clave: 'salida_en',
    titulo: 'Salida',
    ancho: '11%',
    celda: (jornada) => (jornada.salida_en ? formatearHora(jornada.salida_en) : <SinDato />),
  },
  {
    clave: 'minutos_trabajados',
    titulo: 'Trabajado',
    ancho: '14%',
    celda: (jornada) =>
      jornada.minutos_trabajados ? (
        <Celda
          principal={formatearDuracion(jornada.minutos_trabajados)}
          secundario={jornada.minutos_extra ? `${formatearDuracion(jornada.minutos_extra)} extra` : undefined}
        />
      ) : (
        <SinDato />
      ),
  },
  {
    clave: 'novedades',
    titulo: 'Novedades',
    celda: (jornada) =>
      jornada.novedades.length > 0 ? (
        <div className="kardex-novedades">
          {jornada.novedades.map((novedad) => (
            <Etiqueta key={novedad.tipo} tono={novedad.estado === 'JUSTIFICADA' ? 'exito' : TONOS_NOVEDAD[novedad.tipo] ?? 'neutral'}>
              {textoNovedad(novedad)}
            </Etiqueta>
          ))}
        </div>
      ) : (
        <span className="kardex-celda__sub">Sin novedades</span>
      ),
  },
];

export default function HistorialAsistencia({ asistencia, nombre }) {
  if (!asistencia.disponible) {
    return (
      <Alerta tono="aviso" titulo="Historial de asistencia no disponible">
        {asistencia.mensaje}
      </Alerta>
    );
  }

  const { desde, hasta, resumen, jornadas } = asistencia;
  const indicadores = [
    { etiqueta: 'Jornadas trabajadas', valor: resumen.jornadas_trabajadas },
    { etiqueta: 'Tiempo trabajado', valor: formatearDuracion(resumen.minutos_trabajados) },
    { etiqueta: 'Atrasos', valor: resumen.atrasos, detalle: resumen.atrasos > 0 ? formatearDuracion(resumen.minutos_atraso) : null },
    { etiqueta: 'Faltas', valor: resumen.inasistencias },
    { etiqueta: 'Salidas anticipadas', valor: resumen.salidas_anticipadas },
    { etiqueta: 'Novedades justificadas', valor: resumen.novedades_justificadas },
  ];

  return (
    <div className="kardex-asistencia">
      <p className="kardex-nota">
        Del {formatearFecha(desde)} al {formatearFecha(hasta)}
      </p>
      <dl className="kardex-asistencia__resumen">
        {indicadores.map(({ etiqueta, valor, detalle }) => (
          <div key={etiqueta} className="kardex-asistencia__indicador">
            <dt>{etiqueta}</dt>
            <dd>
              {valor}
              {detalle && <span className="kardex-celda__sub"> · {detalle}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <Tabla
        className="kardex-tabla"
        descripcion={`Historial de asistencia de ${nombre}`}
        columnas={COLUMNAS}
        filas={jornadas}
        claveFila="fecha_jornada"
        vacio={
          <EstadoVacio
            icono={CalendarCheck}
            titulo="Sin registros de asistencia"
            mensaje="No hay marcajes ni novedades de este colaborador en el periodo."
          />
        }
      />
    </div>
  );
}

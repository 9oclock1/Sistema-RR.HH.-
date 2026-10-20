import { Link } from 'react-router';
import { CircleAlert, CircleCheck, Clock, GraduationCap, Plus } from 'lucide-react';
import { Boton, EstadoVacio, Etiqueta, Tabla } from '../../../components/ui';
import { RUTA_CAPACITACIONES, TIPOS_CAPACITACION } from '../../Capacitaciones/utils/opciones';
import { formatearFecha } from '../../Vacantes/utils/formato';
import DescargaCertificado from './DescargaCertificado';
import { Celda, SinDato } from './comunes';

const textoPorVencer = (dias) => {
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
};

const estadoVigencia = (capacitacion) => {
  const estado = capacitacion.estado_vigencia ?? (capacitacion.esta_vigente ? 'VIGENTE' : 'VENCIDA');
  if (estado === 'POR_VENCER') return { tono: 'aviso', icono: Clock, texto: textoPorVencer(capacitacion.dias_para_vencer) };
  if (estado === 'VENCIDA') return { tono: 'peligro', icono: CircleAlert, texto: 'Vencida' };
  if (estado === 'SIN_VENCIMIENTO') return { tono: 'neutral', icono: CircleCheck, texto: 'Sin vencimiento' };
  return { tono: 'exito', icono: CircleCheck, texto: 'Vigente' };
};

const realizacion = ({ fecha_inicio, fecha_fin }) => {
  if (fecha_inicio && fecha_fin && fecha_inicio !== fecha_fin) {
    return `${formatearFecha(fecha_inicio)} – ${formatearFecha(fecha_fin)}`;
  }
  return formatearFecha(fecha_fin || fecha_inicio);
};

const COLUMNAS = [
  {
    clave: 'curso',
    titulo: 'Curso',
    celda: (capacitacion) => (
      <Celda
        principal={capacitacion.curso}
        secundario={[
          capacitacion.curso_codigo,
          TIPOS_CAPACITACION[capacitacion.tipo_capacitacion],
          `${capacitacion.horas_academicas} h académicas`,
        ]
          .filter(Boolean)
          .join(' · ')}
      />
    ),
  },
  {
    clave: 'institucion_emisora',
    titulo: 'Institución',
    ancho: '16%',
    celda: (capacitacion) => (
      <Celda
        principal={capacitacion.institucion_emisora}
        secundario={capacitacion.numero_orden_servicio ? `Orden ${capacitacion.numero_orden_servicio}` : undefined}
      />
    ),
  },
  {
    clave: 'realizacion',
    titulo: 'Realización',
    ancho: '15%',
    celda: (capacitacion) => realizacion(capacitacion) || <SinDato />,
  },
  {
    clave: 'fecha_emision',
    titulo: 'Emisión',
    ancho: '10%',
    celda: (capacitacion) => formatearFecha(capacitacion.fecha_emision),
  },
  {
    clave: 'fecha_vencimiento',
    titulo: 'Vencimiento',
    ancho: '10%',
    celda: (capacitacion) => formatearFecha(capacitacion.fecha_vencimiento) || <SinDato />,
  },
  {
    clave: 'estado_vigencia',
    titulo: 'Estado',
    ancho: '13%',
    celda: (capacitacion) => {
      const { tono, icono, texto } = estadoVigencia(capacitacion);
      return (
        <Etiqueta tono={tono} icono={icono}>
          {texto}
        </Etiqueta>
      );
    },
  },
  {
    clave: 'certificado_adjunto_url',
    titulo: 'Certificado',
    ancho: '15%',
    celda: (capacitacion) =>
      capacitacion.certificado_adjunto_url ? <DescargaCertificado capacitacion={capacitacion} /> : <SinDato />,
  },
];

export default function TablaCapacitaciones({ capacitaciones, nombre, idEmpleado }) {
  const registrar = (
    <Boton as={Link} to={`${RUTA_CAPACITACIONES}?empleado=${idEmpleado}`} tamano="sm" icono={Plus}>
      Registrar capacitación
    </Boton>
  );

  return (
    <div className="kardex-seccion">
      {capacitaciones.length > 0 && <div className="kardex-seccion__acciones">{registrar}</div>}
      <Tabla
        className="kardex-tabla"
        descripcion={`Capacitaciones de ${nombre}`}
        columnas={COLUMNAS}
        filas={capacitaciones}
        claveFila="id_capacitacion"
        vacio={
          <EstadoVacio
            icono={GraduationCap}
            titulo="Sin capacitaciones"
            mensaje="Este colaborador aún no tiene certificados registrados."
            accion={registrar}
          />
        }
      />
    </div>
  );
}

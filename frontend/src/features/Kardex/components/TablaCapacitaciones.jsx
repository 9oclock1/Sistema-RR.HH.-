import { GraduationCap } from 'lucide-react';
import { EstadoVacio, Etiqueta, Tabla } from '../../../components/ui';
import { formatearFecha } from '../../Vacantes/utils/formato';
import { Archivo, Celda, SinDato } from './comunes';

const COLUMNAS = [
  {
    clave: 'curso',
    titulo: 'Curso',
    celda: (capacitacion) => (
      <Celda
        principal={capacitacion.curso}
        secundario={`${capacitacion.curso_codigo} · ${capacitacion.horas_academicas} h académicas`}
      />
    ),
  },
  { clave: 'institucion_emisora', titulo: 'Institución', ancho: '18%' },
  {
    clave: 'fecha_emision',
    titulo: 'Emisión',
    ancho: '13%',
    celda: (capacitacion) => formatearFecha(capacitacion.fecha_emision),
  },
  {
    clave: 'fecha_vencimiento',
    titulo: 'Vencimiento',
    ancho: '14%',
    celda: (capacitacion) => formatearFecha(capacitacion.fecha_vencimiento) || 'Sin vencimiento',
  },
  {
    clave: 'esta_vigente',
    titulo: 'Estado',
    ancho: '11%',
    celda: (capacitacion) =>
      capacitacion.esta_vigente ? <Etiqueta tono="exito">Vigente</Etiqueta> : <Etiqueta tono="peligro">Vencida</Etiqueta>,
  },
  {
    clave: 'certificado_adjunto_url',
    titulo: 'Certificado',
    ancho: '20%',
    celda: (capacitacion) =>
      capacitacion.certificado_adjunto_url ? <Archivo ruta={capacitacion.certificado_adjunto_url} /> : <SinDato />,
  },
];

export default function TablaCapacitaciones({ capacitaciones, nombre }) {
  return (
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
        />
      }
    />
  );
}

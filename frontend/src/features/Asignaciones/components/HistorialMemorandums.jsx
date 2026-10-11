import { useState } from 'react';
import { Award, FileText, FileWarning } from 'lucide-react';
import { Alerta, Boton, EstadoVacio, Etiqueta, Pestanas, Tabla, TextoTruncado } from '../../../components/ui';
import { formatearFecha } from '../../Vacantes/utils/formato';
import { useMemorandumsEmpleado } from '../hooks/useMemorandumsEmpleado';

const GRAVEDADES = { LEVE: 'Gravedad leve', MODERADA: 'Gravedad moderada', GRAVE: 'Gravedad grave' };

const FILTROS = [
  {
    id: 'todos',
    etiqueta: 'Todos',
    aplica: () => true,
    vacio: {
      icono: FileText,
      titulo: 'Sin memorándums',
      mensaje: 'Este empleado aún no tiene llamadas de atención ni reconocimientos.',
    },
  },
  {
    id: 'llamadas',
    etiqueta: 'Llamadas de atención',
    aplica: (memo) => !memo.es_reconocimiento,
    vacio: {
      icono: FileWarning,
      titulo: 'Sin llamadas de atención',
      mensaje: 'No se registran llamadas de atención para este empleado.',
    },
  },
  {
    id: 'reconocimientos',
    etiqueta: 'Reconocimientos',
    aplica: (memo) => memo.es_reconocimiento,
    vacio: {
      icono: Award,
      titulo: 'Sin reconocimientos',
      mensaje: 'Aún no se registran reconocimientos para este empleado.',
    },
  },
];

const COLUMNAS = [
  {
    clave: 'tipo',
    titulo: 'Tipo',
    ancho: '25%',
    celda: (memo) =>
      memo.es_reconocimiento ? (
        <Etiqueta tono="exito" icono={Award}>
          Reconocimiento
        </Etiqueta>
      ) : (
        <div className="asig-celda asig-celda--inicio">
          <Etiqueta tono={memo.gravedad_falta === 'GRAVE' ? 'peligro' : 'aviso'} icono={FileWarning}>
            Llamada de atención
          </Etiqueta>
          <span className="asig-celda__sub">{GRAVEDADES[memo.gravedad_falta]}</span>
        </div>
      ),
  },
  {
    clave: 'codigo_cite',
    titulo: 'CITE y fecha',
    ancho: '17%',
    celda: (memo) => (
      <div className="asig-celda">
        <TextoTruncado className="asig-codigo">{memo.codigo_cite}</TextoTruncado>
        <span className="asig-celda__sub">{formatearFecha(memo.fecha_emision)}</span>
      </div>
    ),
  },
  {
    clave: 'asunto',
    titulo: 'Motivo',
    celda: (memo) => (
      <div className="asig-celda">
        <TextoTruncado>{memo.asunto}</TextoTruncado>
        <TextoTruncado className="asig-celda__sub">{memo.tipo_nombre}</TextoTruncado>
      </div>
    ),
  },
  {
    clave: 'documento_pdf_url',
    titulo: 'Documento PDF',
    ancho: '26%',
    celda: (memo) =>
      memo.documento_pdf_url ? (
        <code className="asig-documento">{memo.documento_pdf_url}</code>
      ) : (
        <span className="asig-sin-dato">—</span>
      ),
  },
];

export default function HistorialMemorandums({ idEmpleado, nombre }) {
  const { memorandums, cargando, error, recargar } = useMemorandumsEmpleado(idEmpleado);
  const [filtro, setFiltro] = useState('todos');

  if (error) {
    return (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudieron cargar los memorándums"
        acciones={
          <Boton tamano="sm" onClick={recargar}>
            Reintentar
          </Boton>
        }
      >
        {error.message}
      </Alerta>
    );
  }

  const pestanas = FILTROS.map(({ id, etiqueta, aplica, vacio }) => {
    const filas = memorandums.filter(aplica);
    return {
      id,
      etiqueta,
      contador: cargando ? undefined : filas.length,
      contenido: (
        <Tabla
          className="asig-memos"
          descripcion={`${etiqueta === 'Todos' ? 'Memorándums' : etiqueta} de ${nombre}`}
          columnas={COLUMNAS}
          filas={filas}
          claveFila="id_memorandum"
          cargando={cargando}
          filasCargando={3}
          vacio={<EstadoVacio {...vacio} />}
        />
      ),
    };
  });

  return <Pestanas etiqueta="Filtrar memorándums" pestanas={pestanas} activa={filtro} onCambiar={setFiltro} />;
}

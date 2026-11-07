import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ClipboardCheck, Eye, RefreshCw } from 'lucide-react';
import { listarSeguimientoAcuses } from '../../../api/memorandumsApi';
import { Alerta, Boton, EncabezadoPagina, EstadoVacio, Etiqueta, Modal, Pestanas, Tabla, TextoTruncado } from '../../../components/ui';
import { claseMemorandum, estadoAcuse, formatearFecha, formatearFechaHora } from './formatoAcuse';
import './acuses.css';

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos', aplica: () => true, vacio: 'Aún no hay memorándums emitidos.' },
  {
    id: 'VENCIDO',
    etiqueta: 'Sin acuse (vencidos)',
    aplica: (m) => m.estado_acuse === 'VENCIDO',
    vacio: 'Ningún colaborador dejó vencer el plazo de acuse.',
  },
  {
    id: 'PENDIENTE',
    etiqueta: 'Pendientes',
    aplica: (m) => m.estado_acuse === 'PENDIENTE',
    vacio: 'No hay memorándums esperando acuse.',
  },
  {
    id: 'RECIBIDO',
    etiqueta: 'Notificados y recibidos',
    aplica: (m) => m.estado_acuse === 'RECIBIDO',
    vacio: 'Todavía ningún colaborador acusó recibo.',
  },
];

// RF-39 (KAN-282): estado del acuse de cada memorándum emitido y alertas de RRHH por falta de acuse.
export default function SeguimientoAcusesPage() {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ version: null, memorandums: [], error: null });
  const [filtro, setFiltro] = useState('todos');
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    let vigente = true;
    listarSeguimientoAcuses()
      .then((memorandums) => vigente && setResultado({ version, memorandums, error: null }))
      .catch((falla) => vigente && setResultado({ version, memorandums: [], error: falla.message }));
    return () => {
      vigente = false;
    };
  }, [version]);

  const cargar = useCallback(() => setVersion((v) => v + 1), []);
  const cargando = resultado.version !== version;
  const { memorandums } = resultado;
  const error = cargando ? null : resultado.error;

  const vencidos = memorandums.filter((m) => m.estado_acuse === 'VENCIDO').length;

  const columnas = [
    {
      clave: 'codigo_cite',
      titulo: 'Memorándum',
      ancho: '20%',
      celda: (m) => (
        <div className="acuse-celda">
          <TextoTruncado className="acuse-codigo">{m.codigo_cite}</TextoTruncado>
          <span className="acuse-celda__sub">
            {claseMemorandum(m)} · {formatearFecha(m.fecha_emision)}
          </span>
        </div>
      ),
    },
    {
      clave: 'receptor_nombre',
      titulo: 'Colaborador',
      celda: (m) => (
        <div className="acuse-celda">
          <TextoTruncado>{m.receptor_nombre}</TextoTruncado>
          <TextoTruncado className="acuse-celda__sub">{m.asunto}</TextoTruncado>
        </div>
      ),
    },
    {
      clave: 'fecha_hora_notificacion',
      titulo: 'Notificación',
      ancho: '18%',
      celda: (m) =>
        m.fue_notificado ? (
          <div className="acuse-celda">
            <span>{formatearFechaHora(m.fecha_hora_notificacion)}</span>
            <span className="acuse-celda__sub">Plazo: {formatearFechaHora(m.fecha_limite_acuse)}</span>
          </div>
        ) : (
          <Etiqueta tono="neutral">Aviso por reintentar</Etiqueta>
        ),
    },
    {
      clave: 'estado_acuse',
      titulo: 'Acuse',
      ancho: '22%',
      celda: (m) => {
        const estado = estadoAcuse(m.estado_acuse);
        return (
          <div className="acuse-celda">
            <Etiqueta tono={estado.tono}>{estado.etiqueta}</Etiqueta>
            <span className="acuse-celda__sub">
              {m.acuse_recibo_firmado
                ? `El ${formatearFechaHora(m.fecha_hora_acuse)}`
                : m.estado_acuse === 'VENCIDO'
                  ? 'Requiere seguimiento presencial'
                  : m.fecha_hora_apertura
                    ? 'Leído, sin acuse'
                    : 'Sin abrir'}
            </span>
          </div>
        );
      },
    },
    {
      clave: 'acciones',
      titulo: 'Detalle',
      alinear: 'fin',
      ancho: '10%',
      celda: (m) => (
        <Boton
          variante="sutil"
          tamano="sm"
          soloIcono
          icono={Eye}
          aria-label={`Ver el detalle del acuse del memorándum ${m.codigo_cite}`}
          onClick={() => setDetalle(m)}
        />
      ),
    },
  ];

  const pestanas = FILTROS.map(({ id, etiqueta, aplica, vacio }) => {
    const filas = memorandums.filter(aplica);
    return {
      id,
      etiqueta,
      contador: cargando ? undefined : filas.length,
      contenido: (
        <Tabla
          descripcion={`Acuses de memorándums: ${etiqueta}`}
          columnas={columnas}
          filas={filas}
          claveFila="id_memorandum"
          cargando={cargando}
          filasCargando={4}
          vacio={<EstadoVacio icono={ClipboardCheck} titulo="Sin memorándums" mensaje={vacio} />}
        />
      ),
    };
  });

  return (
    <section className="acuses" aria-labelledby="seguimiento-acuses-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Disciplina' }]}
        enlace={Link}
        titulo="Acuses de memorándums"
        idTitulo="seguimiento-acuses-titulo"
        descripcion="Estado del acuse de recibo de cada memorándum emitido y casos que requieren notificación presencial."
        acciones={
          <Boton variante="sutil" icono={RefreshCw} onClick={cargar} disabled={cargando}>
            Actualizar
          </Boton>
        }
      />

      <div className="acuses-columna">
        {error && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudo cargar el seguimiento"
            acciones={
              <Boton tamano="sm" onClick={cargar}>
                Reintentar
              </Boton>
            }
          >
            {error}
          </Alerta>
        )}

        {vencidos > 0 && (
          <Alerta tono="peligro" titulo="Seguimiento presencial pendiente">
            {vencidos} {vencidos === 1 ? 'memorándum venció' : 'memorándums vencieron'} sin acuse de recibo. Coordine la
            notificación en persona con cada colaborador.
          </Alerta>
        )}

        {!error && <Pestanas etiqueta="Filtrar por estado del acuse" pestanas={pestanas} activa={filtro} onCambiar={setFiltro} />}
      </div>

      <Modal
        abierto={Boolean(detalle)}
        titulo={detalle ? `Acuse del memorándum ${detalle.codigo_cite}` : ''}
        onCerrar={() => setDetalle(null)}
        pie={<Boton onClick={() => setDetalle(null)}>Cerrar</Boton>}
      >
        {detalle && (
          <div className="acuse-lectura">
            <dl className="acuse-lectura__datos">
              <div>
                <dt>Colaborador</dt>
                <dd>{detalle.receptor_nombre}</dd>
              </div>
              <div>
                <dt>Emitido por</dt>
                <dd>{detalle.emisor_nombre}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <Etiqueta tono={estadoAcuse(detalle.estado_acuse).tono}>{estadoAcuse(detalle.estado_acuse).etiqueta}</Etiqueta>
                </dd>
              </div>
              <div>
                <dt>Notificado</dt>
                <dd>{detalle.fue_notificado ? formatearFechaHora(detalle.fecha_hora_notificacion) : 'Aviso por reintentar'}</dd>
              </div>
              <div>
                <dt>Plazo de acuse</dt>
                <dd>{formatearFechaHora(detalle.fecha_limite_acuse)}</dd>
              </div>
              <div>
                <dt>Primera apertura</dt>
                <dd>{formatearFechaHora(detalle.fecha_hora_apertura)}</dd>
              </div>
              <div>
                <dt>Acuse de recibo</dt>
                <dd>{formatearFechaHora(detalle.fecha_hora_acuse)}</dd>
              </div>
              <div>
                <dt>IP del acuse</dt>
                <dd className="acuse-codigo">{detalle.ip_acuse || '—'}</dd>
              </div>
              <div>
                <dt>Usuario</dt>
                <dd className="acuse-codigo">{detalle.id_usuario_acuse || '—'}</dd>
              </div>
              {detalle.fecha_hora_alerta_rrhh && (
                <div>
                  <dt>Alerta a RR.HH.</dt>
                  <dd>{formatearFechaHora(detalle.fecha_hora_alerta_rrhh)}</dd>
                </div>
              )}
            </dl>
            <div>
              <h3 className="acuse-lectura__subtitulo">Descargo del colaborador</h3>
              <p className="acuse-lectura__contenido">
                {detalle.comentario_descargo || (detalle.acuse_recibo_firmado ? 'Acusó recibo sin descargo.' : '—')}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

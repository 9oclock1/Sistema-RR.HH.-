import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeftRight, BookOpenCheck, Eye, FileText } from 'lucide-react';
import { abrirMemorandumRecibido, acusarReciboMemorandum, listarMisMemorandums } from '../../../api/memorandumsApi';
import { Alerta, Boton, EncabezadoPagina, EstadoVacio, Etiqueta, Tabla, Tarjeta, TextoTruncado, useAvisos } from '../../../components/ui';
import IdentificacionEmpleado from '../../marcaje/IdentificacionEmpleado';
import { guardarEmpleado, leerEmpleado, olvidarEmpleado } from '../../marcaje/sesionEmpleado';
import LecturaMemorandum from './LecturaMemorandum';
import { claseMemorandum, estadoAcuse, formatearFecha, formatearFechaHora } from './formatoAcuse';
import './acuses.css';

const esRechazoDeIdentidad = (error) => error.estado === 401 || error.estado === 403;

// RF-39: memorándums emitidos a nombre del colaborador, con su lectura obligatoria y acuse de recibo.
export default function MisMemorandumsPage() {
  const avisar = useAvisos();
  const [idInicial] = useState(leerEmpleado);
  const [idEmpleado, setIdEmpleado] = useState(idInicial);
  const [datos, setDatos] = useState({ memorandums: [], pendientes: 0, plazo_horas: 72 });
  const [cargando, setCargando] = useState(Boolean(idInicial));
  const [errorIdentificacion, setErrorIdentificacion] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [enfocarIdentificacion, setEnfocarIdentificacion] = useState(false);
  const [lectura, setLectura] = useState(null); // { id, memo, cargando }

  const cargar = useCallback(
    (id) =>
      listarMisMemorandums(id)
        .then((respuesta) => {
          guardarEmpleado(id);
          setIdEmpleado(id);
          setDatos(respuesta);
          setErrorCarga(null);
        })
        .catch((error) => {
          if (!esRechazoDeIdentidad(error)) {
            setErrorCarga(error.message);
            return;
          }
          olvidarEmpleado();
          setIdEmpleado(null);
          setErrorCarga(null);
          setErrorIdentificacion(error.message);
        })
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    if (idInicial) cargar(idInicial);
  }, [cargar, idInicial]);

  const identificar = (id) => {
    setErrorIdentificacion(null);
    setErrorCarga(null);
    setCargando(true);
    cargar(id);
  };

  const reintentar = () => {
    setErrorCarga(null);
    setCargando(true);
    cargar(idEmpleado);
  };

  const cambiarEmpleado = () => {
    olvidarEmpleado();
    setIdEmpleado(null);
    setDatos({ memorandums: [], pendientes: 0, plazo_horas: 72 });
    setEnfocarIdentificacion(true);
  };

  // Criterio 2: abrir el memorándum para leerlo (el servidor registra la apertura).
  const abrir = async (memo) => {
    setLectura({ id: memo.id_memorandum, memo: null, cargando: true });
    try {
      const detalle = await abrirMemorandumRecibido(idEmpleado, memo.id_memorandum);
      setLectura({ id: memo.id_memorandum, memo: detalle, cargando: false });
    } catch (error) {
      setLectura(null);
      avisar({ tono: 'peligro', titulo: 'No se pudo abrir el memorándum', mensaje: error.message });
    }
  };

  // Criterio 3: acuse con descargo opcional; el servidor guarda la marca de tiempo, la IP y el usuario.
  const acusar = async (comentario) => {
    const acuse = await acusarReciboMemorandum(idEmpleado, lectura.memo.id_memorandum, comentario || null);
    const actualizar = (memo) => (memo.id_memorandum === acuse.id_memorandum ? { ...memo, ...acuse, acuse_recibo_firmado: true } : memo);
    setLectura((actual) => ({ ...actual, memo: actualizar(actual.memo) }));
    setDatos((actual) => ({
      ...actual,
      memorandums: actual.memorandums.map(actualizar),
      pendientes: Math.max(0, actual.pendientes - 1),
    }));
    avisar({
      tono: 'exito',
      titulo: 'Acuse de recibo registrado',
      mensaje: `El memorándum ${acuse.codigo_cite} quedó «Notificado y Recibido».`,
    });
  };

  const columnas = [
    {
      clave: 'codigo_cite',
      titulo: 'Memorándum',
      ancho: '22%',
      celda: (memo) => (
        <div className="acuse-celda">
          <TextoTruncado className="acuse-codigo">{memo.codigo_cite}</TextoTruncado>
          <Etiqueta tono={memo.es_reconocimiento ? 'exito' : 'aviso'}>{claseMemorandum(memo)}</Etiqueta>
        </div>
      ),
    },
    {
      clave: 'asunto',
      titulo: 'Asunto',
      celda: (memo) => (
        <div className="acuse-celda">
          <TextoTruncado>{memo.asunto}</TextoTruncado>
          <span className="acuse-celda__sub">Emitido el {formatearFecha(memo.fecha_emision)}</span>
        </div>
      ),
    },
    {
      clave: 'estado_acuse',
      titulo: 'Acuse de recibo',
      ancho: '26%',
      celda: (memo) => {
        const estado = estadoAcuse(memo.estado_acuse);
        return (
          <div className="acuse-celda">
            <Etiqueta tono={estado.tono}>{estado.etiqueta}</Etiqueta>
            <span className="acuse-celda__sub">
              {memo.acuse_recibo_firmado
                ? `El ${formatearFechaHora(memo.fecha_hora_acuse)}`
                : memo.fecha_limite_acuse && `Plazo: ${formatearFechaHora(memo.fecha_limite_acuse)}`}
            </span>
          </div>
        );
      },
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      alinear: 'fin',
      ancho: '18%',
      celda: (memo) =>
        memo.acuse_recibo_firmado ? (
          <Boton variante="sutil" tamano="sm" icono={Eye} onClick={() => abrir(memo)}>
            Ver
          </Boton>
        ) : (
          <Boton variante="primario" tamano="sm" icono={BookOpenCheck} onClick={() => abrir(memo)}>
            Leer y acusar recibo
          </Boton>
        ),
    },
  ];

  return (
    <section className="acuses" aria-labelledby="mis-memorandums-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Comunicaciones' }]}
        enlace={Link}
        titulo="Mis memorándums"
        idTitulo="mis-memorandums-titulo"
        descripcion="Felicitaciones y llamadas de atención emitidas a su nombre. Léalas y acuse recibo dentro del plazo."
        acciones={
          idEmpleado && (
            <Boton variante="sutil" icono={ArrowLeftRight} onClick={cambiarEmpleado}>
              Cambiar empleado
            </Boton>
          )
        }
      />

      <div className="acuses-columna">
        {errorCarga && (
          <Alerta
            tono="peligro"
            role="alert"
            titulo="No se pudieron cargar sus memorándums"
            acciones={
              <Boton tamano="sm" onClick={reintentar} cargando={cargando}>
                Reintentar
              </Boton>
            }
          >
            {errorCarga}
          </Alerta>
        )}

        {!idEmpleado && (
          <IdentificacionEmpleado
            error={errorIdentificacion}
            procesando={cargando}
            enfocar={enfocarIdentificacion}
            onIdentificar={identificar}
            onEditar={() => setErrorIdentificacion(null)}
          />
        )}

        {idEmpleado && !errorCarga && (
          <>
            {/* Criterio 1: alerta de alta prioridad mientras haya memorándums sin acuse. */}
            {datos.pendientes > 0 && (
              <Alerta tono="peligro" role="status" titulo="Prioridad alta: memorándums pendientes de acuse">
                {datos.pendientes === 1
                  ? 'Tiene 1 memorándum sin acuse de recibo.'
                  : `Tiene ${datos.pendientes} memorándums sin acuse de recibo.`}{' '}
                Dispone de {datos.plazo_horas} horas desde la notificación para leer y acusar recibo; vencido el plazo,
                RR.HH. hará el seguimiento en persona.
              </Alerta>
            )}

            <Tarjeta titulo="Memorándums recibidos" nivelTitulo={2} className="acuses-tarjeta">
              <Tabla
                descripcion="Memorándums emitidos a su nombre"
                columnas={columnas}
                filas={datos.memorandums}
                claveFila="id_memorandum"
                cargando={cargando}
                filasCargando={3}
                vacio={
                  <EstadoVacio
                    icono={FileText}
                    titulo="Sin memorándums"
                    mensaje="Cuando se emita un memorándum a su nombre, aparecerá aquí."
                  />
                }
              />
            </Tarjeta>
          </>
        )}
      </div>

      {lectura && (
        <LecturaMemorandum
          key={lectura.id}
          memo={lectura.memo}
          cargando={lectura.cargando}
          onCerrar={() => setLectura(null)}
          onAcusar={acusar}
        />
      )}
    </section>
  );
}

import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Banknote, ChevronDown, ChevronUp, Clock, Download, FilePen, FileText, Plus, RefreshCw } from 'lucide-react';
import { descargarDocumentoContrato } from '../../../api/kardexApi';
import { Alerta, Boton, Esqueleto, EstadoVacio, Etiqueta, Selector, TextoTruncado, useAvisos } from '../../../components/ui';
import { useRol } from '../../../context/sesion';
import { ROLES } from '../../../utils/permisos';
import { formatearFechaHora, formatearMonto } from '../../Cargos/utils/formato';
import { useHistorialContratos } from '../../Contratos/hooks/useContratos';
import { RUTA_CONTRATOS, TIPOS_MODIFICACION, esAdenda } from '../../Contratos/utils/opciones';
import { estadoVersion, mismoMonto } from '../../Contratos/utils/versiones';
import { formatearFecha } from '../../Vacantes/utils/formato';
import { guardarComo } from '../utils/descarga';
import { Celda, SinDato } from './comunes';

const ICONOS = {
  CONTRATO_INICIAL: FileText,
  RENOVACION: RefreshCw,
  CAMBIO_JORNADA: Clock,
  AJUSTE_SALARIAL: Banknote,
  AJUSTE_CONDICIONES: FilePen,
};

const FILTROS = [
  { valor: 'todas', etiqueta: 'Todas las versiones', incluye: () => true },
  { valor: 'contratos', etiqueta: 'Contratos y renovaciones', incluye: (v) => !esAdenda(v.tipo_modificacion) },
  { valor: 'adendas', etiqueta: 'Solo adendas', incluye: (v) => esAdenda(v.tipo_modificacion) },
];

const formatearTamano = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
};

const cambiosDe = (version, anterior) => {
  if (!anterior) return [];
  const cambios = [];
  if (version.id_tipo_contrato !== anterior.id_tipo_contrato) {
    cambios.push({ campo: 'Tipo de contrato', antes: anterior.tipo_contrato, despues: version.tipo_contrato });
  }
  if (version.id_tipo_jornada !== anterior.id_tipo_jornada) {
    cambios.push({ campo: 'Jornada', antes: anterior.tipo_jornada, despues: version.tipo_jornada });
  }
  if (!mismoMonto(version.haber_mensual_pactado, anterior.haber_mensual_pactado)) {
    cambios.push({
      campo: 'Haber',
      antes: formatearMonto(anterior.haber_mensual_pactado),
      despues: formatearMonto(version.haber_mensual_pactado),
    });
  }
  return cambios;
};

const textoHasta = (version) => {
  if (version.vigente_hasta) return formatearFecha(version.vigente_hasta);
  return version.es_version_vigente ? 'Actualidad' : 'Plazo indefinido';
};

function DescargaDocumento({ version }) {
  const rol = useRol();
  const avisar = useAvisos();
  const [descargando, setDescargando] = useState(false);
  const nombre = version.documento_nombre_original || version.documento_adjunto_url.split('/').pop();

  const descargar = async () => {
    setDescargando(true);
    try {
      guardarComo(await descargarDocumentoContrato(version.id_contrato, { rol }), nombre);
    } catch (error) {
      avisar({ tono: 'peligro', titulo: 'No se pudo descargar el documento', mensaje: error.message });
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="kardex-certificado">
      <Boton
        variante="sutil"
        tamano="sm"
        soloIcono
        icono={Download}
        cargando={descargando}
        aria-label={`Descargar ${nombre}`}
        title={`Descargar ${nombre}`}
        onClick={descargar}
      />
      <TextoTruncado className="kardex-archivo">{nombre}</TextoTruncado>
      {version.documento_tamano_bytes && (
        <span className="kardex-nota kardex-version__tamano">{formatearTamano(version.documento_tamano_bytes)}</span>
      )}
    </div>
  );
}

function Detalle({ version, id }) {
  const registrador = version.registrado_por_nombre ?? 'Usuario no identificado';
  const rol = version.registrado_rol ? ROLES[version.registrado_rol]?.nombre ?? version.registrado_rol : null;

  return (
    <dl className="kardex-version__detalle" id={id}>
      <div className="kardex-version__dato kardex-version__dato--ancho">
        <dt>Justificación</dt>
        <dd className="kardex-version__justificacion">{version.justificacion || <SinDato />}</dd>
      </div>
      <div className="kardex-version__dato">
        <dt>Documento firmado</dt>
        <dd>{version.documento_adjunto_url ? <DescargaDocumento version={version} /> : <SinDato />}</dd>
      </div>
      <div className="kardex-version__dato">
        <dt>Fin del contrato</dt>
        <dd>{version.fecha_fin_contrato ? formatearFecha(version.fecha_fin_contrato) : 'Plazo indefinido'}</dd>
      </div>
      <div className="kardex-version__dato">
        <dt>Registrado</dt>
        <dd>
          <Celda principal={formatearFechaHora(version.registrado_en)} secundario={rol ? `${registrador} · ${rol}` : registrador} />
        </dd>
      </div>
      <div className="kardex-version__dato">
        <dt>Huella SHA-256</dt>
        <dd>
          {version.documento_hash_sha256 ? (
            <TextoTruncado className="kardex-codigo kardex-version__hash">{version.documento_hash_sha256}</TextoTruncado>
          ) : (
            <SinDato />
          )}
        </dd>
      </div>
    </dl>
  );
}

function Version({ version, anterior, abierta, onAlternar }) {
  const Icono = ICONOS[version.tipo_modificacion] ?? FileText;
  const adenda = esAdenda(version.tipo_modificacion);
  const estado = estadoVersion(version);
  const cambios = cambiosDe(version, anterior);
  const idDetalle = `version-${version.id_contrato}`;
  const clases = [
    'kardex-hito',
    'kardex-version',
    adenda ? 'kardex-version--adenda' : 'kardex-version--contrato',
    estado?.texto === 'Vigente' && 'kardex-version--vigente',
    estado?.texto === 'Programada' && 'kardex-version--programada',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={clases}>
      <span className="kardex-hito__marca" aria-hidden="true">
        <Icono className="ds-icono" />
      </span>
      <div className="kardex-hito__cuerpo">
        <p className="kardex-hito__fechas">
          <time dateTime={version.fecha_vigencia}>{formatearFecha(version.fecha_vigencia)}</time>
          {' – '}
          {version.vigente_hasta ? <time dateTime={version.vigente_hasta}>{textoHasta(version)}</time> : textoHasta(version)}
          {` · Versión ${version.numero_version}`}
        </p>
        <div className="kardex-hito__encabezado">
          <TextoTruncado as="h3" className="kardex-hito__cargo kardex-codigo">
            {version.numero_contrato}
          </TextoTruncado>
          <Etiqueta tono={adenda ? 'morado' : 'info'} icono={Icono}>
            {TIPOS_MODIFICACION[version.tipo_modificacion]}
          </Etiqueta>
          {estado && <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>}
        </div>
        <p className="kardex-version__condiciones">
          {`${version.tipo_contrato} · ${version.tipo_jornada} (${version.horas_semanales} h) · ${formatearMonto(version.haber_mensual_pactado)}`}
        </p>

        {version.tipo_modificacion === 'RENOVACION' && version.numero_contrato_anterior && (
          <TextoTruncado as="p" className="kardex-hito__origen">
            Renueva el contrato {version.numero_contrato_anterior}
          </TextoTruncado>
        )}
        {cambios.length > 0 && (
          <ul className="kardex-cambios" aria-label="Cambios respecto a la versión anterior">
            {cambios.map((cambio) => (
              <li key={cambio.campo} className="kardex-cambio">
                <span className="kardex-cambio__campo">{cambio.campo}:</span>
                <span className="kardex-cambio__antes">{cambio.antes}</span>
                <ArrowRight className="ds-icono" aria-hidden="true" />
                <span className="ds-solo-lector">pasa a</span>
                <span className="kardex-cambio__despues">{cambio.despues}</span>
              </li>
            ))}
          </ul>
        )}
        {adenda && cambios.length === 0 && (
          <p className="kardex-hito__origen">Sin cambios en tipo de contrato, jornada ni haber.</p>
        )}

        <div className="kardex-version__acciones">
          <Boton
            variante="sutil"
            tamano="sm"
            icono={abierta ? ChevronUp : ChevronDown}
            aria-expanded={abierta}
            aria-controls={idDetalle}
            onClick={onAlternar}
          >
            {abierta ? 'Ocultar detalle' : 'Ver detalle'}
          </Boton>
        </div>
        {abierta && <Detalle version={version} id={idDetalle} />}
      </div>
    </li>
  );
}

function Cargando() {
  return (
    <div className="kardex-cargando" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Esqueleto key={i} forma="bloque" alto="calc(var(--size-row) * 2)" />
      ))}
    </div>
  );
}

export default function LineaTiempoContratos({ idEmpleado, nombre }) {
  const rol = useRol();
  const { historial, cargando, error, recargar } = useHistorialContratos(idEmpleado, rol);
  const [filtro, setFiltro] = useState('todas');
  const [abiertas, setAbiertas] = useState(() => new Set());

  const registrar = (
    <Boton as={Link} to={`${RUTA_CONTRATOS}?empleado=${idEmpleado}`} tamano="sm" icono={Plus}>
      Registrar modificación
    </Boton>
  );

  if (cargando) return <Cargando />;
  if (error) {
    return (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudo cargar el historial contractual"
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
  if (historial.length === 0) {
    return (
      <EstadoVacio
        icono={FileText}
        titulo="Sin contratos"
        mensaje="Este colaborador aún no tiene contratos ni adendas registrados."
      />
    );
  }

  const porId = new Map(historial.map((version) => [version.id_contrato, version]));
  const { incluye } = FILTROS.find((f) => f.valor === filtro);
  const visibles = historial.filter(incluye);
  const todasAbiertas = visibles.length > 0 && visibles.every((v) => abiertas.has(v.id_contrato));

  const alternar = (idContrato) =>
    setAbiertas((previas) => {
      const siguientes = new Set(previas);
      if (siguientes.has(idContrato)) siguientes.delete(idContrato);
      else siguientes.add(idContrato);
      return siguientes;
    });

  const alternarTodas = () =>
    setAbiertas(todasAbiertas ? new Set() : new Set(visibles.map((v) => v.id_contrato)));

  return (
    <div className="kardex-seccion">
      <div className="kardex-contratos__barra">
        <Selector
          className="kardex-contratos__filtro"
          aria-label="Mostrar"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          opciones={FILTROS.map(({ valor, etiqueta }) => ({ valor, etiqueta }))}
        />
        <div className="kardex-contratos__acciones">
          <Boton variante="sutil" tamano="sm" onClick={alternarTodas} disabled={visibles.length === 0}>
            {todasAbiertas ? 'Contraer todo' : 'Expandir todo'}
          </Boton>
          {registrar}
        </div>
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio
          icono={FileText}
          titulo="Sin versiones de este tipo"
          mensaje="Cambia el filtro para ver el resto del historial contractual."
          accion={
            <Boton tamano="sm" onClick={() => setFiltro('todas')}>
              Ver todas las versiones
            </Boton>
          }
        />
      ) : (
        <ol
          className="kardex-linea"
          aria-label={`Historial contractual de ${nombre}, de la versión más antigua a la más reciente`}
        >
          {visibles.map((version) => (
            <Version
              key={version.id_contrato}
              version={version}
              anterior={porId.get(version.id_contrato_anterior)}
              abierta={abiertas.has(version.id_contrato)}
              onAlternar={() => alternar(version.id_contrato)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

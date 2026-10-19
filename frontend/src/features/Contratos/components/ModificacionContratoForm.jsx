import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, FileSignature } from 'lucide-react';
import FileInput from '../../../components/common/FileInput';
import { Alerta, Boton, CampoAreaTexto, CampoTexto, ModalConfirmacion, Selector } from '../../../components/ui';
import { mapearErroresApi } from '../../../utils/erroresApi';
import { formatearMonto } from '../../Cargos/utils/formato';
import { formatearFecha } from '../../Vacantes/utils/formato';
import {
  CAMPOS_POR_TIPO,
  DESCRIPCION_MODIFICACION,
  DOCUMENTO,
  JUSTIFICACION_MAX,
  MODIFICACIONES,
  MONTO_REGEX,
  NUMERO_MAX,
  TIPOS_MODIFICACION,
} from '../utils/opciones';
import { diaSiguiente, mismoMonto, normalizarMonto } from '../utils/versiones';

const CAMPOS = [
  'tipo_modificacion',
  'numero_contrato',
  'fecha_vigencia',
  'fecha_fin',
  'id_tipo_contrato',
  'id_tipo_jornada',
  'haber_mensual_pactado',
  'justificacion',
];

const valoresIniciales = (actual) => ({
  tipo_modificacion: '',
  numero_contrato: '',
  fecha_vigencia: '',
  fecha_fin: '',
  id_tipo_contrato: String(actual.id_tipo_contrato),
  id_tipo_jornada: String(actual.id_tipo_jornada),
  haber_mensual_pactado: actual.haber_mensual_pactado,
  justificacion: '',
});

const limitesVigencia = (tipo, actual) => {
  if (!tipo) return {};
  if (tipo === 'RENOVACION') {
    return { min: actual.fecha_fin_contrato ? diaSiguiente(actual.fecha_fin_contrato) : undefined };
  }
  return { min: diaSiguiente(actual.fecha_vigencia), max: actual.fecha_fin_contrato ?? undefined };
};

const validarVigencia = (tipo, fecha, actual) => {
  if (!fecha) return 'Indica desde cuándo rige la modificación.';
  if (tipo === 'RENOVACION') {
    if (actual.fecha_fin_contrato && fecha <= actual.fecha_fin_contrato) {
      return `La renovación debe empezar después del ${formatearFecha(actual.fecha_fin_contrato)}, fin del contrato vigente.`;
    }
    return undefined;
  }
  if (fecha <= actual.fecha_vigencia) {
    return `Debe ser posterior al ${formatearFecha(actual.fecha_vigencia)}, inicio de la versión vigente.`;
  }
  if (actual.fecha_fin_contrato && fecha > actual.fecha_fin_contrato) {
    return `El contrato termina el ${formatearFecha(actual.fecha_fin_contrato)}; para continuar registra una renovación.`;
  }
  return undefined;
};

const validar = (valores, actual, documento) => {
  const errores = {};
  const tipo = valores.tipo_modificacion;
  const campos = CAMPOS_POR_TIPO[tipo] ?? {};

  if (!tipo) errores.tipo_modificacion = 'Selecciona el tipo de modificación.';
  else if (tipo === 'RENOVACION' && !actual.fecha_fin_contrato) {
    errores.tipo_modificacion = 'El contrato vigente es indefinido; para cambiar sus condiciones registra una adenda.';
  }
  if (!valores.numero_contrato.trim()) errores.numero_contrato = 'Indica el número que figura en el documento firmado.';

  const errorVigencia = tipo ? validarVigencia(tipo, valores.fecha_vigencia, actual) : undefined;
  if (errorVigencia) errores.fecha_vigencia = errorVigencia;
  if (campos.fechaFin && valores.fecha_fin && valores.fecha_vigencia && valores.fecha_fin < valores.fecha_vigencia) {
    errores.fecha_fin = 'La fecha de fin no puede ser anterior a la de vigencia.';
  }

  if (tipo === 'CAMBIO_JORNADA' && valores.id_tipo_jornada === String(actual.id_tipo_jornada)) {
    errores.id_tipo_jornada = 'Selecciona una jornada distinta a la vigente.';
  }
  if (campos.haber) {
    const haber = normalizarMonto(valores.haber_mensual_pactado);
    if (!MONTO_REGEX.test(haber) || Number(haber) <= 0) {
      errores.haber_mensual_pactado = 'Indica un monto mayor a cero con hasta 2 decimales.';
    } else if (tipo === 'AJUSTE_SALARIAL' && mismoMonto(haber, actual.haber_mensual_pactado)) {
      errores.haber_mensual_pactado = 'El nuevo haber es igual al vigente.';
    }
  }

  if (!valores.justificacion.trim()) errores.justificacion = 'Explica el motivo y el acuerdo que respalda el cambio.';
  if (!documento) errores.documento = 'Adjunta el documento de respaldo firmado.';
  return errores;
};

const validarDocumento = (archivo) => {
  if (!DOCUMENTO.tipos.includes(archivo.type)) return 'Formato no permitido. Solo se aceptan archivos PDF, JPG o PNG.';
  if (archivo.size > DOCUMENTO.maxMb * 1024 * 1024) return `El archivo supera el máximo de ${DOCUMENTO.maxMb} MB.`;
  return null;
};

const nombreDe = (lista, clave, id) => lista.find((item) => String(item[clave]) === String(id))?.nombre;

const cambiosDe = (valores, actual, catalogos) => {
  const campos = CAMPOS_POR_TIPO[valores.tipo_modificacion] ?? {};
  const cambios = [];

  if (campos.tipoContrato && valores.id_tipo_contrato !== String(actual.id_tipo_contrato)) {
    cambios.push({
      campo: 'Tipo de contrato',
      antes: actual.tipo_contrato,
      despues: nombreDe(catalogos.tipos_contrato, 'id_tipo_contrato', valores.id_tipo_contrato),
    });
  }
  if (campos.jornada && valores.id_tipo_jornada !== String(actual.id_tipo_jornada)) {
    cambios.push({
      campo: 'Jornada',
      antes: actual.tipo_jornada,
      despues: nombreDe(catalogos.tipos_jornada, 'id_tipo_jornada', valores.id_tipo_jornada),
    });
  }
  const haber = normalizarMonto(valores.haber_mensual_pactado);
  if (campos.haber && !mismoMonto(haber, actual.haber_mensual_pactado)) {
    cambios.push({ campo: 'Haber mensual', antes: formatearMonto(actual.haber_mensual_pactado), despues: formatearMonto(haber) });
  }
  return cambios;
};

const textoVigencia = (valores, actual) => {
  const desde = formatearFecha(valores.fecha_vigencia);
  if (valores.tipo_modificacion === 'RENOVACION') {
    return valores.fecha_fin ? `${desde} – ${formatearFecha(valores.fecha_fin)}` : `Desde ${desde}, plazo indefinido`;
  }
  return actual.fecha_fin_contrato
    ? `${desde} – ${formatearFecha(actual.fecha_fin_contrato)} (fin del contrato)`
    : `Desde ${desde}, hasta el fin del contrato indefinido`;
};

export default function ModificacionContratoForm({ idEmpleado, actual, catalogos, onRegistrar }) {
  const uid = useId();
  const idCampo = (campo) => `${uid}-${campo}`;

  const [valores, setValores] = useState(() => valoresIniciales(actual));
  const [documento, setDocumento] = useState(null);
  const [errores, setErrores] = useState({});
  const [rechazo, setRechazo] = useState(null);
  const [revisando, setRevisando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const focoPendiente = useRef(null);

  useEffect(() => {
    if (revisando || !focoPendiente.current) return;
    document.getElementById(`${uid}-${focoPendiente.current}`)?.focus();
    focoPendiente.current = null;
  }, [revisando, uid]);

  const tipo = valores.tipo_modificacion;
  const campos = CAMPOS_POR_TIPO[tipo] ?? {};
  const limites = limitesVigencia(tipo, actual);
  const renovable = Boolean(actual.fecha_fin_contrato);

  const quitarError = (...lista) =>
    setErrores((previos) => {
      if (!lista.some((campo) => previos[campo])) return previos;
      const siguientes = { ...previos };
      lista.forEach((campo) => delete siguientes[campo]);
      return siguientes;
    });

  const actualizarCampo = (campo, valor) => {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    quitarError(campo, ...(campo === 'fecha_vigencia' ? ['fecha_fin'] : []));
  };

  const seleccionarTipo = (nuevo) => {
    setValores((previos) => ({ ...previos, tipo_modificacion: nuevo, fecha_fin: '' }));
    quitarError(...CAMPOS);
  };

  const seleccionarDocumento = (archivo) => {
    const error = validarDocumento(archivo);
    setDocumento(error ? null : archivo);
    setErrores((previos) => ({ ...previos, documento: error ?? undefined }));
  };

  const enfocar = (campo) => document.getElementById(idCampo(campo))?.focus();

  const manejarSubmit = (evento) => {
    evento.preventDefault();
    setRechazo(null);

    const erroresCliente = validar(valores, actual, documento);
    setErrores(erroresCliente);
    const primero = CAMPOS.find((campo) => erroresCliente[campo]);
    if (primero) return enfocar(primero);
    if (erroresCliente.documento) return undefined;
    return setRevisando(true);
  };

  const registrar = async () => {
    const datos = new FormData();
    datos.append('id_empleado', idEmpleado);
    datos.append('tipo_modificacion', tipo);
    datos.append('numero_contrato', valores.numero_contrato.trim());
    datos.append('fecha_vigencia', valores.fecha_vigencia);
    datos.append('justificacion', valores.justificacion.trim());
    if (campos.fechaFin && valores.fecha_fin) datos.append('fecha_fin', valores.fecha_fin);
    if (campos.tipoContrato) datos.append('id_tipo_contrato', valores.id_tipo_contrato);
    if (campos.jornada) datos.append('id_tipo_jornada', valores.id_tipo_jornada);
    if (campos.haber) datos.append('haber_mensual_pactado', normalizarMonto(valores.haber_mensual_pactado));
    datos.append('documento', documento);

    setEnviando(true);
    try {
      await onRegistrar(datos);
    } catch (error) {
      const { porCampo, generales } = mapearErroresApi(error.errores ?? [], [...CAMPOS, 'documento']);
      const rechazados = CAMPOS.filter((campo) => porCampo[campo]);
      const hayCampos = rechazados.length > 0 || Boolean(porCampo.documento);
      setRechazo(hayCampos ? generales.join(' ') : error.message);
      setErrores(porCampo);
      focoPendiente.current = rechazados[0] ?? null;
      setRevisando(false);
      setEnviando(false);
    }
  };

  const ayudaVigencia = () => {
    if (!tipo) return 'Selecciona primero el tipo de modificación.';
    if (tipo === 'RENOVACION') {
      return actual.fecha_fin_contrato ? `Desde el ${formatearFecha(limites.min)} en adelante.` : undefined;
    }
    const hasta = actual.fecha_fin_contrato ? ` y hasta el ${formatearFecha(actual.fecha_fin_contrato)}` : '';
    return `Posterior al ${formatearFecha(actual.fecha_vigencia)}${hasta}. La adenda rige hasta el fin del contrato.`;
  };

  const etiquetaNumero = () => {
    if (tipo === 'RENOVACION') return 'N.º del nuevo contrato';
    if (tipo) return 'N.º de adenda';
    return 'N.º de documento';
  };

  const cambios = revisando ? cambiosDe(valores, actual, catalogos) : [];
  const largoJustificacion = valores.justificacion.length;

  return (
    <>
      <form className="contratos-form" onSubmit={manejarSubmit} noValidate aria-label="Nueva modificación contractual">
        {rechazo !== null && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo registrar la modificación">
            {rechazo || null}
          </Alerta>
        )}

        <fieldset className="contratos-fieldset" disabled={enviando}>
          <div className="contratos-fila">
            <Selector
              id={idCampo('tipo_modificacion')}
              etiqueta="Tipo de modificación"
              requerido
              value={tipo}
              onChange={(e) => seleccionarTipo(e.target.value)}
              textoVacio="Selecciona el tipo"
              opciones={MODIFICACIONES.map((codigo) => ({
                valor: codigo,
                etiqueta:
                  codigo === 'RENOVACION' && !renovable
                    ? `${TIPOS_MODIFICACION[codigo]} (contrato indefinido)`
                    : TIPOS_MODIFICACION[codigo],
                deshabilitada: codigo === 'RENOVACION' && !renovable,
              }))}
              error={errores.tipo_modificacion}
              ayuda={errores.tipo_modificacion ? undefined : DESCRIPCION_MODIFICACION[tipo]}
            />
            <CampoTexto
              id={idCampo('numero_contrato')}
              etiqueta={etiquetaNumero()}
              requerido
              value={valores.numero_contrato}
              maxLength={NUMERO_MAX}
              placeholder={tipo === 'RENOVACION' ? 'Ej.: CT-0003' : 'Ej.: CT-0002-A1'}
              onChange={(e) => actualizarCampo('numero_contrato', e.target.value)}
              error={errores.numero_contrato}
              ayuda={errores.numero_contrato ? undefined : 'Tal como figura en el documento firmado.'}
            />
          </div>

          <div className="contratos-fila">
            <CampoTexto
              id={idCampo('fecha_vigencia')}
              type="date"
              etiqueta="Fecha de vigencia"
              requerido
              value={valores.fecha_vigencia}
              min={limites.min}
              max={limites.max}
              disabled={!tipo}
              onChange={(e) => actualizarCampo('fecha_vigencia', e.target.value)}
              error={errores.fecha_vigencia}
              ayuda={errores.fecha_vigencia ? undefined : ayudaVigencia()}
            />
            {campos.fechaFin && (
              <CampoTexto
                id={idCampo('fecha_fin')}
                type="date"
                etiqueta="Fecha de fin"
                value={valores.fecha_fin}
                min={valores.fecha_vigencia || limites.min}
                onChange={(e) => actualizarCampo('fecha_fin', e.target.value)}
                error={errores.fecha_fin}
                ayuda={errores.fecha_fin ? undefined : 'Déjala vacía si el nuevo contrato es por plazo indefinido.'}
              />
            )}
          </div>

          {(campos.tipoContrato || campos.jornada || campos.haber) && (
            <div className="contratos-fila contratos-fila--tres">
              {campos.tipoContrato && (
                <Selector
                  id={idCampo('id_tipo_contrato')}
                  etiqueta="Tipo de contrato"
                  requerido
                  value={valores.id_tipo_contrato}
                  onChange={(e) => actualizarCampo('id_tipo_contrato', e.target.value)}
                  opciones={catalogos.tipos_contrato.map((t) => ({ valor: String(t.id_tipo_contrato), etiqueta: t.nombre }))}
                  error={errores.id_tipo_contrato}
                  ayuda={errores.id_tipo_contrato ? undefined : `Vigente: ${actual.tipo_contrato}`}
                />
              )}
              {campos.jornada && (
                <Selector
                  id={idCampo('id_tipo_jornada')}
                  etiqueta={tipo === 'CAMBIO_JORNADA' ? 'Nueva jornada' : 'Jornada'}
                  requerido
                  value={valores.id_tipo_jornada}
                  onChange={(e) => actualizarCampo('id_tipo_jornada', e.target.value)}
                  opciones={catalogos.tipos_jornada.map((j) => ({
                    valor: String(j.id_tipo_jornada),
                    etiqueta: `${j.nombre} (${j.horas_semanales} h)`,
                  }))}
                  error={errores.id_tipo_jornada}
                  ayuda={errores.id_tipo_jornada ? undefined : `Vigente: ${actual.tipo_jornada}`}
                />
              )}
              {campos.haber && (
                <CampoTexto
                  id={idCampo('haber_mensual_pactado')}
                  etiqueta={tipo === 'AJUSTE_SALARIAL' ? 'Nuevo haber mensual (Bs)' : 'Haber mensual (Bs)'}
                  requerido
                  inputMode="decimal"
                  value={valores.haber_mensual_pactado}
                  onChange={(e) => actualizarCampo('haber_mensual_pactado', e.target.value)}
                  error={errores.haber_mensual_pactado}
                  ayuda={errores.haber_mensual_pactado ? undefined : `Vigente: ${formatearMonto(actual.haber_mensual_pactado)}`}
                />
              )}
            </div>
          )}

          <CampoAreaTexto
            id={idCampo('justificacion')}
            etiqueta="Justificación"
            requerido
            value={valores.justificacion}
            maxLength={JUSTIFICACION_MAX}
            placeholder="Motivo del cambio y acuerdo alcanzado con el colaborador."
            onChange={(e) => actualizarCampo('justificacion', e.target.value)}
            error={errores.justificacion}
            ayuda={`${largoJustificacion} de ${JUSTIFICACION_MAX} caracteres.`}
          />

          <FileInput
            etiqueta="Documento de respaldo firmado"
            ayuda={`PDF, JPG o PNG (máx. ${DOCUMENTO.maxMb} MB)`}
            aceptar={DOCUMENTO.aceptar}
            requerido
            archivo={documento}
            error={errores.documento}
            deshabilitado={enviando}
            onSeleccionar={seleccionarDocumento}
            onRemover={() => {
              setDocumento(null);
              quitarError('documento');
            }}
          />
        </fieldset>

        <div className="contratos-form__pie">
          <Boton type="submit" variante="primario" icono={FileSignature} disabled={enviando}>
            Revisar y registrar
          </Boton>
        </div>
      </form>

      <ModalConfirmacion
        abierto={revisando}
        titulo="Confirmar modificación contractual"
        textoConfirmar={enviando ? 'Registrando…' : 'Registrar modificación'}
        textoCancelar="Volver al formulario"
        variante="primario"
        procesando={enviando}
        onConfirmar={registrar}
        onCancelar={() => setRevisando(false)}
      >
        <div className="contratos-revision">
          <dl className="contratos-revision__datos">
            <div>
              <dt>Tipo</dt>
              <dd>{TIPOS_MODIFICACION[tipo]}</dd>
            </div>
            <div>
              <dt>Número</dt>
              <dd className="contratos-codigo">{valores.numero_contrato.trim()}</dd>
            </div>
            <div>
              <dt>Vigencia</dt>
              <dd>{revisando && textoVigencia(valores, actual)}</dd>
            </div>
            <div>
              <dt>Documento</dt>
              <dd className="contratos-revision__archivo">{documento?.name}</dd>
            </div>
          </dl>

          {cambios.length > 0 ? (
            <ul className="contratos-cambios" aria-label="Cambios respecto a la versión vigente">
              {cambios.map((cambio) => (
                <li key={cambio.campo} className="contratos-cambio">
                  <span className="contratos-cambio__campo">{cambio.campo}</span>
                  <span className="contratos-cambio__antes">{cambio.antes}</span>
                  <ArrowRight className="ds-icono" aria-hidden="true" />
                  <span className="ds-solo-lector">pasa a</span>
                  <span className="contratos-cambio__despues">{cambio.despues}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="contratos-nota">Se mantienen el tipo de contrato, la jornada y el haber vigentes.</p>
          )}

          <Alerta tono="info">
            Se creará una nueva versión del contrato. Las versiones anteriores no cambian y esta no podrá editarse ni
            eliminarse.
          </Alerta>
        </div>
      </ModalConfirmacion>
    </>
  );
}

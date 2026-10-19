import { useId, useState } from 'react';
import { Send } from 'lucide-react';
import FileInput from '../../../components/common/FileInput';
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Selector, Tarjeta } from '../../../components/ui';
import { mapearErroresApi } from '../../../utils/erroresApi';
import {
  ASUNTO_MAX,
  EVIDENCIA,
  GRAVEDADES_FALTA,
  NATURALEZAS_FALTA,
  opcionesEmpleados,
  opcionesTipos,
} from '../utils/opciones';

// En el orden en que aparecen: el foco va al primero con error.
const CAMPOS = [
  'id_empleado_emisor',
  'id_empleado_receptor',
  'id_tipo_memo',
  'naturaleza_falta',
  'gravedad_falta',
  'asunto',
  'contenido_descripcion',
];

const VALORES_INICIALES = {
  id_empleado_emisor: '',
  id_empleado_receptor: '',
  id_tipo_memo: '',
  naturaleza_falta: '',
  gravedad_falta: '',
  asunto: '',
  contenido_descripcion: '',
};

const validar = (valores) => {
  const errores = {};
  if (!valores.id_empleado_emisor) errores.id_empleado_emisor = 'Selecciona quién emite el memorándum.';
  if (!valores.id_empleado_receptor) errores.id_empleado_receptor = 'Selecciona al empleado amonestado.';
  else if (valores.id_empleado_receptor === valores.id_empleado_emisor) {
    errores.id_empleado_receptor = 'El empleado amonestado no puede ser quien emite el memorándum.';
  }
  if (!valores.id_tipo_memo) errores.id_tipo_memo = 'Selecciona el tipo de memorándum.';
  if (!valores.naturaleza_falta) errores.naturaleza_falta = 'Indica si la falta es operativa o de conducta.';
  if (!valores.gravedad_falta) errores.gravedad_falta = 'Selecciona la gravedad de la falta.';
  if (!valores.asunto.trim()) errores.asunto = 'Escribe el asunto del memorándum.';
  if (!valores.contenido_descripcion.trim()) errores.contenido_descripcion = 'Describe la falta con detalle.';
  return errores;
};

const validarEvidencia = (archivo) => {
  if (!EVIDENCIA.tipos.includes(archivo.type)) return 'Formato no permitido. Solo se aceptan archivos PDF, JPG o PNG.';
  if (archivo.size > EVIDENCIA.maxMb * 1024 * 1024) return `El archivo supera el máximo de ${EVIDENCIA.maxMb} MB.`;
  return null;
};

export default function MemorandumForm({ empleados, tipos, cargando, idEmisorInicial, onCambiarEmisor, onEmitir }) {
  const uid = useId();
  const idCampo = (campo) => `${uid}-${campo}`;

  const [valores, setValores] = useState(() => ({ ...VALORES_INICIALES, id_empleado_emisor: idEmisorInicial ?? '' }));
  const [evidencia, setEvidencia] = useState(null);
  // Errores por campo: los de la validación local y los que devuelve el backend (400).
  const [errores, setErrores] = useState({});
  const [rechazo, setRechazo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Con un solo tipo en el catálogo no hay nada que elegir: queda preseleccionado.
  const idTipoMemo = valores.id_tipo_memo || (tipos.length === 1 ? String(tipos[0].id_tipo_memo) : '');
  // El emisor solo cuenta si sigue existiendo en la lista (p. ej. una identificación guardada de otra base de datos no).
  const emisorVigente = empleados.some((empleado) => empleado.id_empleado === valores.id_empleado_emisor);
  const idEmisor = emisorVigente ? valores.id_empleado_emisor : '';
  const opcionesEmisor = opcionesEmpleados(empleados);
  const opcionesReceptor = opcionesEmpleados(empleados.filter((empleado) => empleado.id_empleado !== idEmisor));

  const enfocar = (campo) => document.getElementById(idCampo(campo))?.focus();

  const quitarError = (campo) =>
    setErrores((previos) => {
      if (!previos[campo]) return previos;
      const siguientes = { ...previos };
      delete siguientes[campo];
      return siguientes;
    });

  const actualizarCampo = (campo, valor) => {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    quitarError(campo);
  };

  const cambiarEmisor = (valor) => {
    // Quien emite no puede ser el amonestado: si coincide, se vuelve a pedir el amonestado.
    setValores((previos) => ({
      ...previos,
      id_empleado_emisor: valor,
      id_empleado_receptor: previos.id_empleado_receptor === valor ? '' : previos.id_empleado_receptor,
    }));
    quitarError('id_empleado_emisor');
    onCambiarEmisor?.(valor);
  };

  const seleccionarEvidencia = (archivo) => {
    const error = validarEvidencia(archivo);
    setEvidencia(error ? null : archivo);
    setErrores((previos) => ({ ...previos, evidencia: error ?? undefined }));
  };

  const removerEvidencia = () => {
    setEvidencia(null);
    quitarError('evidencia');
  };

  const manejarSubmit = async (evento) => {
    evento.preventDefault();
    setRechazo(null);

    const enviados = { ...valores, id_empleado_emisor: idEmisor, id_tipo_memo: idTipoMemo };
    const erroresCliente = validar(enviados);
    setErrores(erroresCliente);
    const primero = CAMPOS.find((campo) => erroresCliente[campo]);
    if (primero) return enfocar(primero);

    const datos = new FormData();
    CAMPOS.forEach((campo) => datos.append(campo, enviados[campo].trim()));
    if (evidencia) datos.append('evidencia', evidencia);

    const receptor = empleados.find((empleado) => empleado.id_empleado === enviados.id_empleado_receptor);

    setEnviando(true);
    try {
      await onEmitir(datos, receptor?.nombre_completo);
    } catch (error) {
      const { porCampo, generales } = mapearErroresApi(error.errores ?? [], [...CAMPOS, 'evidencia']);
      const rechazados = CAMPOS.filter((campo) => porCampo[campo]);
      const hayCampos = rechazados.length > 0 || Boolean(porCampo.evidencia);
      // Si el backend señala campos, su mensaje va debajo de cada uno; la alerta resume el resto.
      setRechazo(hayCampos ? generales.join(' ') : error.message);
      setErrores(porCampo);
      if (rechazados.length > 0) enfocar(rechazados[0]);
      setEnviando(false);
    }
  };

  return (
    <Tarjeta titulo="Nueva llamada de atención">
      <form className="memo-form" onSubmit={manejarSubmit} noValidate aria-label="Nueva llamada de atención">
        {rechazo !== null && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo emitir el memorándum">
            {rechazo || null}
          </Alerta>
        )}

        {/* El fieldset deshabilita todos los controles de una vez mientras se envía. */}
        <fieldset className="memo-fieldset" disabled={enviando}>
          <div className="memo-fila">
            <Selector
              id={idCampo('id_empleado_emisor')}
              etiqueta="Emite el memorándum"
              requerido
              value={idEmisor}
              onChange={(e) => cambiarEmisor(e.target.value)}
              textoVacio={cargando ? 'Cargando empleados…' : 'Selecciona quién emite'}
              opciones={opcionesEmisor}
              disabled={cargando}
              error={errores.id_empleado_emisor}
            />

            <Selector
              id={idCampo('id_empleado_receptor')}
              etiqueta="Empleado amonestado"
              requerido
              value={valores.id_empleado_receptor}
              onChange={(e) => actualizarCampo('id_empleado_receptor', e.target.value)}
              textoVacio={cargando ? 'Cargando empleados…' : 'Selecciona un empleado'}
              opciones={opcionesReceptor}
              disabled={cargando}
              error={errores.id_empleado_receptor}
            />
          </div>

          <div className="memo-fila">
            <Selector
              id={idCampo('id_tipo_memo')}
              etiqueta="Tipo de memorándum"
              requerido
              value={idTipoMemo}
              onChange={(e) => actualizarCampo('id_tipo_memo', e.target.value)}
              textoVacio={cargando ? 'Cargando tipos…' : 'Selecciona un tipo'}
              opciones={opcionesTipos(tipos)}
              disabled={cargando}
              error={errores.id_tipo_memo}
            />
          </div>

          <div className="memo-fila">
            <Selector
              id={idCampo('naturaleza_falta')}
              etiqueta="Naturaleza de la falta"
              requerido
              value={valores.naturaleza_falta}
              onChange={(e) => actualizarCampo('naturaleza_falta', e.target.value)}
              textoVacio="Selecciona la naturaleza"
              opciones={NATURALEZAS_FALTA}
              error={errores.naturaleza_falta}
            />

            <Selector
              id={idCampo('gravedad_falta')}
              etiqueta="Gravedad de la falta"
              requerido
              value={valores.gravedad_falta}
              onChange={(e) => actualizarCampo('gravedad_falta', e.target.value)}
              textoVacio="Selecciona la gravedad"
              opciones={GRAVEDADES_FALTA}
              error={errores.gravedad_falta}
            />
          </div>

          <CampoTexto
            id={idCampo('asunto')}
            etiqueta="Asunto"
            requerido
            value={valores.asunto}
            maxLength={ASUNTO_MAX}
            placeholder="Ej.: Incumplimiento reiterado del horario de ingreso"
            onChange={(e) => actualizarCampo('asunto', e.target.value)}
            error={errores.asunto}
          />

          <CampoAreaTexto
            id={idCampo('contenido_descripcion')}
            etiqueta="Descripción detallada"
            requerido
            filas={6}
            value={valores.contenido_descripcion}
            onChange={(e) => actualizarCampo('contenido_descripcion', e.target.value)}
            error={errores.contenido_descripcion}
            ayuda={
              errores.contenido_descripcion
                ? undefined
                : 'Hechos, fechas y norma incumplida. Este texto se imprime en el documento oficial.'
            }
          />

          <FileInput
            etiqueta="Evidencia"
            ayuda={`Opcional. PDF, JPG o PNG (máx. ${EVIDENCIA.maxMb} MB)`}
            aceptar={EVIDENCIA.aceptar}
            archivo={evidencia}
            error={errores.evidencia}
            deshabilitado={enviando}
            onSeleccionar={seleccionarEvidencia}
            onRemover={removerEvidencia}
          />
        </fieldset>

        <div className="memo-form__pie">
          <Boton type="submit" variante="primario" icono={Send} cargando={enviando}>
            {enviando ? 'Emitiendo…' : 'Emitir memorándum'}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

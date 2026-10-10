import { useId, useState } from 'react';
import { Send } from 'lucide-react';
import FileInput from '../../../components/common/FileInput';
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Selector, Tarjeta } from '../../../components/ui';
import { mapearErroresApi } from '../../../utils/erroresApi';
import {
  ASUNTO_MAX,
  EMPLEADOS_PRUEBA,
  EVIDENCIA,
  GRAVEDADES_FALTA,
  ID_EMPLEADO_EMISOR,
  NATURALEZAS_FALTA,
  TIPOS_MEMO_PRUEBA,
} from '../utils/opciones';

// En el orden en que aparecen: el foco va al primero con error.
const CAMPOS = [
  'id_empleado_receptor',
  'id_tipo_memo',
  'naturaleza_falta',
  'gravedad_falta',
  'asunto',
  'contenido_descripcion',
];

const VALORES_INICIALES = {
  id_empleado_receptor: '',
  id_tipo_memo: TIPOS_MEMO_PRUEBA[0].valor,
  naturaleza_falta: '',
  gravedad_falta: '',
  asunto: '',
  contenido_descripcion: '',
};

const validar = (valores) => {
  const errores = {};
  if (!valores.id_empleado_receptor) errores.id_empleado_receptor = 'Selecciona al empleado amonestado.';
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

export default function MemorandumForm({ onEmitir }) {
  const uid = useId();
  const idCampo = (campo) => `${uid}-${campo}`;

  const [valores, setValores] = useState(VALORES_INICIALES);
  const [evidencia, setEvidencia] = useState(null);
  // Errores por campo: los de la validación local y los que devuelve el backend (400).
  const [errores, setErrores] = useState({});
  const [rechazo, setRechazo] = useState(null);
  const [enviando, setEnviando] = useState(false);

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

    const erroresCliente = validar(valores);
    setErrores(erroresCliente);
    const primero = CAMPOS.find((campo) => erroresCliente[campo]);
    if (primero) return enfocar(primero);

    const datos = new FormData();
    CAMPOS.forEach((campo) => datos.append(campo, valores[campo].trim()));
    datos.append('id_empleado_emisor', ID_EMPLEADO_EMISOR);
    if (evidencia) datos.append('evidencia', evidencia);

    const receptor = EMPLEADOS_PRUEBA.find((empleado) => empleado.valor === valores.id_empleado_receptor);

    setEnviando(true);
    try {
      await onEmitir(datos, receptor?.etiqueta);
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
              id={idCampo('id_empleado_receptor')}
              etiqueta="Empleado amonestado"
              requerido
              value={valores.id_empleado_receptor}
              onChange={(e) => actualizarCampo('id_empleado_receptor', e.target.value)}
              textoVacio="Selecciona un empleado"
              opciones={EMPLEADOS_PRUEBA}
              error={errores.id_empleado_receptor}
            />

            <Selector
              id={idCampo('id_tipo_memo')}
              etiqueta="Tipo de memorándum"
              requerido
              value={valores.id_tipo_memo}
              onChange={(e) => actualizarCampo('id_tipo_memo', e.target.value)}
              textoVacio="Selecciona un tipo"
              opciones={TIPOS_MEMO_PRUEBA}
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

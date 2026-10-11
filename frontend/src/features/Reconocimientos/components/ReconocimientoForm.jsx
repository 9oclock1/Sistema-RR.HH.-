import { useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { Award } from 'lucide-react';
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Selector, Tarjeta } from '../../../components/ui';
import { mapearErroresApi } from '../../../utils/erroresApi';
import { ASUNTO_MAX, EMISOR_PRUEBA, EMPLEADOS_PRUEBA, TIPOS_RECONOCIMIENTO_PRUEBA } from '../utils/opciones';
const CAMPOS = ['id_empleado_receptor', 'id_tipo_memo', 'asunto', 'contenido_descripcion'];

const validar = (valores) => {
  const errores = {};
  if (!valores.id_empleado_receptor) errores.id_empleado_receptor = 'Selecciona al colaborador reconocido.';
  if (!valores.id_tipo_memo) errores.id_tipo_memo = 'Selecciona el motivo del reconocimiento.';
  if (!valores.asunto.trim()) errores.asunto = 'Escribe el asunto del reconocimiento.';
  if (!valores.contenido_descripcion.trim()) errores.contenido_descripcion = 'Redacta el texto de reconocimiento.';
  return errores;
};

export default function ReconocimientoForm({ valores, onCambiar, onEmitir }) {
  const uid = useId();
  const idCampo = (campo) => `${uid}-${campo}`;

  const [errores, setErrores] = useState({});
  const [rechazo, setRechazo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enfocar = (campo) => document.getElementById(idCampo(campo))?.focus();

  const actualizarCampo = (campo, valor) => {
    onCambiar(campo, valor);
    setErrores((previos) => {
      if (!previos[campo]) return previos;
      const siguientes = { ...previos };
      delete siguientes[campo];
      return siguientes;
    });
  };

  const manejarSubmit = async (evento) => {
    evento.preventDefault();
    setRechazo(null);

    const erroresCliente = validar(valores);
    setErrores(erroresCliente);
    const primero = CAMPOS.find((campo) => erroresCliente[campo]);
    if (primero) return enfocar(primero);

    const datos = {
      id_empleado_receptor: valores.id_empleado_receptor,
      id_empleado_emisor: EMISOR_PRUEBA.id,
      id_tipo_memo: Number(valores.id_tipo_memo),
      asunto: valores.asunto.trim(),
      contenido_descripcion: valores.contenido_descripcion.trim(),
    };

    setEnviando(true);
    try {
      await onEmitir(datos);
    } catch (error) {
      const { porCampo, generales } = mapearErroresApi(error.errores ?? [], CAMPOS);
      const rechazados = CAMPOS.filter((campo) => porCampo[campo]);
      flushSync(() => {
        setRechazo(rechazados.length > 0 ? generales.join(' ') : error.message);
        setErrores(porCampo);
        setEnviando(false);
      });
      if (rechazados.length > 0) enfocar(rechazados[0]);
    }
  };

  return (
    <Tarjeta titulo="Nuevo reconocimiento">
      <form className="reco-form" onSubmit={manejarSubmit} noValidate aria-label="Nuevo reconocimiento">
        {rechazo !== null && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo emitir el reconocimiento">
            {rechazo || null}
          </Alerta>
        )}

        {/* El fieldset deshabilita todos los controles de una vez mientras se envía. */}
        <fieldset className="reco-fieldset" disabled={enviando}>
          <Selector
            id={idCampo('id_empleado_receptor')}
            etiqueta="Colaborador reconocido"
            requerido
            value={valores.id_empleado_receptor}
            onChange={(e) => actualizarCampo('id_empleado_receptor', e.target.value)}
            textoVacio="Selecciona un colaborador"
            opciones={EMPLEADOS_PRUEBA}
            error={errores.id_empleado_receptor}
          />

          <Selector
            id={idCampo('id_tipo_memo')}
            etiqueta="Motivo del reconocimiento"
            requerido
            value={valores.id_tipo_memo}
            onChange={(e) => actualizarCampo('id_tipo_memo', e.target.value)}
            textoVacio="Selecciona un motivo"
            opciones={TIPOS_RECONOCIMIENTO_PRUEBA}
            error={errores.id_tipo_memo}
          />

          <CampoTexto
            id={idCampo('asunto')}
            etiqueta="Asunto"
            requerido
            value={valores.asunto}
            maxLength={ASUNTO_MAX}
            placeholder="Ej.: Puntualidad ejemplar durante el tercer trimestre"
            onChange={(e) => actualizarCampo('asunto', e.target.value)}
            error={errores.asunto}
          />

          <CampoAreaTexto
            id={idCampo('contenido_descripcion')}
            etiqueta="Texto de reconocimiento"
            requerido
            filas={8}
            value={valores.contenido_descripcion}
            onChange={(e) => actualizarCampo('contenido_descripcion', e.target.value)}
            error={errores.contenido_descripcion}
            ayuda={
              errores.contenido_descripcion
                ? undefined
                : 'Logros y méritos que se reconocen. Este texto se imprime en el documento oficial.'
            }
          />
        </fieldset>

        <div className="reco-form__pie">
          <Boton type="submit" variante="primario" icono={Award} cargando={enviando}>
            {enviando ? 'Emitiendo…' : 'Emitir reconocimiento'}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

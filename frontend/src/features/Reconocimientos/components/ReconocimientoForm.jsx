import { useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { Award } from 'lucide-react';
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Selector, Tarjeta } from '../../../components/ui';
import { mapearErroresApi } from '../../../utils/erroresApi';
import { opcionesEmpleados, opcionesTipos } from '../../Memorandums/utils/opciones';
import { ASUNTO_MAX } from '../utils/opciones';

// En el orden en que aparecen: el foco va al primero con error.
const CAMPOS = ['id_empleado_emisor', 'id_empleado_receptor', 'id_tipo_memo', 'asunto', 'contenido_descripcion'];

const validar = (valores) => {
  const errores = {};
  if (!valores.id_empleado_emisor) errores.id_empleado_emisor = 'Selecciona quién otorga el reconocimiento.';
  if (!valores.id_empleado_receptor) errores.id_empleado_receptor = 'Selecciona al colaborador reconocido.';
  else if (valores.id_empleado_receptor === valores.id_empleado_emisor) {
    errores.id_empleado_receptor = 'El colaborador reconocido no puede ser quien otorga el reconocimiento.';
  }
  if (!valores.id_tipo_memo) errores.id_tipo_memo = 'Selecciona el motivo del reconocimiento.';
  if (!valores.asunto.trim()) errores.asunto = 'Escribe el asunto del reconocimiento.';
  if (!valores.contenido_descripcion.trim()) errores.contenido_descripcion = 'Redacta el texto de reconocimiento.';
  return errores;
};

export default function ReconocimientoForm({ valores, empleados, tipos, cargando, onCambiar, onEmitir }) {
  const uid = useId();
  const idCampo = (campo) => `${uid}-${campo}`;

  const [errores, setErrores] = useState({});
  const [rechazo, setRechazo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // El emisor solo cuenta si sigue existiendo en la lista (p. ej. una identificación guardada de otra base de datos no).
  const emisorVigente = empleados.some((empleado) => empleado.id_empleado === valores.id_empleado_emisor);
  const idEmisor = emisorVigente ? valores.id_empleado_emisor : '';
  // Con un solo motivo en el catálogo no hay nada que elegir: queda preseleccionado.
  const idTipoMemo = valores.id_tipo_memo || (tipos.length === 1 ? String(tipos[0].id_tipo_memo) : '');
  const opcionesEmisor = opcionesEmpleados(empleados);
  const opcionesReceptor = opcionesEmpleados(empleados.filter((empleado) => empleado.id_empleado !== idEmisor));

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

  const cambiarEmisor = (valor) => {
    // Quien otorga no puede ser el reconocido: si coincide, se vuelve a pedir el colaborador.
    if (valores.id_empleado_receptor === valor) onCambiar('id_empleado_receptor', '');
    actualizarCampo('id_empleado_emisor', valor);
  };

  const manejarSubmit = async (evento) => {
    evento.preventDefault();
    setRechazo(null);

    const enviados = { ...valores, id_empleado_emisor: idEmisor, id_tipo_memo: idTipoMemo };
    const erroresCliente = validar(enviados);
    setErrores(erroresCliente);
    const primero = CAMPOS.find((campo) => erroresCliente[campo]);
    if (primero) return enfocar(primero);

    const datos = {
      id_empleado_receptor: enviados.id_empleado_receptor,
      id_empleado_emisor: enviados.id_empleado_emisor,
      id_tipo_memo: Number(enviados.id_tipo_memo),
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
            id={idCampo('id_empleado_emisor')}
            etiqueta="Otorga el reconocimiento"
            requerido
            value={idEmisor}
            onChange={(e) => cambiarEmisor(e.target.value)}
            textoVacio={cargando ? 'Cargando empleados…' : 'Selecciona quién otorga'}
            opciones={opcionesEmisor}
            disabled={cargando}
            error={errores.id_empleado_emisor}
          />

          <Selector
            id={idCampo('id_empleado_receptor')}
            etiqueta="Colaborador reconocido"
            requerido
            value={valores.id_empleado_receptor}
            onChange={(e) => actualizarCampo('id_empleado_receptor', e.target.value)}
            textoVacio={cargando ? 'Cargando empleados…' : 'Selecciona un colaborador'}
            opciones={opcionesReceptor}
            disabled={cargando}
            error={errores.id_empleado_receptor}
          />

          <Selector
            id={idCampo('id_tipo_memo')}
            etiqueta="Motivo del reconocimiento"
            requerido
            value={idTipoMemo}
            onChange={(e) => actualizarCampo('id_tipo_memo', e.target.value)}
            textoVacio={cargando ? 'Cargando motivos…' : 'Selecciona un motivo'}
            opciones={opcionesTipos(tipos)}
            disabled={cargando}
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

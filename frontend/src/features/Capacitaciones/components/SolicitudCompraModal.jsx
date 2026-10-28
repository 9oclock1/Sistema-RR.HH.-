import { useId, useState } from 'react';
import { Send } from 'lucide-react';
import { solicitarCompraCapacitacion } from '../../../api/capacitacionesApi';
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Modal, Selector } from '../../../components/ui';
import { useUsuario } from '../../../context/sesion';
import { mapearErroresApi } from '../../../utils/erroresApi';
import { useEmpleados } from '../../Asignaciones/hooks/useEmpleados';
import { fechaDeHoy } from '../utils/fechas';

const CAMPOS = [
  'id_empleado_solicitante',
  'descripcion_requerimiento',
  'cantidad_participantes',
  'fecha_requerida',
  'monto_estimado',
];
const DESCRIPCION_MAX = 500;
const MONTO_REGEX = /^\d{1,10}(\.\d{1,2})?$/;

const validar = (valores) => {
  const errores = {};
  const cantidad = Number(valores.cantidad_participantes);
  if (!valores.id_empleado_solicitante) errores.id_empleado_solicitante = 'Selecciona quién solicita el servicio.';
  if (!valores.descripcion_requerimiento.trim()) errores.descripcion_requerimiento = 'Describe qué necesitas de Compras.';
  if (!Number.isInteger(cantidad) || cantidad < 1) errores.cantidad_participantes = 'Indica al menos un participante.';
  if (valores.fecha_requerida && valores.fecha_requerida < fechaDeHoy()) {
    errores.fecha_requerida = 'La fecha requerida no puede ser anterior a hoy.';
  }
  if (valores.monto_estimado && !MONTO_REGEX.test(valores.monto_estimado.trim())) {
    errores.monto_estimado = 'Usa un monto positivo con hasta 2 decimales.';
  }
  return errores;
};

// KAN-60: pide a Compras (grupo C) el servicio de un curso externo. Quien lo usa le da una `key` distinta al abrirlo.
export default function SolicitudCompraModal({ abierto, curso, rol, onCerrar, onEnviada }) {
  const uid = useId();
  const idCampo = (campo) => `${uid}-${campo}`;
  const usuario = useUsuario();
  const empleados = useEmpleados();

  const [valores, setValores] = useState({
    id_empleado_solicitante: usuario ?? '',
    descripcion_requerimiento: '',
    cantidad_participantes: '1',
    fecha_requerida: '',
    monto_estimado: '',
  });
  const [errores, setErrores] = useState({});
  const [rechazo, setRechazo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const actualizarCampo = (campo, valor) => {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    setErrores((previos) => (previos[campo] ? { ...previos, [campo]: undefined } : previos));
  };

  const enviar = async () => {
    setRechazo(null);
    const erroresCliente = validar(valores);
    setErrores(erroresCliente);
    const primero = CAMPOS.find((campo) => erroresCliente[campo]);
    if (primero) return document.getElementById(idCampo(primero))?.focus();

    setEnviando(true);
    try {
      const solicitud = await solicitarCompraCapacitacion(
        curso.id_curso,
        {
          id_empleado_solicitante: valores.id_empleado_solicitante,
          descripcion_requerimiento: valores.descripcion_requerimiento.trim(),
          cantidad_participantes: Number(valores.cantidad_participantes),
          ...(valores.fecha_requerida && { fecha_requerida: valores.fecha_requerida }),
          ...(valores.monto_estimado && { monto_estimado: valores.monto_estimado.trim() }),
        },
        { rol }
      );
      onEnviada(solicitud);
    } catch (error) {
      const { porCampo, generales } = mapearErroresApi(error.errores ?? [], CAMPOS);
      setErrores(porCampo);
      setRechazo(Object.keys(porCampo).length > 0 ? generales.join(' ') : error.message);
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Solicitar capacitación a Compras"
      onCerrar={onCerrar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono={Send} onClick={enviar} cargando={enviando}>
            {enviando ? 'Enviando…' : 'Enviar a Compras'}
          </Boton>
        </>
      }
    >
      <div className="capa-form">
        <p>
          Se enviará a Compras y Proveedores la solicitud del servicio <strong>{curso?.nombre}</strong>
          {curso?.codigo ? ` (${curso.codigo})` : ''}. Cuando emitan la orden, podrás vincularla al registrar la capacitación.
        </p>

        {rechazo !== null && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo registrar la solicitud">
            {rechazo || null}
          </Alerta>
        )}

        <fieldset className="capa-fieldset" disabled={enviando}>
          <Selector
            id={idCampo('id_empleado_solicitante')}
            etiqueta="Solicitante"
            requerido
            value={valores.id_empleado_solicitante}
            onChange={(e) => actualizarCampo('id_empleado_solicitante', e.target.value)}
            disabled={empleados.cargando || Boolean(empleados.error)}
            textoVacio={empleados.cargando ? 'Cargando…' : 'Selecciona al solicitante'}
            opciones={empleados.empleados.map((e) => ({ valor: e.id_empleado, etiqueta: e.nombre_completo }))}
            error={errores.id_empleado_solicitante ?? (empleados.error ? 'No se pudieron cargar los colaboradores.' : undefined)}
          />

          <CampoAreaTexto
            id={idCampo('descripcion_requerimiento')}
            etiqueta="Requerimiento"
            requerido
            filas={3}
            maxLength={DESCRIPCION_MAX}
            placeholder="Ej.: Curso de manipulación de alimentos para el personal de panadería."
            value={valores.descripcion_requerimiento}
            onChange={(e) => actualizarCampo('descripcion_requerimiento', e.target.value)}
            error={errores.descripcion_requerimiento}
            data-autofocus
          />

          <div className="capa-fila capa-fila--tres">
            <CampoTexto
              id={idCampo('cantidad_participantes')}
              type="number"
              min={1}
              step={1}
              etiqueta="Participantes"
              requerido
              value={valores.cantidad_participantes}
              onChange={(e) => actualizarCampo('cantidad_participantes', e.target.value)}
              error={errores.cantidad_participantes}
            />
            <CampoTexto
              id={idCampo('fecha_requerida')}
              type="date"
              etiqueta="Fecha requerida"
              min={fechaDeHoy()}
              value={valores.fecha_requerida}
              onChange={(e) => actualizarCampo('fecha_requerida', e.target.value)}
              error={errores.fecha_requerida}
            />
            <CampoTexto
              id={idCampo('monto_estimado')}
              inputMode="decimal"
              etiqueta="Monto estimado (Bs)"
              placeholder="0.00"
              value={valores.monto_estimado}
              onChange={(e) => actualizarCampo('monto_estimado', e.target.value)}
              error={errores.monto_estimado}
            />
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

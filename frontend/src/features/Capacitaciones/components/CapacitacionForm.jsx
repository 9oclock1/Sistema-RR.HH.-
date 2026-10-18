import { useId, useState } from 'react';
import { Save } from 'lucide-react';
import FileInput from '../../../components/common/FileInput';
import { Alerta, Boton, CampoTexto, Selector, Tarjeta } from '../../../components/ui';
import { useRol } from '../../../context/sesion';
import { mapearErroresApi } from '../../../utils/erroresApi';
import { formatearFecha } from '../../Vacantes/utils/formato';
import { useEmpleados } from '../../Asignaciones/hooks/useEmpleados';
import { useCursos, useOrdenesServicio } from '../hooks/useCatalogosCapacitacion';
import { describirMeses, fechaDeHoy, sumarMeses } from '../utils/fechas';
import {
  CERTIFICADO,
  FECHA_ESPECIFICA,
  INSTITUCION_MAX,
  MESES_VIGENCIA,
  SIN_VENCIMIENTO,
  TIPOS_CAPACITACION,
} from '../utils/opciones';

const CAMPOS = [
  'id_empleado',
  'id_curso',
  'institucion_emisora',
  'fecha_inicio',
  'fecha_fin',
  'fecha_emision',
  'fecha_vencimiento',
  'id_solicitud_servicio',
];

const VALORES_INICIALES = {
  id_curso: '',
  institucion_emisora: '',
  fecha_inicio: '',
  fecha_fin: '',
  fecha_emision: '',
  vigencia: SIN_VENCIMIENTO,
  fecha_vencimiento: '',
  id_solicitud_servicio: '',
};

const vigenciaPorDefecto = (curso) => {
  if (!curso?.requiere_vencimiento) return SIN_VENCIMIENTO;
  return curso.meses_vigencia ? String(curso.meses_vigencia) : FECHA_ESPECIFICA;
};

const opcionesVigencia = (curso) => {
  const meses = new Set(MESES_VIGENCIA);
  if (curso?.meses_vigencia) meses.add(curso.meses_vigencia);

  return [
    ...(curso?.requiere_vencimiento ? [] : [{ valor: SIN_VENCIMIENTO, etiqueta: 'Sin vencimiento' }]),
    ...[...meses]
      .sort((a, b) => a - b)
      .map((m) => ({
        valor: String(m),
        etiqueta: `${describirMeses(m)}${m === curso?.meses_vigencia ? ' (vigencia del curso)' : ''}`,
      })),
    { valor: FECHA_ESPECIFICA, etiqueta: 'Otra fecha…' },
  ];
};

const fechaVencimiento = ({ vigencia, fecha_emision, fecha_vencimiento }) => {
  if (vigencia === SIN_VENCIMIENTO) return '';
  if (vigencia === FECHA_ESPECIFICA) return fecha_vencimiento;
  return fecha_emision ? sumarMeses(fecha_emision, Number(vigencia)) : '';
};

const validar = (valores, idEmpleado, curso) => {
  const errores = {};
  const hoy = fechaDeHoy();
  const vencimiento = fechaVencimiento(valores);
  const { fecha_inicio, fecha_fin, fecha_emision } = valores;

  if (!idEmpleado) errores.id_empleado = 'Selecciona al colaborador.';
  if (!valores.id_curso) errores.id_curso = 'Selecciona el curso o certificación.';
  if (!valores.institucion_emisora.trim()) errores.institucion_emisora = 'Indica la institución que emitió el certificado.';
  if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) {
    errores.fecha_fin = 'La fecha de fin no puede ser anterior a la de inicio.';
  }
  if (!fecha_emision) {
    errores.fecha_emision = 'Indica la fecha de emisión del certificado.';
  } else if (fecha_emision > hoy) {
    errores.fecha_emision = 'La fecha de emisión no puede ser posterior a hoy.';
  } else if (fecha_emision < (fecha_fin || fecha_inicio || fecha_emision)) {
    errores.fecha_emision = 'La emisión no puede ser anterior a la realización del curso.';
  }
  if (valores.vigencia === FECHA_ESPECIFICA && !vencimiento) {
    errores.fecha_vencimiento = 'Indica la fecha de vencimiento.';
  } else if (vencimiento && fecha_emision && vencimiento <= fecha_emision) {
    errores.fecha_vencimiento = 'El vencimiento debe ser posterior a la emisión.';
  } else if (curso?.requiere_vencimiento && valores.vigencia === SIN_VENCIMIENTO) {
    errores.fecha_vencimiento = 'Este curso exige fecha de vencimiento.';
  }
  return errores;
};

const validarCertificado = (archivo) => {
  if (!CERTIFICADO.tipos.includes(archivo.type)) return 'Formato no permitido. Solo se aceptan archivos PDF, JPG, PNG o WEBP.';
  if (archivo.size > CERTIFICADO.maxMb * 1024 * 1024) return `El archivo supera el máximo de ${CERTIFICADO.maxMb} MB.`;
  return null;
};

export default function CapacitacionForm({ idEmpleado, onCambiarEmpleado, onRegistrar }) {
  const uid = useId();
  const idCampo = (campo) => `${uid}-${campo}`;
  const rol = useRol();
  const empleados = useEmpleados();
  const cursos = useCursos(rol);

  const [valores, setValores] = useState(VALORES_INICIALES);
  const [certificado, setCertificado] = useState(null);
  const [errores, setErrores] = useState({});
  const [rechazo, setRechazo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const curso = cursos.cursos.find((c) => c.id_curso === valores.id_curso) ?? null;
  const ordenes = useOrdenesServicio(valores.id_curso, rol);
  const vencimiento = fechaVencimiento(valores);
  const fechaEspecifica = valores.vigencia === FECHA_ESPECIFICA;

  const quitarError = (...campos) =>
    setErrores((previos) => {
      if (!campos.some((campo) => previos[campo])) return previos;
      const siguientes = { ...previos };
      campos.forEach((campo) => delete siguientes[campo]);
      return siguientes;
    });

  const actualizarCampo = (campo, valor) => {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    quitarError(campo, ...(campo === 'vigencia' || campo === 'fecha_emision' ? ['fecha_vencimiento'] : []));
  };

  const seleccionarCurso = (idCurso) => {
    const elegido = cursos.cursos.find((c) => c.id_curso === idCurso);
    setValores((previos) => ({
      ...previos,
      id_curso: idCurso,
      vigencia: vigenciaPorDefecto(elegido),
      fecha_vencimiento: '',
      id_solicitud_servicio: '',
    }));
    quitarError('id_curso', 'fecha_vencimiento', 'id_solicitud_servicio');
  };

  const seleccionarCertificado = (archivo) => {
    const error = validarCertificado(archivo);
    setCertificado(error ? null : archivo);
    setErrores((previos) => ({ ...previos, certificado: error ?? undefined }));
  };

  const enfocar = (campo) => {
    const destino = campo === 'fecha_vencimiento' && !fechaEspecifica ? 'vigencia' : campo;
    document.getElementById(idCampo(destino))?.focus();
  };

  const manejarSubmit = async (evento) => {
    evento.preventDefault();
    setRechazo(null);

    const erroresCliente = validar(valores, idEmpleado, curso);
    setErrores(erroresCliente);
    const primero = CAMPOS.find((campo) => erroresCliente[campo]);
    if (primero) return enfocar(primero);

    const datos = new FormData();
    datos.append('id_empleado', idEmpleado);
    datos.append('id_curso', valores.id_curso);
    datos.append('institucion_emisora', valores.institucion_emisora.trim());
    datos.append('fecha_emision', valores.fecha_emision);
    if (valores.fecha_inicio) datos.append('fecha_inicio', valores.fecha_inicio);
    if (valores.fecha_fin) datos.append('fecha_fin', valores.fecha_fin);
    if (vencimiento) datos.append('fecha_vencimiento', vencimiento);
    if (valores.id_solicitud_servicio) datos.append('id_solicitud_servicio', valores.id_solicitud_servicio);
    if (certificado) datos.append('certificado', certificado);

    setEnviando(true);
    try {
      await onRegistrar(datos);
    } catch (error) {
      const { porCampo, generales } = mapearErroresApi(error.errores ?? [], [...CAMPOS, 'certificado']);
      const rechazados = CAMPOS.filter((campo) => porCampo[campo]);
      const hayCampos = rechazados.length > 0 || Boolean(porCampo.certificado);
      setRechazo(hayCampos ? generales.join(' ') : error.message);
      setErrores(porCampo);
      if (rechazados.length > 0) enfocar(rechazados[0]);
      setEnviando(false);
    }
  };

  const ayudaVigencia = () => {
    if (!curso) return 'Selecciona primero el curso.';
    if (fechaEspecifica) return undefined;
    if (valores.vigencia === SIN_VENCIMIENTO) return 'El certificado no tiene fecha de caducidad.';
    return valores.fecha_emision
      ? `Vencerá el ${formatearFecha(vencimiento)}.`
      : 'La fecha de vencimiento se calcula desde la emisión.';
  };

  const errorVigencia = fechaEspecifica ? undefined : errores.fecha_vencimiento;

  return (
    <Tarjeta titulo="Nueva capacitación o certificación">
      <form className="capa-form" onSubmit={manejarSubmit} noValidate aria-label="Nueva capacitación o certificación">
        {rechazo !== null && (
          <Alerta tono="peligro" role="alert" titulo="No se pudo registrar la capacitación">
            {rechazo || null}
          </Alerta>
        )}
        {cursos.error && (
          <Alerta tono="aviso" role="alert" titulo="No se pudieron cargar los cursos">
            {cursos.error.message}
          </Alerta>
        )}

        <fieldset className="capa-fieldset" disabled={enviando}>
          <div className="capa-fila">
            <Selector
              id={idCampo('id_empleado')}
              etiqueta="Colaborador"
              requerido
              value={idEmpleado}
              onChange={(e) => {
                onCambiarEmpleado(e.target.value);
                quitarError('id_empleado');
              }}
              disabled={empleados.cargando || Boolean(empleados.error)}
              textoVacio={empleados.cargando ? 'Cargando…' : 'Selecciona un colaborador'}
              opciones={empleados.empleados.map((e) => ({
                valor: e.id_empleado,
                etiqueta: `${e.nombre_completo} · CI ${e.numero_documento}`,
              }))}
              error={errores.id_empleado ?? (empleados.error ? 'No se pudieron cargar los colaboradores.' : undefined)}
            />

            <Selector
              id={idCampo('id_curso')}
              etiqueta="Curso o certificación"
              requerido
              value={valores.id_curso}
              onChange={(e) => seleccionarCurso(e.target.value)}
              disabled={cursos.cargando || Boolean(cursos.error)}
              textoVacio={cursos.cargando ? 'Cargando…' : 'Selecciona un curso'}
              opciones={cursos.cursos.map((c) => ({
                valor: c.id_curso,
                etiqueta: `${c.nombre} · ${TIPOS_CAPACITACION[c.tipo_capacitacion] ?? c.tipo_capacitacion}`,
              }))}
              error={errores.id_curso}
              ayuda={curso && !errores.id_curso ? `${curso.codigo} · ${curso.horas_academicas} h académicas` : undefined}
            />
          </div>

          <CampoTexto
            id={idCampo('institucion_emisora')}
            etiqueta="Institución emisora"
            requerido
            value={valores.institucion_emisora}
            maxLength={INSTITUCION_MAX}
            placeholder="Ej.: SEDES La Paz"
            onChange={(e) => actualizarCampo('institucion_emisora', e.target.value)}
            error={errores.institucion_emisora}
          />

          <div className="capa-fila capa-fila--tres">
            <CampoTexto
              id={idCampo('fecha_inicio')}
              type="date"
              etiqueta="Inicio del curso"
              value={valores.fecha_inicio}
              max={valores.fecha_fin || fechaDeHoy()}
              onChange={(e) => actualizarCampo('fecha_inicio', e.target.value)}
              error={errores.fecha_inicio}
            />
            <CampoTexto
              id={idCampo('fecha_fin')}
              type="date"
              etiqueta="Fin del curso"
              value={valores.fecha_fin}
              min={valores.fecha_inicio || undefined}
              max={fechaDeHoy()}
              onChange={(e) => actualizarCampo('fecha_fin', e.target.value)}
              error={errores.fecha_fin}
            />
            <CampoTexto
              id={idCampo('fecha_emision')}
              type="date"
              etiqueta="Emisión del certificado"
              requerido
              value={valores.fecha_emision}
              min={valores.fecha_fin || valores.fecha_inicio || undefined}
              max={fechaDeHoy()}
              onChange={(e) => actualizarCampo('fecha_emision', e.target.value)}
              error={errores.fecha_emision}
            />
          </div>

          <div className="capa-fila">
            <Selector
              id={idCampo('vigencia')}
              etiqueta="Vigencia"
              requerido={Boolean(curso?.requiere_vencimiento)}
              value={valores.vigencia}
              onChange={(e) => actualizarCampo('vigencia', e.target.value)}
              disabled={!curso}
              opciones={opcionesVigencia(curso)}
              error={errorVigencia}
              ayuda={errorVigencia ? undefined : ayudaVigencia()}
            />
            {fechaEspecifica && (
              <CampoTexto
                id={idCampo('fecha_vencimiento')}
                type="date"
                etiqueta="Fecha de vencimiento"
                requerido
                value={valores.fecha_vencimiento}
                min={valores.fecha_emision || undefined}
                onChange={(e) => actualizarCampo('fecha_vencimiento', e.target.value)}
                error={errores.fecha_vencimiento}
              />
            )}
          </div>

          <Selector
            id={idCampo('id_solicitud_servicio')}
            etiqueta="Orden de servicio de Compras"
            value={valores.id_solicitud_servicio}
            onChange={(e) => actualizarCampo('id_solicitud_servicio', e.target.value)}
            disabled={!curso || ordenes.cargando || ordenes.ordenes.length === 0}
            textoVacio={ordenes.cargando ? 'Cargando…' : 'No corresponde a un servicio externo'}
            opciones={ordenes.ordenes.map((o) => ({
              valor: o.id_solicitud_servicio,
              etiqueta: `${o.numero_orden_servicio} · ${o.proveedor_nombre}`,
            }))}
            error={errores.id_solicitud_servicio}
            ayuda={
              errores.id_solicitud_servicio
                ? undefined
                : 'Opcional. Solo si la capacitación fue un servicio externo con orden emitida por Compras.'
            }
          />

          <FileInput
            etiqueta="Certificado"
            ayuda={`Opcional. PDF, JPG, PNG o WEBP (máx. ${CERTIFICADO.maxMb} MB)`}
            aceptar={CERTIFICADO.aceptar}
            archivo={certificado}
            error={errores.certificado}
            deshabilitado={enviando}
            onSeleccionar={seleccionarCertificado}
            onRemover={() => {
              setCertificado(null);
              quitarError('certificado');
            }}
          />
        </fieldset>

        <div className="capa-form__pie">
          <Boton type="submit" variante="primario" icono={Save} cargando={enviando}>
            {enviando ? 'Registrando…' : 'Registrar capacitación'}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

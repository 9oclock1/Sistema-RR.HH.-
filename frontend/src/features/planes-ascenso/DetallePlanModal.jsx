import { useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { Alerta, Boton, Etiqueta, Modal, ModalConfirmacion } from '../../components/ui';
import BarraAvance from './BarraAvance';
import { ESTADO_CURSO, ESTADO_PLAN, formatearDia, formatearMomento } from './planesAscenso';

function Curso({ curso }) {
  const estado = ESTADO_CURSO[curso.estado];
  return (
    <li className="pa-curso">
      <div className="pa-curso__cabecera">
        <span className="pa-fuerte">{curso.nombre}</span>
        <Etiqueta tono={estado.tono} icono={estado.icono}>
          {estado.texto}
        </Etiqueta>
      </div>
      <span className="pa-sutil">
        {curso.codigo} · {curso.horas_academicas} h · {curso.es_obligatorio ? 'Obligatorio' : 'Opcional'}
      </span>
      {curso.certificado && (
        <span className="pa-sutil">
          Kardex: {curso.certificado.institucion_emisora}, emitido el {formatearDia(curso.certificado.fecha_emision)}
          {curso.certificado.fecha_vencimiento && `, vence el ${formatearDia(curso.certificado.fecha_vencimiento)}`}
        </span>
      )}
      {curso.motivo && <span className="pa-motivo">{curso.motivo}</span>}
    </li>
  );
}

// Criterios 1 y 3: los cursos del plan con su estado y la formalización del ascenso. Si quedan cursos pendientes, el
// servidor responde la advertencia y se pide una confirmación explícita antes de formalizar.
export default function DetallePlanModal({ plan, puedeFormalizar, onFormalizar, onCerrar }) {
  const [advertencia, setAdvertencia] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);

  const cerrar = () => {
    setAdvertencia(null);
    setError(null);
    onCerrar();
  };

  const formalizar = async (confirmarPendientes) => {
    setProcesando(true);
    setError(null);
    try {
      await onFormalizar(plan.id_plan, { confirmar_pendientes: confirmarPendientes });
      setAdvertencia(null);
    } catch (fallo) {
      if (fallo.status === 409 && fallo.datos?.codigo === 'CURSOS_PENDIENTES') setAdvertencia(fallo.datos);
      else setError(fallo);
    } finally {
      setProcesando(false);
    }
  };

  if (!plan) return <Modal abierto={false} titulo="" onCerrar={cerrar} />;

  const enCurso = plan.estado === 'EN_CURSO';
  const estadoPlan = ESTADO_PLAN[plan.estado];

  return (
    <>
      <Modal
        abierto={Boolean(plan) && !advertencia}
        titulo={`Plan de ${plan.empleado.nombre_completo}`}
        tamano="lg"
        onCerrar={cerrar}
        bloqueado={procesando}
        pie={
          <>
            <Boton variante="sutil" onClick={cerrar} disabled={procesando}>
              Cerrar
            </Boton>
            {puedeFormalizar && enCurso && (
              <Boton variante="primario" icono={BadgeCheck} cargando={procesando} onClick={() => formalizar(false)}>
                Formalizar ascenso
              </Boton>
            )}
          </>
        }
      >
        <div className="pa-apilado">
          <div className="pa-resumen">
            <span>
              {plan.empleado.cargo_actual.nombre} → <span className="pa-fuerte">{plan.cargo_destino.nombre}</span>
            </span>
            <Etiqueta tono={estadoPlan.tono}>{estadoPlan.texto}</Etiqueta>
          </div>
          <BarraAvance avance={plan.avance} nombre={plan.empleado.nombre_completo} />
          {plan.observaciones && <p className="pa-sutil">{plan.observaciones}</p>}
          {plan.formalizacion && (
            <Alerta tono={plan.formalizacion.con_pendientes ? 'aviso' : 'exito'} titulo="Ascenso formalizado">
              {`El ${formatearMomento(plan.formalizacion.formalizado_en)}`}
              {plan.formalizacion.con_pendientes
                ? `, con ${plan.formalizacion.cursos_pendientes} curso(s) pendiente(s) tras la advertencia.`
                : ', con el plan de capacitación completo.'}
            </Alerta>
          )}
          {error && (
            <Alerta tono="peligro" role="alert" titulo="No se pudo formalizar el ascenso">
              {error.message}
            </Alerta>
          )}
          <h3 className="pa-subtitulo">Cursos requeridos por el cargo</h3>
          <ul className="pa-cursos" aria-label="Cursos requeridos por el cargo">
            {plan.cursos.map((curso) => (
              <Curso key={curso.id_curso} curso={curso} />
            ))}
          </ul>
        </div>
      </Modal>

      <ModalConfirmacion
        abierto={Boolean(advertencia)}
        titulo="El candidato tiene cursos pendientes"
        textoConfirmar="Formalizar de todos modos"
        variante="primario"
        procesando={procesando}
        onConfirmar={() => formalizar(true)}
        onCancelar={() => setAdvertencia(null)}
      >
        {advertencia && (
          <div className="pa-apilado">
            <Alerta tono="aviso" role="alert" titulo="Advertencia">
              {advertencia.advertencia}
            </Alerta>
            <ul className="pa-pendientes" aria-label="Cursos pendientes">
              {advertencia.cursos_pendientes.map((curso) => (
                <li key={curso.codigo}>
                  <span className="pa-fuerte">{curso.nombre}</span>: {curso.motivo}
                </li>
              ))}
            </ul>
            <p className="pa-sutil">Si continúa, el ascenso se formaliza y queda constancia de los cursos pendientes.</p>
          </div>
        )}
      </ModalConfirmacion>
    </>
  );
}

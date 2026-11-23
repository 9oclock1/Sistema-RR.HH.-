import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { GraduationCap, RefreshCw } from 'lucide-react';
import { asignarPlanAscenso, formalizarAscenso, getPlanesAscenso } from '../../api/planesAscensoApi';
import { Alerta, Boton, EncabezadoPagina, EstadoVacio, Etiqueta, Selector, Tabla, Tarjeta, useAvisos } from '../../components/ui';
import { useRol, useUsuario } from '../../context/sesion';
import useRecurso from '../quejas/casos/useRecurso';
import AsignarPlanFormulario from './AsignarPlanFormulario';
import BarraAvance from './BarraAvance';
import DetallePlanModal from './DetallePlanModal';
import { ESTADO_PLAN, FILTROS_ESTADO, describirAvance } from './planesAscenso';
import './planesAscenso.css';

const columnas = (abrir) => [
  {
    clave: 'candidato',
    titulo: 'Candidato',
    ancho: '24%',
    celda: (plan) => (
      <div className="pa-celda">
        <span className="pa-fuerte">{plan.empleado.nombre_completo}</span>
        <span className="pa-sutil">
          {plan.empleado.cargo_actual.nombre} · {plan.empleado.sucursal_actual.nombre}
        </span>
      </div>
    ),
  },
  {
    clave: 'destino',
    titulo: 'Cargo destino',
    ancho: '20%',
    celda: (plan) => (
      <div className="pa-celda">
        <span>{plan.cargo_destino.nombre}</span>
        <span className="pa-sutil">{plan.cargo_destino.area}</span>
      </div>
    ),
  },
  {
    clave: 'avance',
    titulo: 'Avance',
    ancho: '28%',
    celda: (plan) => <BarraAvance avance={plan.avance} nombre={plan.empleado.nombre_completo} />,
  },
  {
    clave: 'estado',
    titulo: 'Estado',
    ancho: '16%',
    celda: (plan) => (
      <div className="pa-celda">
        <Etiqueta tono={ESTADO_PLAN[plan.estado].tono}>{ESTADO_PLAN[plan.estado].texto}</Etiqueta>
        {plan.formalizacion?.con_pendientes && (
          <span className="pa-sutil">Con {plan.formalizacion.cursos_pendientes} pendiente(s)</span>
        )}
      </div>
    ),
  },
  {
    clave: 'acciones',
    titulo: 'Acciones',
    ancho: '12%',
    alinear: 'fin',
    celda: (plan) => (
      <Boton tamano="sm" onClick={() => abrir(plan.id_plan)} aria-label={`Ver el plan de ${plan.empleado.nombre_completo}`}>
        Ver plan
      </Boton>
    ),
  },
];

export default function PlanesAscensoPage() {
  const rol = useRol();
  const usuario = useUsuario();
  const avisar = useAvisos();
  // Asignar planes y formalizar ascensos es solo del Administrador de RRHH; la gerencia consulta el seguimiento.
  const esAdministrador = rol === 'admin';
  const [estado, setEstado] = useState('EN_CURSO');
  const [idAbierto, setIdAbierto] = useState(null);

  const cargar = useCallback(() => getPlanesAscenso({ estado, rol }), [estado, rol]);
  const { datos, error, cargando, reintentar } = useRecurso(cargar);
  const planes = datos?.planes ?? [];
  const planAbierto = planes.find((p) => p.id_plan === idAbierto) ?? null;

  const asignar = async (formulario) => {
    const plan = await asignarPlanAscenso(formulario, { rol, idEmpleado: usuario });
    avisar({
      tono: 'exito',
      titulo: 'Plan de ascenso asignado',
      mensaje: `${plan.empleado.nombre_completo} hacia «${plan.cargo_destino.nombre}»: ${describirAvance(plan.avance)}.`,
    });
    if (estado === 'FORMALIZADO') setEstado('EN_CURSO');
    else reintentar();
    setIdAbierto(plan.id_plan);
  };

  const formalizar = async (idPlan, opciones) => {
    const plan = await formalizarAscenso(idPlan, opciones, { rol, idEmpleado: usuario });
    avisar({
      tono: plan.advertencia ? 'aviso' : 'exito',
      titulo: 'Ascenso formalizado',
      mensaje: plan.advertencia
        ? `${plan.empleado.nombre_completo} ya es ${plan.cargo_destino.nombre}. Quedó constancia de ${plan.formalizacion.cursos_pendientes} curso(s) pendiente(s).`
        : `${plan.empleado.nombre_completo} ya es ${plan.cargo_destino.nombre}, con su plan de capacitación completo.`,
    });
    setIdAbierto(null);
    reintentar();
  };

  return (
    <section className="pa-pagina" aria-labelledby="pa-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Expediente' }]}
        enlace={Link}
        titulo="Planes de ascenso"
        idTitulo="pa-titulo"
        descripcion="Seguimiento de las capacitaciones que cada candidato debe completar antes de asumir un nuevo cargo. El estado de cada curso se toma del Kardex."
        acciones={
          <Boton icono={RefreshCw} onClick={reintentar} cargando={cargando && Boolean(datos)}>
            Actualizar
          </Boton>
        }
      />

      {esAdministrador && <AsignarPlanFormulario onAsignar={asignar} />}

      <Tarjeta nivelTitulo={2} titulo="Seguimiento por candidato">
        <div className="pa-apilado">
          <div className="pa-filtros">
            <Selector
              etiqueta="Mostrar"
              value={estado}
              onChange={(evento) => setEstado(evento.target.value)}
              opciones={FILTROS_ESTADO}
            />
          </div>

          {error ? (
            <Alerta
              tono="peligro"
              role="alert"
              titulo="No se pudo cargar el seguimiento"
              acciones={
                <Boton tamano="sm" onClick={reintentar}>
                  Reintentar
                </Boton>
              }
            >
              {error.message}
            </Alerta>
          ) : (
            <Tabla
              columnas={columnas(setIdAbierto)}
              filas={planes}
              claveFila="id_plan"
              cargando={cargando && !datos}
              descripcion="Candidatos con su plan de capacitación y porcentaje de avance"
              vacio={
                <EstadoVacio
                  icono={GraduationCap}
                  titulo="No hay planes de ascenso"
                  mensaje={
                    estado === 'EN_CURSO'
                      ? 'Asigne un plan a un empleado para seguir sus capacitaciones antes del ascenso.'
                      : 'No hay planes con este estado.'
                  }
                />
              }
            />
          )}
        </div>
      </Tarjeta>

      <DetallePlanModal
        plan={planAbierto}
        puedeFormalizar={esAdministrador}
        onFormalizar={formalizar}
        onCerrar={() => setIdAbierto(null)}
      />
    </section>
  );
}

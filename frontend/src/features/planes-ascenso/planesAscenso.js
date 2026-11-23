import { CircleCheck, Clock } from 'lucide-react';

export const RUTA_PLANES_ASCENSO = '/expediente/planes-ascenso';

export const FILTROS_ESTADO = [
  { valor: 'EN_CURSO', etiqueta: 'En curso' },
  { valor: 'FORMALIZADO', etiqueta: 'Ascensos formalizados' },
  { valor: 'TODOS', etiqueta: 'Todos' },
];

export const ESTADO_CURSO = {
  CUMPLIDO: { texto: 'Cumplido', tono: 'exito', icono: CircleCheck },
  PENDIENTE: { texto: 'Pendiente', tono: 'aviso', icono: Clock },
};

export const ESTADO_PLAN = {
  EN_CURSO: { texto: 'En curso', tono: 'info' },
  FORMALIZADO: { texto: 'Ascenso formalizado', tono: 'exito' },
};

const porcentaje = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 });
const dia = new Intl.DateTimeFormat('es-BO', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
const momento = new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: 'short', year: 'numeric' });

export const formatearPorcentaje = (valor) => `${porcentaje.format(valor)} %`;
export const formatearDia = (fecha) => (fecha ? dia.format(new Date(`${fecha}T00:00:00Z`)) : '—');
export const formatearMomento = (valor) => (valor ? momento.format(new Date(valor)) : '—');

// Verde al completar el plan, ámbar desde la mitad, rojo por debajo: solo para el color de la barra; el valor
// siempre se muestra en texto.
export const varianteAvance = (valor) => (valor >= 100 ? 'completo' : valor >= 50 ? 'medio' : 'bajo');

export const describirAvance = ({ cursos_cumplidos: cumplidos, cursos_requeridos: requeridos }) =>
  `${cumplidos} de ${requeridos} ${requeridos === 1 ? 'curso obligatorio cumplido' : 'cursos obligatorios cumplidos'}`;

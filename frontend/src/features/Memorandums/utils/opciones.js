// Temporal hasta contar con inicio de sesión: quien emite el memorándum.
export const ID_EMPLEADO_EMISOR = 'e0000000-0000-4000-8000-000000000002';

// Datos de prueba hasta conectar los catálogos reales de empleados y tipos de memorándum.
export const EMPLEADOS_PRUEBA = [{ valor: 'e0000000-0000-4000-8000-000000000001', etiqueta: 'Empleado de prueba' }];
export const TIPOS_MEMO_PRUEBA = [{ valor: '1', etiqueta: 'Llamada de atención' }];

export const NATURALEZAS_FALTA = [
  { valor: 'OPERATIVA', etiqueta: 'Operativa' },
  { valor: 'CONDUCTA', etiqueta: 'De conducta' },
];

export const GRAVEDADES_FALTA = [
  { valor: 'LEVE', etiqueta: 'Leve' },
  { valor: 'MODERADA', etiqueta: 'Moderada' },
  { valor: 'GRAVE', etiqueta: 'Grave' },
];

// Mismos límites que valida el backend al recibir la evidencia.
export const EVIDENCIA = {
  aceptar: '.pdf,.jpg,.jpeg,.png',
  tipos: ['application/pdf', 'image/jpeg', 'image/png'],
  maxMb: 5,
};

export const ASUNTO_MAX = 150;

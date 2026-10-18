export const CLASIFICACION_AMONESTACION = 'AMONESTACION';

// Opciones de un <Selector> a partir de la lista de empleados de la API.
export const opcionesEmpleados = (empleados) =>
  empleados.map((empleado) => ({
    valor: empleado.id_empleado,
    etiqueta: `${empleado.nombre_completo} · ${empleado.cargo}`,
  }));

export const opcionesTipos = (tipos) =>
  tipos.map((tipo) => ({ valor: String(tipo.id_tipo_memo), etiqueta: tipo.nombre }));

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

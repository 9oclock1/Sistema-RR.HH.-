// Temporal hasta contar con inicio de sesión: quien otorga el reconocimiento.
export const EMISOR_PRUEBA = {
  id: 'e0000000-0000-4000-8000-000000000002',
  nombre: 'María Fernanda Quispe',
  cargo: 'Supervisor de sucursal',
};

// Datos de prueba hasta conectar los catálogos reales de empleados y tipos de memorándum.
// El PDF oficial imprime los datos que tenga el empleado en la base, no estos.
export const EMPLEADOS_PRUEBA = [
  {
    valor: 'e0000000-0000-4000-8000-000000000001',
    etiqueta: 'José Ángel Peñaranda Núñez',
    cargo: 'Cajero de sucursal',
    sucursal: 'Sucursal Sopocachi',
  },
  {
    valor: 'e0000000-0000-4000-8000-000000000003',
    etiqueta: 'Luis Alberto Mamani Flores',
    cargo: 'Reponedor',
    sucursal: 'Sucursal Miraflores',
  },
];

// Deben existir en TIPOS_MEMORANDUM con clasificación RECONOCIMIENTO.
export const TIPOS_RECONOCIMIENTO_PRUEBA = [
  { valor: '2', etiqueta: 'Puntualidad' },
  { valor: '3', etiqueta: 'Rendimiento operativo' },
];

// Mismos textos que imprime el PDF oficial (pdfReconocimientosService del EmployeeService).
export const DOCUMENTO = {
  institucion: 'Sistema de Recursos Humanos',
  unidad: 'Gerencia de Recursos Humanos',
  titulo: 'Reconocimiento institucional',
  subtitulo: 'Memorándum de felicitación',
  distintivo: 'Desempeño destacado',
  cierre:
    'El presente reconocimiento queda registrado en su expediente personal (Kardex) como antecedente favorable para ' +
    'futuras evaluaciones de desempeño y promociones. La institución agradece su compromiso y le extiende sus más ' +
    'sinceras felicitaciones.',
};

export const ASUNTO_MAX = 150;

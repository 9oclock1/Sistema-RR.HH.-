const NIVELES_EDUCACION = [
  { codigo: 'BACHILLER', nombre: 'Bachiller', orden: 1 },
  { codigo: 'TECNICO_MEDIO', nombre: 'Técnico medio', orden: 2 },
  { codigo: 'TECNICO_SUPERIOR', nombre: 'Técnico superior', orden: 3 },
  { codigo: 'LICENCIATURA', nombre: 'Licenciatura', orden: 4 },
  { codigo: 'MAESTRIA', nombre: 'Maestría', orden: 5 },
  { codigo: 'DOCTORADO', nombre: 'Doctorado', orden: 6 },
];

const CODIGOS_NIVEL_EDUCACION = NIVELES_EDUCACION.map((n) => n.codigo);

module.exports = { NIVELES_EDUCACION, CODIGOS_NIVEL_EDUCACION };

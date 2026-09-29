const HttpError = require('../utils/HttpError');
const employeeServiceClient = require('./employeeServiceClient');

const PATRONES_NIVEL = [
  { codigo: 'BACHILLER', patron: /\bbachiller/ },
  { codigo: 'TECNICO_MEDIO', patron: /\btecnico medio\b/ },
  { codigo: 'TECNICO_SUPERIOR', patron: /\btecnico superior\b/ },
  { codigo: 'LICENCIATURA', patron: /\blicenciad[oa]s?\b|\blicenciatura\b|\bingenier[oa]s?\b|\bingenieria\b/ },
  { codigo: 'MAESTRIA', patron: /\bmaestria\b|\bmagister\b/ },
  { codigo: 'DOCTORADO', patron: /\bdoctorado\b|\bph\.?d\b/ },
];

const PATRONES_EXPERIENCIA = [
  /(\d+(?:[.,]\d+)?)\s*anos?\s+de\s+experiencia/, 
  /experiencia\D{0,40}?(\d+(?:[.,]\d+)?)\s*anos?/, 
];

const MAX_EXPERIENCIA = 999.9;
const MAX_TITULO = 120;
const normalizar = (texto) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const inferirNivelEducacion = (texto) => PATRONES_NIVEL.find(({ patron }) => patron.test(texto))?.codigo ?? '';

const inferirExperiencia = (texto) => {
  for (const patron of PATRONES_EXPERIENCIA) {
    const coincidencia = patron.exec(texto);
    if (coincidencia) {
      const anios = Math.round(Number(coincidencia[1].replace(',', '.')) * 10) / 10;
      return Math.min(anios, MAX_EXPERIENCIA);
    }
  }
  return 0;
};

const componerDescripcion = ({ funciones = [], requisitos_minimos: requisitos = '' }) => {
  const secciones = [];
  if (funciones.length > 0) secciones.push(`Funciones clave:\n${funciones.map((f) => `- ${f}`).join('\n')}`);
  if (requisitos.trim() !== '') secciones.push(`Requisitos mínimos:\n${requisitos.trim()}`);
  return secciones.join('\n\n');
};
const mapearCargoAConvocatoria = (cargo) => {
  const requisitos = normalizar(cargo.requisitos_minimos || '');
  return {
    titulo_puesto: cargo.nombre.slice(0, MAX_TITULO),
    descripcion_puesto: componerDescripcion(cargo),
    nivel_educacion_min: inferirNivelEducacion(requisitos),
    year_experiencia_min: inferirExperiencia(requisitos),
    habilidades_clave_requeridas: [],
  };
};const obtenerCargoVigente = async (idCargo, { status = 400 } = {}) => {
  const cargo = await employeeServiceClient.obtenerCargo(idCargo);
  const campo = 'id_cargo_referencial';

  let mensaje = null;
  if (!cargo) mensaje = 'El cargo referencial no existe en el catálogo de cargos.';
  else if (!cargo.esta_activo) mensaje = 'El cargo referencial está dado de baja en el catálogo de cargos.';

  if (mensaje) throw new HttpError(status, mensaje, { campos_faltantes: [], errores: [{ campo, mensaje }] });
  return cargo;
};
const obtenerPerfilDesdeCargo = async (idCargo, opciones) => {
  const cargo = await obtenerCargoVigente(idCargo, opciones);
  return {
    cargo: {
      id_cargo: cargo.id_cargo,
      codigo: cargo.codigo,
      nombre: cargo.nombre,
      departamento: cargo.departamento,
      requisitos_minimos: cargo.requisitos_minimos,
      funciones: cargo.funciones,
    },
    perfil: mapearCargoAConvocatoria(cargo),
  };
};

module.exports = { obtenerCargoVigente, obtenerPerfilDesdeCargo, mapearCargoAConvocatoria };

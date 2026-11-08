const path = require("node:path");

const uuid = (grupo, n) => `${grupo.repeat(8)}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const ID_PLANTILLA = uuid("a", 1);
const ID_VERSION = uuid("b", 1);
const ID_VERSION_2 = uuid("b", 2);
const DEPARTAMENTO = uuid("c", 1);
const OTRO_DEPARTAMENTO = uuid("c", 2);
const EMPLEADO = uuid("d", 1);
const idCompetencia = (n) => uuid("e", n);

const ESTADOS = {
  1: { codigo: "BORRADOR", nombre: "Borrador" },
  2: { codigo: "PUBLICADA", nombre: "Publicada" },
  3: { codigo: "ARCHIVADA", nombre: "Archivada" },
};

// Fila tal como la devuelve plantillasModel.obtener: la plantilla con su versión más reciente.
const plantilla = (cambios = {}) => ({
  id_plantilla: ID_PLANTILLA,
  nombre: "Evaluación de personal de tienda",
  objetivo: "Medir la atención al cliente.",
  vigencia_desde: "2099-01-01",
  vigencia_hasta: "2099-12-31",
  creado_en: "2026-11-01T12:00:00.000Z",
  actualizado_en: "2026-11-01T12:00:00.000Z",
  id_departamento: DEPARTAMENTO,
  departamento: "Atención al cliente",
  id_creador: EMPLEADO,
  creador: "Andrea Salazar",
  id_version: ID_VERSION,
  numero_version: 1,
  id_estado_version: 1,
  estado_codigo: "BORRADOR",
  estado_nombre: "Borrador",
  fue_publicada: false,
  secciones_total: 0,
  ...cambios,
});

// Fila de versionesModel.obtener.
const version = (cambios = {}) => {
  const estado = cambios.id_estado_version ?? 1;
  return {
    id_version: ID_VERSION,
    id_plantilla: ID_PLANTILLA,
    numero_version: 1,
    id_estado_version: estado,
    estado_codigo: ESTADOS[estado].codigo,
    estado_nombre: ESTADOS[estado].nombre,
    publicada_en: estado === 1 ? null : "2026-11-02T12:00:00.000Z",
    creado_en: "2026-11-01T12:00:00.000Z",
    publicador: estado === 1 ? null : "Andrea Salazar",
    ...cambios,
  };
};

// Fila de versionesModel.listarSecciones.
const seccion = (n, cambios = {}) => ({
  id_seccion: uuid("f", n),
  orden: n,
  id_competencia: idCompetencia(n),
  nombre: `Competencia ${n}`,
  descripcion: null,
  esta_activa: true,
  tipo_codigo: n % 2 === 0 ? "FACTOR_OPERATIVO" : "COMPETENCIA_LABORAL",
  tipo_nombre: n % 2 === 0 ? "Factor operativo" : "Competencia laboral",
  ...cambios,
});

const ID_ESCALA = uuid("9", 1);

// Filas de versionesModel.listarCriterios y listarPreguntas: el criterio y la pregunta n pertenecen a la sección n.
const criterio = (n, cambios = {}) => ({
  id_criterio: uuid("1", n),
  id_seccion: uuid("f", n),
  nombre: `Criterio ${n}`,
  descripcion: null,
  orden: 1,
  ...cambios,
});

const pregunta = (n, peso, cambios = {}) => ({
  id_pregunta: uuid("2", n),
  id_criterio: uuid("1", n),
  id_escala: ID_ESCALA,
  texto: `Pregunta ${n}`,
  peso_porcentual: peso,
  es_obligatoria: true,
  orden: 1,
  ...cambios,
});

const datosPlantilla = (cambios = {}) => ({
  nombre: "Evaluación de personal de tienda",
  id_departamento: DEPARTAMENTO,
  objetivo: "Medir la atención al cliente.",
  vigencia_desde: "2099-01-01",
  vigencia_hasta: "2099-12-31",
  ...cambios,
});

const AREA = { id_departamento: DEPARTAMENTO, nombre: "Atención al cliente" };
const PERSONA = { id_empleado: EMPLEADO, nombres: "Andrea", apellidos: "Salazar Vega" };

// La transacción entrega un cliente falso: los servicios se prueban sin PostgreSQL. Debe llamarse antes de
// cargar los servicios, porque estos toman `enTransaccion` al importarse.
function simularTransaccion() {
  const clienteFalso = { query: async () => ({ rows: [] }) };
  const ruta = require.resolve(path.join(__dirname, "../../config/transaccion"));
  require.cache[ruta] = {
    id: ruta,
    filename: ruta,
    loaded: true,
    exports: { enTransaccion: async (trabajo) => trabajo(clienteFalso) },
  };
  return clienteFalso;
}

// Atrapa el error lanzado por una promesa para revisar su estado y su detalle.
async function error(promesa) {
  try {
    await promesa;
  } catch (e) {
    return e;
  }
  throw new Error("Se esperaba un error y la operación terminó bien");
}

module.exports = {
  ID_PLANTILLA,
  ID_VERSION,
  ID_VERSION_2,
  DEPARTAMENTO,
  OTRO_DEPARTAMENTO,
  EMPLEADO,
  AREA,
  PERSONA,
  idCompetencia,
  plantilla,
  version,
  seccion,
  ID_ESCALA,
  criterio,
  pregunta,
  datosPlantilla,
  simularTransaccion,
  error,
};

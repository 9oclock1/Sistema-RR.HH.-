const { mock } = require("node:test");
const desempenoModelo = require("../../models/desempenoModel");
const evaluacionesModelo = require("../../models/evaluacionesModel");
const ayudas = require("./plantillaEvaluacion");

// Un ciclo cerrado con cuatro colaboradores, para probar el consolidado sin base de datos.
//   A (Atención al cliente, Sopocachi): dos evaluadores, 87,78 y 85,56 → un solo puntaje de 86,67.
//   B (Atención al cliente, Miraflores): 85,56.
//   C (Recursos Humanos, Sopocachi): 36,67.
//   D (Atención al cliente, Miraflores): solo una evaluación VENCIDA, sin puntaje.
// Promedios (cada colaborador cuenta una vez): global 69,63; Atención al cliente 86,12; Recursos Humanos 36,67;
// Sopocachi 61,67; Miraflores 85,56. Por competencia: Atención 69, Trabajo en equipo 70, Puntualidad 70,83.

const { uuid } = ayudas;

const ENVIADA = 3;
const VENCIDA = 4;

const AREA = { ATENCION: uuid("d", 1), RRHH: uuid("d", 2) };
const SUCURSAL = { SOPOCACHI: uuid("e", 1), MIRAFLORES: uuid("e", 2) };
const EMPLEADO = {
  A: uuid("4", 31),
  B: uuid("4", 32),
  C: uuid("4", 33),
  D: uuid("4", 34),
};
const CICLO_CERRADO = uuid("1", 1);
const EVALUACION = {
  A1: uuid("f", 1),
  A2: uuid("f", 2),
  B: uuid("f", 3),
  C: uuid("f", 4),
  D: uuid("f", 5),
};

// Respuestas bajas de C: (20·40 + 15·40 + 15·40 + 20·40 + 20·25) / 90 = 36,67.
const RESPUESTAS_BAJAS = { 1: 2, 2: 2, 3: 2, 4: 2, 6: 1 };
const RESPUESTAS = {
  [EVALUACION.A1]: ayudas.RESPUESTAS_DEL_SEED,
  [EVALUACION.A2]: ayudas.RESPUESTAS_OBLIGATORIAS,
  [EVALUACION.B]: ayudas.RESPUESTAS_OBLIGATORIAS,
  [EVALUACION.C]: RESPUESTAS_BAJAS,
};

const ciclo = (cambios = {}) => ({
  id_ciclo: CICLO_CERRADO,
  nombre: "Evaluación de desempeño 2026-S1",
  id_estado_ciclo: 3,
  fecha_inicio: "2026-06-01",
  fecha_limite: "2026-07-03",
  cerrado_en: "2026-07-05T12:00:00.000Z",
  umbral_brecha: 60,
  id_periodo: uuid("6", 1),
  periodo: "2026-S1",
  ...cambios,
});

const fila = (
  idEvaluacion,
  empleado,
  nombres,
  apellidos,
  area,
  sucursal,
  estado,
  puntaje,
) => ({
  id_evaluacion: idEvaluacion,
  id_empleado: empleado,
  nombres,
  apellidos,
  id_departamento: area,
  departamento:
    area === AREA.ATENCION ? "Atención al cliente" : "Recursos Humanos",
  id_sucursal: sucursal,
  sucursal: sucursal === SUCURSAL.SOPOCACHI ? "Sopocachi" : "Miraflores",
  id_estado_evaluacion: estado,
  puntaje_final: puntaje,
});

const EVALUACIONES = [
  fila(
    EVALUACION.A1,
    EMPLEADO.A,
    "Carlos",
    "Rojas",
    AREA.ATENCION,
    SUCURSAL.SOPOCACHI,
    ENVIADA,
    87.78,
  ),
  fila(
    EVALUACION.A2,
    EMPLEADO.A,
    "Carlos",
    "Rojas",
    AREA.ATENCION,
    SUCURSAL.SOPOCACHI,
    ENVIADA,
    85.56,
  ),
  fila(
    EVALUACION.B,
    EMPLEADO.B,
    "Lucía",
    "Flores",
    AREA.ATENCION,
    SUCURSAL.MIRAFLORES,
    ENVIADA,
    85.56,
  ),
  fila(
    EVALUACION.C,
    EMPLEADO.C,
    "Sofía",
    "Condori",
    AREA.RRHH,
    SUCURSAL.SOPOCACHI,
    ENVIADA,
    36.67,
  ),
  fila(
    EVALUACION.D,
    EMPLEADO.D,
    "Diego",
    "Quispe",
    AREA.ATENCION,
    SUCURSAL.MIRAFLORES,
    VENCIDA,
    null,
  ),
];

const METRICAS = [
  {
    id_empleado: EMPLEADO.A,
    cantidad_quejas: 1,
    cantidad_felicitaciones: 2,
    minutos_resolucion_promedio: 12.5,
  },
  {
    id_empleado: EMPLEADO.B,
    cantidad_quejas: 9,
    cantidad_felicitaciones: 1,
    minutos_resolucion_promedio: 48.5,
  },
];

const SOLICITUD = {
  id_evento: uuid("5", 1),
  estado: "ENTREGADO",
  intentos: 1,
  ultimo_error: null,
  entregado_en: "2026-07-05T12:05:00.000Z",
  creado_en: "2026-07-05T12:00:00.000Z",
};

// Sustituye los modelos por datos en memoria. Devuelve lo que el servicio pidió, para comprobarlo.
function simular({
  cicloCerrado = ciclo(),
  evaluaciones = EVALUACIONES,
  metricas = METRICAS,
  solicitud = SOLICITUD,
  respuestas = RESPUESTAS,
} = {}) {
  const pedido = { idsEstructura: [], consultasCiclo: [] };
  mock.method(desempenoModelo, "obtenerCiclo", async (id) => {
    pedido.consultasCiclo.push(id);
    return cicloCerrado && id === cicloCerrado.id_ciclo ? cicloCerrado : null;
  });
  mock.method(
    desempenoModelo,
    "listarEvaluacionesDelCiclo",
    async () => evaluaciones,
  );
  mock.method(desempenoModelo, "listarMetricasCrm", async () => metricas);
  mock.method(desempenoModelo, "obtenerSolicitudCrm", async () => solicitud);
  mock.method(
    evaluacionesModelo,
    "listarEstructuraDeEvaluaciones",
    async (ids) => {
      pedido.idsEstructura.push(...ids);
      return ids.flatMap((idEvaluacion) =>
        ayudas
          .filas(respuestas[idEvaluacion])
          .map((f) => ({ ...f, id_evaluacion: idEvaluacion })),
      );
    },
  );
  mock.method(evaluacionesModelo, "listarNiveles", async () => ayudas.NIVELES);
  return pedido;
}

// Cliente de base de datos falso: responde con `filas` y guarda cada sentencia con sus parámetros.
function baseFalsa(filas = []) {
  const consultas = [];
  return {
    consultas,
    db: {
      query: async (sql, parametros) => {
        consultas.push({ sql: sql.replace(/\s+/g, " ").trim(), parametros });
        return { rows: filas, rowCount: filas.length };
      },
    },
  };
}

module.exports = {
  ...ayudas,
  ENVIADA,
  VENCIDA,
  AREA,
  SUCURSAL,
  EMPLEADO,
  CICLO_CERRADO,
  EVALUACION,
  EVALUACIONES,
  METRICAS,
  SOLICITUD,
  ciclo,
  fila,
  simular,
  baseFalsa,
};

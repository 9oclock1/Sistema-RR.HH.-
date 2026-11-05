const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// El modelo se prueba contra un pool simulado: se captura el SQL y los parámetros que enviaría a PostgreSQL.
const rutaPool = require.resolve(path.join(__dirname, "../config/db"));
const consultas = [];
let respuestas = [];
require.cache[rutaPool] = {
  id: rutaPool,
  filename: rutaPool,
  loaded: true,
  exports: {
    query: async (sql, valores) => {
      consultas.push({ sql, valores });
      return respuestas.shift() ?? { rows: [] };
    },
  },
};

const {
  ESTADO_EVALUACION,
  ESTADO_CICLO,
  validarFiltros,
  estadoEfectivo,
} = require("../utils/evaluaciones");
const identificarEmpleado = require("../middlewares/identificarEmpleado");
const modelo = require("../models/evaluacionesModel");
const servicio = require("../services/evaluacionesService");
const ayudas = require("./ayudas/plantillaEvaluacion");

const { EVALUADOR } = ayudas;
const CICLO = ayudas.uuid("1", 1);

const capturar = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
};

describe("RF-04 criterio 1: filtros de la bandeja (validarFiltros)", () => {
  it("sin filtros no restringe nada", () => {
    assert.deepEqual(validarFiltros({}), { idCiclo: null, estados: null });
    assert.deepEqual(validarFiltros(), { idCiclo: null, estados: null });
    assert.deepEqual(validarFiltros({ id_ciclo: "", estado: "" }), {
      idCiclo: null,
      estados: null,
    });
  });

  it("acepta uno o varios estados, sin importar mayúsculas ni espacios, y no los repite", () => {
    assert.deepEqual(validarFiltros({ estado: "pendiente" }).estados, [
      ESTADO_EVALUACION.PENDIENTE,
    ]);
    assert.deepEqual(
      validarFiltros({ estado: " PENDIENTE , borrador " }).estados,
      [ESTADO_EVALUACION.PENDIENTE, ESTADO_EVALUACION.BORRADOR],
    );
    assert.deepEqual(validarFiltros({ estado: "ENVIADA,ENVIADA" }).estados, [
      ESTADO_EVALUACION.ENVIADA,
    ]);
  });

  it("acepta el ciclo y lo normaliza a minúsculas", () => {
    assert.equal(
      validarFiltros({ id_ciclo: CICLO.toUpperCase() }).idCiclo,
      CICLO,
    );
  });

  it("rechaza estados desconocidos y ciclos mal formados indicando el campo", () => {
    const estado = capturar(() =>
      validarFiltros({ estado: "PENDIENTE,INVENTADO" }),
    );
    assert.equal(estado.estado, 400);
    assert.deepEqual(
      estado.detalles.map((d) => d.campo),
      ["estado"],
    );
    assert.match(
      estado.detalles[0].mensaje,
      /PENDIENTE, BORRADOR, ENVIADA, VENCIDA/,
    );

    const ciclo = capturar(() =>
      validarFiltros({ id_ciclo: "xyz", estado: ["PENDIENTE"] }),
    );
    assert.deepEqual(ciclo.detalles.map((d) => d.campo).sort(), [
      "estado",
      "id_ciclo",
    ]);
  });
});

describe("RF-04: estado efectivo de la evaluación (estadoEfectivo)", () => {
  const fila = (cambios) => ({
    id_estado_evaluacion: ESTADO_EVALUACION.PENDIENTE,
    fecha_limite: "2030-12-31",
    hoy: "2030-12-01",
    id_estado_ciclo: ESTADO_CICLO.ACTIVO,
    ...cambios,
  });

  it("una evaluación abierta dentro de plazo conserva su estado", () => {
    assert.equal(estadoEfectivo(fila()), ESTADO_EVALUACION.PENDIENTE);
    assert.equal(
      estadoEfectivo(
        fila({ id_estado_evaluacion: ESTADO_EVALUACION.BORRADOR }),
      ),
      ESTADO_EVALUACION.BORRADOR,
    );
  });

  it("el día de la fecha límite todavía está abierta; al día siguiente está vencida", () => {
    assert.equal(
      estadoEfectivo(fila({ fecha_limite: "2030-12-01" })),
      ESTADO_EVALUACION.PENDIENTE,
    );
    assert.equal(
      estadoEfectivo(fila({ fecha_limite: "2030-11-30" })),
      ESTADO_EVALUACION.VENCIDA,
    );
    assert.equal(
      estadoEfectivo(
        fila({
          fecha_limite: "2030-11-30",
          id_estado_evaluacion: ESTADO_EVALUACION.BORRADOR,
        }),
      ),
      ESTADO_EVALUACION.VENCIDA,
    );
  });

  it("al cerrarse el ciclo las evaluaciones abiertas pasan a vencidas aunque el plazo siga vigente", () => {
    assert.equal(
      estadoEfectivo(fila({ id_estado_ciclo: ESTADO_CICLO.CERRADO })),
      ESTADO_EVALUACION.VENCIDA,
    );
  });

  it("una evaluación enviada nunca vence", () => {
    const enviada = fila({
      id_estado_evaluacion: ESTADO_EVALUACION.ENVIADA,
      fecha_limite: "2020-01-01",
      id_estado_ciclo: ESTADO_CICLO.CERRADO,
    });
    assert.equal(estadoEfectivo(enviada), ESTADO_EVALUACION.ENVIADA);
  });
});

describe("RF-04: identificación del evaluador (identificarEmpleado)", () => {
  const pedir = (cabeceras) => {
    const req = { get: (nombre) => cabeceras[nombre] };
    let siguiente = false;
    const error = capturar(() =>
      identificarEmpleado(req, {}, () => (siguiente = true)),
    );
    return { req, error, siguiente };
  };

  it("exige el encabezado X-Empleado-Id (401)", () => {
    const { error, siguiente } = pedir({});
    assert.equal(error.estado, 401);
    assert.equal(siguiente, false);
    assert.equal(pedir({ "X-Empleado-Id": "   " }).error.estado, 401);
  });

  it("rechaza un identificador que no es un UUID (403)", () => {
    assert.equal(pedir({ "X-Empleado-Id": "abc" }).error.estado, 403);
  });

  it("deja en la petición el empleado normalizado a minúsculas", () => {
    const { req, error, siguiente } = pedir({
      "X-Empleado-Id": `  ${EVALUADOR.toUpperCase()} `,
    });
    assert.equal(error, null);
    assert.ok(siguiente);
    assert.equal(req.idEmpleado, EVALUADOR);
  });
});

describe("RF-04 criterio 1: servicio de la bandeja (modelo simulado)", () => {
  const fila = (cambios = {}) => ({
    id_evaluacion: ayudas.ID_EVALUACION,
    id_empleado_evaluado: ayudas.uuid("4", 31),
    nombres: "Carlos",
    apellidos: "Rojas Vargas",
    sucursal: "Sopocachi",
    id_ciclo: CICLO,
    ciclo: "Evaluación de desempeño 2030-S2",
    fecha_limite: "2030-12-31",
    estado_codigo: "BORRADOR",
    estado_nombre: "Borrador",
    puntaje_final: null,
    enviada_en: null,
    actualizado_en: "2030-12-01T10:00:00.000Z",
    total: 6,
    respondidas: 3,
    obligatorias_total: 5,
    obligatorias_respondidas: 2,
    ...cambios,
  });

  beforeEach(() => mock.restoreAll());

  it("muestra colaborador, ciclo y fecha límite de cada evaluación asignada, con su avance", async () => {
    mock.method(modelo, "listarBandeja", async () => [fila()]);
    const [evaluacion] = await servicio.listarEvaluaciones(EVALUADOR, {});

    assert.equal(evaluacion.id_evaluacion, ayudas.ID_EVALUACION);
    assert.equal(evaluacion.colaborador.nombre_completo, "Carlos Rojas Vargas");
    assert.equal(evaluacion.colaborador.sucursal, "Sopocachi");
    assert.deepEqual(evaluacion.ciclo, {
      id_ciclo: CICLO,
      nombre: "Evaluación de desempeño 2030-S2",
      fecha_limite: "2030-12-31",
    });
    assert.equal(evaluacion.estado_codigo, "BORRADOR");
    assert.deepEqual(evaluacion.progreso, {
      total: 6,
      respondidas: 3,
      obligatorias_total: 5,
      obligatorias_respondidas: 2,
    });
  });

  it("consulta solo las evaluaciones del evaluador identificado y pasa los filtros ya validados", async () => {
    mock.method(modelo, "listarBandeja", async () => []);
    await servicio.listarEvaluaciones(EVALUADOR, {
      id_ciclo: CICLO,
      estado: "pendiente,borrador",
    });

    assert.equal(modelo.listarBandeja.mock.callCount(), 1);
    assert.deepEqual(modelo.listarBandeja.mock.calls[0].arguments[0], {
      idEvaluador: EVALUADOR,
      idCiclo: CICLO,
      estados: [ESTADO_EVALUACION.PENDIENTE, ESTADO_EVALUACION.BORRADOR],
    });
  });

  it("un filtro inválido responde 400 sin consultar la base", async () => {
    mock.method(modelo, "listarBandeja", async () => []);
    await assert.rejects(
      servicio.listarEvaluaciones(EVALUADOR, { estado: "XYZ" }),
      { estado: 400 },
    );
    assert.equal(modelo.listarBandeja.mock.callCount(), 0);
  });

  it("sin evaluaciones asignadas devuelve una lista vacía", async () => {
    mock.method(modelo, "listarBandeja", async () => []);
    assert.deepEqual(await servicio.listarEvaluaciones(EVALUADOR, {}), []);
  });

  it("los ciclos del filtro son los del evaluador", async () => {
    mock.method(modelo, "listarCiclos", async (idEvaluador) => [
      { id_ciclo: CICLO, nombre: "Ciclo", idEvaluador },
    ]);
    const ciclos = await servicio.listarCiclos(EVALUADOR);
    assert.equal(ciclos[0].idEvaluador, EVALUADOR);
  });
});

describe("RF-04: consultas del modelo (pool simulado)", () => {
  beforeEach(() => {
    mock.restoreAll();
    consultas.length = 0;
    respuestas = [];
  });

  it("la bandeja solo trae las evaluaciones del evaluador y deja fuera los ciclos que aún no empiezan", async () => {
    await modelo.listarBandeja({
      idEvaluador: EVALUADOR,
      idCiclo: null,
      estados: null,
    });
    const { sql, valores } = consultas[0];

    assert.deepEqual(valores, [EVALUADOR, null, null]);
    assert.match(sql, /e\.id_empleado_evaluador = \$1/);
    assert.match(sql, /c\.id_estado_ciclo <> 1/);
    assert.match(sql, /\(\$2::uuid IS NULL OR c\.id_ciclo = \$2\)/);
    assert.match(sql, /\$3::smallint\[\] IS NULL OR b\.id_estado = ANY\(\$3\)/);
  });

  it("filtra por ciclo y por estado con parámetros, no concatenando texto", async () => {
    await modelo.listarBandeja({
      idEvaluador: EVALUADOR,
      idCiclo: CICLO,
      estados: [1, 2],
    });
    assert.deepEqual(consultas[0].valores, [EVALUADOR, CICLO, [1, 2]]);
    assert.doesNotMatch(consultas[0].sql, new RegExp(CICLO));
  });

  it("el estado efectivo se calcula en SQL con la fecha de Bolivia y el cierre del ciclo", async () => {
    await modelo.listarBandeja({
      idEvaluador: EVALUADOR,
      idCiclo: null,
      estados: null,
    });
    const sql = consultas[0].sql;
    assert.match(
      sql,
      /IN \(1, 2\)\s+AND \(c\.fecha_limite < \(CURRENT_TIMESTAMP AT TIME ZONE 'America\/La_Paz'\)::date OR c\.id_estado_ciclo = 3\)/,
    );
    assert.match(sql, /THEN 4/);
  });

  it("ordena por fecha límite para que lo más urgente salga primero", async () => {
    await modelo.listarBandeja({
      idEvaluador: EVALUADOR,
      idCiclo: null,
      estados: null,
    });
    assert.match(
      consultas[0].sql,
      /ORDER BY b\.fecha_limite, b\.apellidos, b\.nombres/,
    );
  });

  it("los ciclos del filtro excluyen los que no han empezado", async () => {
    await modelo.listarCiclos(EVALUADOR);
    assert.deepEqual(consultas[0].valores, [EVALUADOR]);
    assert.match(consultas[0].sql, /c\.id_estado_ciclo <> 1/);
  });

  it("leer la evaluación para escribir toma la fila con FOR UPDATE; leerla para mostrar, no", async () => {
    respuestas = [
      { rows: [{ id_evaluacion: ayudas.ID_EVALUACION }] },
      { rows: [] },
    ];
    await modelo.obtenerEvaluacion(ayudas.ID_EVALUACION, { bloquear: true });
    await modelo.obtenerEvaluacion(ayudas.ID_EVALUACION);
    assert.match(consultas[0].sql, /FOR UPDATE OF e/);
    assert.doesNotMatch(consultas[1].sql, /FOR UPDATE/);
  });

  it("el guardado usa una sola sentencia que inserta o reemplaza la respuesta de cada pregunta", async () => {
    await modelo.guardarRespuestas(ayudas.ID_EVALUACION, [
      { idPregunta: ayudas.idPregunta(1), idNivel: ayudas.nivelDe(1, 5) },
      { idPregunta: ayudas.idPregunta(2), idNivel: ayudas.nivelDe(2, 4) },
    ]);
    assert.equal(consultas.length, 1);
    assert.match(
      consultas[0].sql,
      /ON CONFLICT ON CONSTRAINT uq_respuesta_evaluacion_pregunta\s+DO UPDATE SET id_nivel = EXCLUDED\.id_nivel/,
    );
    assert.deepEqual(consultas[0].valores, [
      ayudas.ID_EVALUACION,
      [ayudas.idPregunta(1), ayudas.idPregunta(2)],
      [ayudas.nivelDe(1, 5), ayudas.nivelDe(2, 4)],
    ]);
  });

  it("sin respuestas que guardar o borrar no consulta nada", async () => {
    await modelo.guardarRespuestas(ayudas.ID_EVALUACION, []);
    await modelo.borrarRespuestas(ayudas.ID_EVALUACION, []);
    assert.equal(consultas.length, 0);
  });

  it("solo se cambia el estado de una evaluación abierta: una enviada nunca vuelve atrás", async () => {
    await modelo.cambiarEstadoAbierta(
      ayudas.ID_EVALUACION,
      ESTADO_EVALUACION.BORRADOR,
    );
    assert.match(
      consultas[0].sql,
      /WHERE id_evaluacion = \$1 AND id_estado_evaluacion IN \(1, 2\)/,
    );
    assert.deepEqual(consultas[0].valores, [
      ayudas.ID_EVALUACION,
      ESTADO_EVALUACION.BORRADOR,
    ]);
  });

  it("criterio 3: marcar como enviada congela el puntaje y solo funciona si seguía abierta", async () => {
    respuestas = [
      { rows: [{ enviada_en: "2030-12-01T10:30:00.000Z" }] },
      { rows: [] },
    ];
    const primera = await modelo.marcarEnviada(ayudas.ID_EVALUACION, 85.56);
    const segunda = await modelo.marcarEnviada(ayudas.ID_EVALUACION, 10);

    assert.match(
      consultas[0].sql,
      /id_estado_evaluacion = 3, puntaje_final = \$2/,
    );
    assert.match(
      consultas[0].sql,
      /WHERE id_evaluacion = \$1 AND id_estado_evaluacion IN \(1, 2\)/,
    );
    assert.deepEqual(consultas[0].valores, [ayudas.ID_EVALUACION, 85.56]);
    assert.equal(primera, "2030-12-01T10:30:00.000Z");
    assert.equal(
      segunda,
      null,
      "una evaluación que ya no está abierta no se vuelve a enviar",
    );
  });
});

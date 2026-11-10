const { describe, it, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const desempenoModelo = require("../models/desempenoModel");
const mensajesModelo = require("../models/mensajesEntrantesModel");
const servicio = require("../services/desempenoService");
const ayudas = require("./ayudas/consolidadoDesempeno");

const {
  AREA,
  SUCURSAL,
  EMPLEADO,
  CICLO_CERRADO,
  EVALUACION,
  simular,
  baseFalsa,
  ciclo,
} = ayudas;

afterEach(() => mock.restoreAll());

const nombresYPuntajes = (grupos) => grupos.map((g) => [g.nombre, g.puntaje]);

describe("Consolidado de un ciclo cerrado", () => {
  describe("promedios por departamento, sucursal y competencia", () => {
    it("el promedio global cuenta una vez a cada colaborador, aunque tenga varios evaluadores", async () => {
      simular();
      const { resumen } = await servicio.obtenerConsolidado(CICLO_CERRADO);

      // A: (87,78 + 85,56) / 2 = 86,67; B 85,56; C 36,67 → (86,67 + 85,56 + 36,67) / 3. Si A pesara doble sería 76,51.
      assert.equal(resumen.promedio_global, 69.63);
      assert.equal(resumen.evaluaciones_enviadas, 4);
    });

    it("promedia por área, de la más baja a la más alta, con la diferencia respecto del promedio global", async () => {
      simular();
      const { departamentos } =
        await servicio.obtenerConsolidado(CICLO_CERRADO);

      assert.deepEqual(nombresYPuntajes(departamentos), [
        ["Recursos Humanos", 36.67],
        ["Atención al cliente", 86.12],
      ]);
      assert.deepEqual(
        departamentos.map((g) => g.diferencia_global),
        [-32.96, 16.49],
      );
    });

    it("cuenta a los evaluados y a los asignados de cada área", async () => {
      simular();
      const { departamentos } =
        await servicio.obtenerConsolidado(CICLO_CERRADO);
      const atencion = departamentos.find((g) => g.id === AREA.ATENCION);

      assert.equal(atencion.asignados, 3, "A, B y D");
      assert.equal(
        atencion.evaluados,
        2,
        "D solo tiene una evaluación vencida",
      );
      assert.equal(
        atencion.evaluaciones_enviadas,
        3,
        "A aporta dos evaluaciones enviadas",
      );
      assert.equal(atencion.evaluaciones_vencidas, 1);
    });

    it("promedia por sucursal con el área y la sucursal que el evaluado tenía en el ciclo", async () => {
      simular();
      const { sucursales } = await servicio.obtenerConsolidado(CICLO_CERRADO);

      // Sopocachi: A (86,67) y C (36,67); Miraflores: B (85,56) y D sin puntaje.
      assert.deepEqual(nombresYPuntajes(sucursales), [
        ["Sopocachi", 61.67],
        ["Miraflores", 85.56],
      ]);
    });

    it("promedia por competencia con el mismo cálculo del evaluador, de la más baja a la más alta", async () => {
      simular();
      const { competencias } = await servicio.obtenerConsolidado(CICLO_CERRADO);

      assert.deepEqual(
        competencias.map((c) => [c.competencia, c.puntaje]),
        [
          // Atención: A 85, B 82, C 40. Trabajo en equipo: A 90, B 80, C 40. Puntualidad: A 87,5, B 100, C 25.
          ["Atención al cliente", 69],
          ["Trabajo en equipo", 70],
          ["Puntualidad y orden", 70.83],
        ],
      );
    });

    it("cada área trae sus competencias y la más baja", async () => {
      simular();
      const { departamentos } =
        await servicio.obtenerConsolidado(CICLO_CERRADO);
      const [rrhh, atencion] = departamentos;

      assert.deepEqual(rrhh.competencia_mas_baja, {
        id_competencia: ayudas.uuid("3", 3),
        competencia: "Puntualidad y orden",
        puntaje: 25,
        es_brecha: true,
      });
      assert.deepEqual(
        atencion.competencias.map((c) => [c.competencia, c.puntaje]),
        [
          ["Atención al cliente", 83.5],
          ["Trabajo en equipo", 85],
          ["Puntualidad y orden", 93.75],
        ],
      );
      assert.equal(
        atencion.competencia_mas_baja.competencia,
        "Atención al cliente",
      );
    });

    it("informa la cobertura: cuántos de los asignados tienen al menos una evaluación enviada", async () => {
      simular();
      const { resumen } = await servicio.obtenerConsolidado(CICLO_CERRADO);

      assert.equal(resumen.asignados, 4);
      assert.equal(resumen.evaluados, 3);
      assert.equal(resumen.cobertura_porcentual, 75);
      assert.equal(resumen.evaluaciones_vencidas, 1);
    });
  });

  describe("solo cuentan las evaluaciones enviadas", () => {
    it("una evaluación vencida no entra en ningún promedio ni se pide a la estructura del formulario", async () => {
      const pedido = simular();
      const { departamentos, sucursales } =
        await servicio.obtenerConsolidado(CICLO_CERRADO);

      assert.ok(!pedido.idsEstructura.includes(EVALUACION.D), "D está vencida");
      assert.deepEqual(
        [...pedido.idsEstructura].sort(),
        [EVALUACION.A1, EVALUACION.A2, EVALUACION.B, EVALUACION.C].sort(),
      );
      assert.equal(
        departamentos.find((g) => g.id === AREA.ATENCION).puntaje,
        86.12,
        "con D en cero sería 57,41",
      );
      assert.equal(
        sucursales.find((g) => g.id === SUCURSAL.MIRAFLORES).puntaje,
        85.56,
      );
    });

    it("un ciclo sin evaluaciones enviadas no inventa promedios", async () => {
      simular({
        evaluaciones: [ayudas.EVALUACIONES[4]],
        metricas: [],
        solicitud: null,
      });
      const consolidado = await servicio.obtenerConsolidado(CICLO_CERRADO);

      assert.equal(consolidado.resumen.promedio_global, null);
      assert.equal(consolidado.resumen.evaluados, 0);
      assert.equal(consolidado.resumen.cobertura_porcentual, 0);
      assert.deepEqual(consolidado.competencias, []);
      assert.equal(consolidado.departamentos[0].sin_datos, true);
      assert.equal(consolidado.departamentos[0].puntaje, null);
    });

    it("un ciclo sin evaluaciones tampoco rompe el consolidado", async () => {
      simular({ evaluaciones: [], metricas: [], solicitud: null });
      const consolidado = await servicio.obtenerConsolidado(CICLO_CERRADO);

      assert.equal(consolidado.resumen.asignados, 0);
      assert.equal(consolidado.resumen.cobertura_porcentual, null);
      assert.deepEqual(consolidado.departamentos, []);
    });
  });

  describe("el consolidado se genera solo cuando el ciclo ya cerró", () => {
    it("un ciclo activo responde 409: otro evaluador todavía puede enviar y los promedios cambiarían", async () => {
      simular({
        cicloCerrado: ciclo({ id_estado_ciclo: 2, cerrado_en: null }),
      });
      await assert.rejects(
        servicio.obtenerConsolidado(CICLO_CERRADO),
        (e) => e.estado === 409 && /aún no está cerrado/.test(e.message),
      );
    });

    it("un ciclo programado también responde 409", async () => {
      simular({
        cicloCerrado: ciclo({ id_estado_ciclo: 1, cerrado_en: null }),
      });
      await assert.rejects(
        servicio.obtenerConsolidado(CICLO_CERRADO),
        (e) => e.estado === 409,
      );
    });

    it("un ciclo inexistente responde 404", async () => {
      simular();
      await assert.rejects(
        servicio.obtenerConsolidado(ayudas.uuid("1", 99)),
        (e) => e.estado === 404,
      );
    });

    it("un identificador inválido responde 404 sin consultar la base", async () => {
      const pedido = simular();
      await assert.rejects(
        servicio.obtenerConsolidado("no-es-un-uuid"),
        (e) => e.estado === 404,
      );
      assert.deepEqual(pedido.consultasCiclo, []);
    });

    it("acepta el identificador en mayúsculas", async () => {
      simular();
      const { ciclo: describido } = await servicio.obtenerConsolidado(
        CICLO_CERRADO.toUpperCase(),
      );
      assert.equal(describido.id_ciclo, CICLO_CERRADO);
    });

    it("lista solo ciclos cerrados con cuántas evaluaciones se enviaron y cuántas vencieron", async () => {
      mock.method(desempenoModelo, "listarCiclosCerrados", async () => [
        {
          id_ciclo: CICLO_CERRADO,
          nombre: "Evaluación de desempeño 2026-S1",
          fecha_inicio: "2026-06-01",
          fecha_limite: "2026-07-03",
          cerrado_en: "2026-07-05T12:00:00.000Z",
          umbral_brecha: 60,
          id_periodo: ayudas.uuid("6", 1),
          periodo: "2026-S1",
          evaluaciones: 5,
          enviadas: 4,
          vencidas: 1,
        },
      ]);
      const [primero] = await servicio.listarCiclos();

      assert.deepEqual(primero.periodo, {
        id_periodo: ayudas.uuid("6", 1),
        nombre: "2026-S1",
      });
      assert.deepEqual(primero.evaluaciones, {
        total: 5,
        enviadas: 4,
        vencidas: 1,
      });
      assert.equal(primero.umbral_brecha, 60);
    });
  });

  describe("Lo que falla en el CRM no bloquea el consolidado", () => {
    it("no consulta los mensajes del CRM: aunque la cola de errores tenga mensajes, el consolidado responde", async () => {
      simular();
      const mensajes = mock.method(mensajesModelo, "listar", async () => {
        throw new Error("no debería consultarse");
      });
      const consolidado = await servicio.obtenerConsolidado(CICLO_CERRADO);

      assert.equal(mensajes.mock.callCount(), 0);
      assert.equal(consolidado.resumen.promedio_global, 69.63);
    });

    it("sin métricas del CRM igual hay consolidado, con las métricas en cero", async () => {
      simular({ metricas: [], solicitud: null });
      const { crm, resumen } = await servicio.obtenerConsolidado(CICLO_CERRADO);

      assert.equal(resumen.promedio_global, 69.63);
      assert.deepEqual(crm, {
        solicitud: null,
        metricas_recibidas: 0,
        colaboradores_con_metricas: 0,
        cantidad_quejas: 0,
        cantidad_felicitaciones: 0,
        minutos_resolucion_promedio: null,
      });
    });
  });
});

describe("Las métricas del CRM como indicador objetivo", () => {
  it("resume en el consolidado las métricas recibidas y el estado de la solicitud", async () => {
    simular();
    const { crm } = await servicio.obtenerConsolidado(CICLO_CERRADO);

    assert.deepEqual(crm.solicitud, {
      id_mensaje: ayudas.SOLICITUD.id_evento,
      estado: "ENTREGADO",
      intentos: 1,
      ultimo_error: null,
      entregado_en: "2026-07-05T12:05:00.000Z",
      creado_en: "2026-07-05T12:00:00.000Z",
    });
    assert.equal(crm.metricas_recibidas, 2);
    assert.equal(crm.colaboradores_con_metricas, 2);
    assert.equal(crm.cantidad_quejas, 10);
    assert.equal(crm.cantidad_felicitaciones, 3);
    assert.equal(crm.minutos_resolucion_promedio, 30.5);
  });

  it("suma las métricas de cada área y sucursal con las de sus colaboradores", async () => {
    simular();
    const { departamentos, sucursales } =
      await servicio.obtenerConsolidado(CICLO_CERRADO);

    const atencion = departamentos.find((g) => g.id === AREA.ATENCION);
    assert.deepEqual(atencion.crm, {
      colaboradores_con_metricas: 2,
      cantidad_quejas: 10,
      cantidad_felicitaciones: 3,
      minutos_resolucion_promedio: 30.5,
    });
    assert.equal(
      departamentos.find((g) => g.id === AREA.RRHH).crm
        .colaboradores_con_metricas,
      0,
      "RRHH no es medida por el CRM",
    );
    assert.equal(
      sucursales.find((g) => g.id === SUCURSAL.MIRAFLORES).crm.cantidad_quejas,
      9,
      "solo B tiene métricas en Miraflores",
    );
    assert.equal(
      sucursales.find((g) => g.id === SUCURSAL.SOPOCACHI).crm.cantidad_quejas,
      1,
    );
  });

  it("promedia los minutos de resolución solo de quienes tuvieron casos", async () => {
    simular({
      metricas: [
        {
          id_empleado: EMPLEADO.A,
          cantidad_quejas: 0,
          cantidad_felicitaciones: 5,
          minutos_resolucion_promedio: null,
        },
        {
          id_empleado: EMPLEADO.B,
          cantidad_quejas: 2,
          cantidad_felicitaciones: 0,
          minutos_resolucion_promedio: 40,
        },
      ],
    });
    const { crm } = await servicio.obtenerConsolidado(CICLO_CERRADO);

    assert.equal(
      crm.minutos_resolucion_promedio,
      40,
      "A no tuvo casos y no baja el promedio",
    );
    assert.equal(crm.cantidad_felicitaciones, 5);
  });

  describe("colaboradores del ciclo", () => {
    it("asocia las métricas a cada colaborador y deja en null a quien no las tiene", async () => {
      simular();
      const { colaboradores } =
        await servicio.obtenerColaboradores(CICLO_CERRADO);
      const porId = Object.fromEntries(
        colaboradores.map((c) => [c.id_empleado, c]),
      );

      assert.deepEqual(porId[EMPLEADO.A].crm, {
        cantidad_quejas: 1,
        cantidad_felicitaciones: 2,
        minutos_resolucion_promedio: 12.5,
      });
      assert.deepEqual(porId[EMPLEADO.B].crm, {
        cantidad_quejas: 9,
        cantidad_felicitaciones: 1,
        minutos_resolucion_promedio: 48.5,
      });
      assert.equal(porId[EMPLEADO.C].crm, null);
      assert.equal(porId[EMPLEADO.D].crm, null);
    });

    it("trae el puntaje de cada uno y su desglose por competencia", async () => {
      simular();
      const { colaboradores } =
        await servicio.obtenerColaboradores(CICLO_CERRADO);
      const a = colaboradores.find((c) => c.id_empleado === EMPLEADO.A);

      assert.equal(a.nombre_completo, "Carlos Rojas");
      assert.equal(a.puntaje, 86.67);
      assert.equal(a.evaluaciones_enviadas, 2);
      assert.deepEqual(
        a.competencias.map((c) => [c.competencia, c.puntaje]),
        [
          ["Atención al cliente", 85],
          ["Trabajo en equipo", 90],
          ["Puntualidad y orden", 87.5],
        ],
      );
    });

    it("ordena del menor puntaje al mayor y deja al final a quien no tiene puntaje", async () => {
      simular();
      const { colaboradores } =
        await servicio.obtenerColaboradores(CICLO_CERRADO);

      assert.deepEqual(
        colaboradores.map((c) => [c.nombre_completo, c.puntaje]),
        [
          ["Sofía Condori", 36.67],
          ["Lucía Flores", 85.56],
          ["Carlos Rojas", 86.67],
          ["Diego Quispe", null],
        ],
      );
      assert.equal(colaboradores.at(-1).evaluaciones_vencidas, 1);
    });

    it("marca a quien queda bajo el umbral del ciclo", async () => {
      simular();
      const { colaboradores } =
        await servicio.obtenerColaboradores(CICLO_CERRADO);

      assert.deepEqual(
        colaboradores.map((c) => [c.nombre_completo, c.bajo_umbral]),
        [
          ["Sofía Condori", true],
          ["Lucía Flores", false],
          ["Carlos Rojas", false],
          ["Diego Quispe", false],
        ],
      );
    });

    it("filtra por área, por sucursal y por ambos", async () => {
      simular();
      const nombres = async (filtros) =>
        (
          await servicio.obtenerColaboradores(CICLO_CERRADO, filtros)
        ).colaboradores
          .map((c) => c.nombre_completo)
          .sort();

      assert.deepEqual(await nombres({ departamento: AREA.RRHH }), [
        "Sofía Condori",
      ]);
      assert.deepEqual(await nombres({ sucursal: SUCURSAL.MIRAFLORES }), [
        "Diego Quispe",
        "Lucía Flores",
      ]);
      assert.deepEqual(
        await nombres({
          departamento: AREA.ATENCION,
          sucursal: SUCURSAL.SOPOCACHI,
        }),
        ["Carlos Rojas"],
      );
      assert.deepEqual(
        await nombres({
          departamento: AREA.RRHH,
          sucursal: SUCURSAL.MIRAFLORES,
        }),
        [],
      );
    });

    it("rechaza un filtro que no es un identificador válido", async () => {
      simular();
      await assert.rejects(
        servicio.obtenerColaboradores(CICLO_CERRADO, { sucursal: "x" }),
        (e) => e.estado === 400,
      );
    });
  });
});

describe("consultas SQL del consolidado", () => {
  it("lista solo ciclos CERRADOS y cuenta las evaluaciones enviadas y vencidas", async () => {
    const { db, consultas } = baseFalsa();
    await desempenoModelo.listarCiclosCerrados(db);

    assert.match(consultas[0].sql, /WHERE c\.id_estado_ciclo = 3/);
    assert.match(
      consultas[0].sql,
      /FILTER \(WHERE e\.id_estado_evaluacion = 3\)/,
    );
    assert.match(
      consultas[0].sql,
      /FILTER \(WHERE e\.id_estado_evaluacion = 4\)/,
    );
  });

  it("toma el área y la sucursal de la EVALUACIÓN, no las actuales del empleado", async () => {
    const { db, consultas } = baseFalsa();
    await desempenoModelo.listarEvaluacionesDelCiclo(CICLO_CERRADO, db);

    assert.match(
      consultas[0].sql,
      /JOIN departamentos d ON d\.id_departamento = e\.id_departamento/,
    );
    assert.match(
      consultas[0].sql,
      /JOIN sucursales s ON s\.id_sucursal = e\.id_sucursal/,
    );
    assert.match(consultas[0].sql, /WHERE e\.id_ciclo = \$1/);
    assert.deepEqual(consultas[0].parametros, [CICLO_CERRADO]);
  });

  it("busca la solicitud de métricas del ciclo por destino CRM y tipo de evento", async () => {
    const { db, consultas } = baseFalsa();
    await desempenoModelo.obtenerSolicitudCrm(CICLO_CERRADO, db);

    assert.match(consultas[0].sql, /ev\.id_modulo_destino = 1/);
    assert.match(consultas[0].sql, /ev\.tipo_evento = \$2/);
    assert.deepEqual(consultas[0].parametros, [
      CICLO_CERRADO,
      "SOLICITUD_METRICAS_CRM",
    ]);
  });
});

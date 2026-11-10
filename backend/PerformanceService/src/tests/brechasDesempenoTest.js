const { describe, it, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const desempenoModelo = require("../models/desempenoModel");
const servicio = require("../services/desempenoService");
const { ErrorApp } = require("../utils/errores");
const { esBrecha, diferencia } = require("../utils/desempeno");
const rutas = require("../routes/desempenoRoutes");
const ayudas = require("./ayudas/consolidadoDesempeno");

const {
  AREA,
  SUCURSAL,
  EMPLEADO,
  CICLO_CERRADO,
  EVALUACIONES,
  simular,
  baseFalsa,
  ciclo,
} = ayudas;

afterEach(() => mock.restoreAll());

const comparar = (umbral, por) => {
  simular({ cicloCerrado: ciclo({ umbral_brecha: umbral }) });
  return servicio.obtenerComparativa(CICLO_CERRADO, { por });
};
const enBrecha = (grupos) =>
  grupos.filter((g) => g.es_brecha).map((g) => g.nombre);

describe("Un área bajo el umbral se resalta como brecha de productividad", () => {
  describe("la regla de brecha", () => {
    for (const [promedio, umbral, esperado, caso] of [
      [59.99, 60, true, "un centésimo bajo el umbral es brecha"],
      [60, 60, false, "igual al umbral no es brecha"],
      [60.01, 60, false, "sobre el umbral no es brecha"],
      [0, 0, false, "umbral 0: nada puede quedar por debajo"],
      [0, 0.01, true, "umbral mínimo: un promedio de 0 sí es brecha"],
      [100, 100, false, "umbral 100 y promedio 100"],
      [99.99, 100, true, "umbral 100: cualquier otro promedio es brecha"],
      [
        0.1 + 0.2,
        0.3,
        false,
        "los errores de coma flotante no inventan brechas",
      ],
      [null, 60, false, "sin promedio no se puede juzgar"],
    ]) {
      it(caso, () => assert.equal(esBrecha(promedio, umbral), esperado));
    }

    it("la diferencia se calcula en centésimas", () => {
      assert.equal(diferencia(60, 59.99), 0.01);
      assert.equal(diferencia(0.3, 0.1 + 0.2), 0);
      assert.equal(diferencia(null, 60), null);
      assert.equal(diferencia(60, null), null);
    });
  });

  describe("comparativa entre departamentos", () => {
    it("resalta el área bajo el umbral y dice cuántos puntos le faltan", async () => {
      simular();
      const comparativa = await servicio.obtenerComparativa(CICLO_CERRADO);

      assert.equal(comparativa.por, "departamento", "sin ?por= compara áreas");
      assert.equal(comparativa.umbral_brecha, 60);
      assert.equal(comparativa.promedio_global, 69.63);
      assert.deepEqual(comparativa.brechas, [
        {
          id: AREA.RRHH,
          nombre: "Recursos Humanos",
          puntaje: 36.67,
          puntos_bajo_umbral: 23.33,
        },
      ]);

      const [rrhh, atencion] = comparativa.grupos;
      assert.equal(rrhh.es_brecha, true);
      assert.equal(rrhh.puntos_bajo_umbral, 23.33);
      assert.equal(atencion.es_brecha, false);
      assert.equal(
        atencion.puntos_bajo_umbral,
        0,
        "quien no es brecha no debe puntos",
      );
    });

    it("lista primero el área más baja", async () => {
      const { grupos } = await comparar(60);
      assert.deepEqual(
        grupos.map((g) => g.nombre),
        ["Recursos Humanos", "Atención al cliente"],
      );
    });

    it("el umbral decide: con umbral 90 las dos áreas son brecha", async () => {
      const { grupos, brechas } = await comparar(90);

      assert.deepEqual(enBrecha(grupos), [
        "Recursos Humanos",
        "Atención al cliente",
      ]);
      assert.deepEqual(
        brechas.map((b) => [b.nombre, b.puntos_bajo_umbral]),
        [
          ["Recursos Humanos", 53.33],
          ["Atención al cliente", 3.88],
        ],
      );
    });

    it("con umbral 0 ninguna área es brecha", async () => {
      assert.deepEqual((await comparar(0)).brechas, []);
    });

    it("el consolidado cuenta las áreas y sucursales en brecha según el umbral del ciclo", async () => {
      simular({ cicloCerrado: ciclo({ umbral_brecha: 62 }) });
      const { resumen } = await servicio.obtenerConsolidado(CICLO_CERRADO);

      assert.equal(resumen.departamentos_en_brecha, 1);
      assert.equal(
        resumen.sucursales_en_brecha,
        1,
        "Sopocachi 61,67 queda bajo 62",
      );
    });
  });

  describe("comparativa entre sucursales", () => {
    it("compara sucursales con la misma regla", async () => {
      const comparativa = await comparar(62, "sucursal");

      assert.equal(comparativa.por, "sucursal");
      assert.deepEqual(comparativa.brechas, [
        {
          id: SUCURSAL.SOPOCACHI,
          nombre: "Sopocachi",
          puntaje: 61.67,
          puntos_bajo_umbral: 0.33,
        },
      ]);
    });

    it("un promedio exactamente igual al umbral no es brecha", async () => {
      const { grupos, brechas } = await comparar(61.67, "sucursal");

      assert.equal(
        grupos.find((g) => g.id === SUCURSAL.SOPOCACHI).puntaje,
        61.67,
      );
      assert.deepEqual(brechas, []);
    });

    it("rechaza una agrupación desconocida", async () => {
      simular();
      await assert.rejects(
        servicio.obtenerComparativa(CICLO_CERRADO, { por: "region" }),
        (e) => e.estado === 400 && e.detalles[0].campo === "por",
      );
    });

    it("la comparativa también exige un ciclo cerrado", async () => {
      simular({ cicloCerrado: ciclo({ id_estado_ciclo: 2 }) });
      await assert.rejects(
        servicio.obtenerComparativa(CICLO_CERRADO),
        (e) => e.estado === 409,
      );
    });
  });

  describe("grupos sin evaluaciones enviadas", () => {
    it("un área cuyas evaluaciones vencieron queda «sin datos» y no se marca como brecha", async () => {
      const soloVencida = EVALUACIONES.filter(
        (e) => e.id_empleado === EMPLEADO.D || e.id_empleado === EMPLEADO.A,
      );
      simular({
        evaluaciones: [
          ...soloVencida,
          {
            ...ayudas.fila(
              ayudas.uuid("f", 9),
              EMPLEADO.C,
              "Sofía",
              "Condori",
              AREA.RRHH,
              SUCURSAL.SOPOCACHI,
              ayudas.VENCIDA,
              null,
            ),
          },
        ],
      });
      const { grupos, brechas } =
        await servicio.obtenerComparativa(CICLO_CERRADO);

      const rrhh = grupos.find((g) => g.id === AREA.RRHH);
      assert.equal(rrhh.sin_datos, true);
      assert.equal(rrhh.puntaje, null);
      assert.equal(rrhh.es_brecha, false);
      assert.equal(rrhh.diferencia_global, null);
      assert.equal(rrhh.puntos_bajo_umbral, 0);
      assert.equal(rrhh.competencia_mas_baja, null);
      assert.deepEqual(brechas, []);
      assert.equal(
        grupos.at(-1).id,
        AREA.RRHH,
        "los grupos sin datos van al final",
      );
    });
  });

  describe("competencias y colaboradores bajo el umbral", () => {
    it("aplica el mismo umbral a cada competencia", async () => {
      simular({ cicloCerrado: ciclo({ umbral_brecha: 70 }) });
      const { competencias } = await servicio.obtenerConsolidado(CICLO_CERRADO);

      assert.deepEqual(
        competencias.map((c) => [c.competencia, c.puntaje, c.es_brecha]),
        [
          ["Atención al cliente", 69, true],
          ["Trabajo en equipo", 70, false],
          ["Puntualidad y orden", 70.83, false],
        ],
      );
    });

    it("marca por competencia a cada área (de la más baja a la más alta): RRHH queda bajo 60 en todas", async () => {
      simular();
      const { departamentos } =
        await servicio.obtenerConsolidado(CICLO_CERRADO);
      const rrhh = departamentos.find((g) => g.id === AREA.RRHH);

      assert.deepEqual(
        rrhh.competencias.map((c) => [c.puntaje, c.es_brecha]),
        [
          [25, true],
          [40, true],
          [40, true],
        ],
      );
      assert.ok(
        departamentos
          .find((g) => g.id === AREA.ATENCION)
          .competencias.every((c) => !c.es_brecha),
      );
    });
  });
});

describe("umbral de brecha del ciclo", () => {
  describe("cambio del umbral", () => {
    it("guarda el umbral y devuelve el ciclo con el nuevo valor", async () => {
      const actualizar = mock.method(
        desempenoModelo,
        "actualizarUmbral",
        async (idCiclo, umbral) => ({
          id_ciclo: idCiclo,
          umbral_brecha: umbral,
        }),
      );
      const resultado = await servicio.actualizarUmbral(CICLO_CERRADO, {
        umbral_brecha: 72.5,
      });

      assert.deepEqual(resultado, {
        id_ciclo: CICLO_CERRADO,
        umbral_brecha: 72.5,
      });
      assert.deepEqual(actualizar.mock.calls[0].arguments, [
        CICLO_CERRADO,
        72.5,
      ]);
    });

    it("acepta los extremos 0 y 100", async () => {
      mock.method(
        desempenoModelo,
        "actualizarUmbral",
        async (idCiclo, umbral) => ({
          id_ciclo: idCiclo,
          umbral_brecha: umbral,
        }),
      );

      assert.equal(
        (await servicio.actualizarUmbral(CICLO_CERRADO, { umbral_brecha: 0 }))
          .umbral_brecha,
        0,
      );
      assert.equal(
        (await servicio.actualizarUmbral(CICLO_CERRADO, { umbral_brecha: 100 }))
          .umbral_brecha,
        100,
      );
    });

    for (const [valor, caso] of [
      [-0.01, "negativo"],
      [100.01, "mayor que 100"],
      [60.123, "con más de 2 decimales"],
      ["60", "texto en vez de número"],
      [null, "nulo"],
      [Number.NaN, "NaN"],
      [Number.POSITIVE_INFINITY, "infinito"],
      [undefined, "ausente"],
    ]) {
      it(`rechaza un umbral ${caso} sin tocar la base`, async () => {
        const actualizar = mock.method(
          desempenoModelo,
          "actualizarUmbral",
          async () => ({}),
        );
        await assert.rejects(
          servicio.actualizarUmbral(CICLO_CERRADO, { umbral_brecha: valor }),
          (e) => {
            return (
              e instanceof ErrorApp &&
              e.estado === 400 &&
              e.detalles[0].campo === "umbral_brecha"
            );
          },
        );
        assert.equal(actualizar.mock.callCount(), 0);
      });
    }

    it("rechaza un cuerpo vacío o ausente", async () => {
      const actualizar = mock.method(
        desempenoModelo,
        "actualizarUmbral",
        async () => ({}),
      );
      await assert.rejects(
        servicio.actualizarUmbral(CICLO_CERRADO, undefined),
        (e) => e.estado === 400,
      );
      await assert.rejects(
        servicio.actualizarUmbral(CICLO_CERRADO, {}),
        (e) => e.estado === 400,
      );
      assert.equal(actualizar.mock.callCount(), 0);
    });

    it("un ciclo inexistente responde 404, y un identificador inválido ni consulta la base", async () => {
      const actualizar = mock.method(
        desempenoModelo,
        "actualizarUmbral",
        async () => null,
      );
      await assert.rejects(
        servicio.actualizarUmbral(CICLO_CERRADO, { umbral_brecha: 50 }),
        (e) => e.estado === 404,
      );
      await assert.rejects(
        servicio.actualizarUmbral("x", { umbral_brecha: 50 }),
        (e) => e.estado === 404,
      );
      assert.equal(
        actualizar.mock.callCount(),
        1,
        "solo el primero llegó a la base",
      );
    });

    it("el nuevo umbral cambia el resultado del consolidado", async () => {
      simular({ cicloCerrado: ciclo({ umbral_brecha: 60 }) });
      assert.equal(
        (await servicio.obtenerConsolidado(CICLO_CERRADO)).resumen
          .departamentos_en_brecha,
        1,
      );

      mock.restoreAll();
      simular({ cicloCerrado: ciclo({ umbral_brecha: 90 }) });
      assert.equal(
        (await servicio.obtenerConsolidado(CICLO_CERRADO)).resumen
          .departamentos_en_brecha,
        2,
      );
    });
  });

  it("actualiza solo el ciclo indicado y devuelve su umbral", async () => {
    const { db, consultas } = baseFalsa([
      { id_ciclo: CICLO_CERRADO, umbral_brecha: 70 },
    ]);
    const resultado = await desempenoModelo.actualizarUmbral(
      CICLO_CERRADO,
      70,
      db,
    );

    assert.match(
      consultas[0].sql,
      /UPDATE ciclos_evaluacion SET umbral_brecha = \$2/,
    );
    assert.match(
      consultas[0].sql,
      /WHERE id_ciclo = \$1 RETURNING id_ciclo, umbral_brecha/,
    );
    assert.deepEqual(consultas[0].parametros, [CICLO_CERRADO, 70]);
    assert.deepEqual(resultado, { id_ciclo: CICLO_CERRADO, umbral_brecha: 70 });
  });
});

describe("permisos del módulo de desempeño (RBAC)", () => {
  // Ejecuta el primer middleware de la ruta (el que exige el rol) con un rol dado: devuelve { paso } o { estado }.
  function probar(metodo, ruta, rol) {
    const capa = rutas.stack.find(
      (c) => c.route?.path === ruta && c.route.methods[metodo],
    );
    assert.ok(capa, `${metodo.toUpperCase()} ${ruta} no está registrada`);
    const req = { get: (cabecera) => (cabecera === "X-Rol" ? rol : undefined) };
    let paso = false;
    try {
      capa.route.stack[0].handle(req, {}, () => {
        paso = true;
      });
    } catch (error) {
      return { paso: false, estado: error.estado };
    }
    return { paso };
  }

  const CONSULTAS = [
    ["get", "/desempeno/ciclos"],
    ["get", "/desempeno/ciclos/:idCiclo/consolidado"],
    ["get", "/desempeno/ciclos/:idCiclo/comparativa"],
    ["get", "/desempeno/ciclos/:idCiclo/colaboradores"],
    ["get", "/desempeno/mensajes-crm"],
  ];
  const ACCIONES = [
    ["put", "/desempeno/ciclos/:idCiclo/umbral"],
    ["post", "/desempeno/ciclos/:idCiclo/solicitud-crm/reintentar"],
    ["post", "/desempeno/mensajes-crm/simulacion"],
    ["post", "/desempeno/mensajes-crm/:idMensaje/reprocesar"],
  ];

  for (const [metodo, ruta] of CONSULTAS) {
    it(`${metodo.toUpperCase()} ${ruta}: la consultan el administrador y el gerente de RRHH`, () => {
      assert.equal(probar(metodo, ruta, "admin").paso, true);
      assert.equal(probar(metodo, ruta, "gerente").paso, true);
      assert.equal(
        probar(metodo, ruta, "Gerente ").paso,
        true,
        "el rol se normaliza",
      );
    });

    it(`${metodo.toUpperCase()} ${ruta}: los demás roles reciben 403 y sin rol 401`, () => {
      for (const rol of [
        "supervisor",
        "empleado",
        "reclutador",
        "auditor",
        "otro",
      ]) {
        assert.deepEqual(
          probar(metodo, ruta, rol),
          { paso: false, estado: 403 },
          rol,
        );
      }
      assert.deepEqual(probar(metodo, ruta, undefined), {
        paso: false,
        estado: 401,
      });
      assert.deepEqual(probar(metodo, ruta, ""), { paso: false, estado: 401 });
    });
  }

  for (const [metodo, ruta] of ACCIONES) {
    it(`${metodo.toUpperCase()} ${ruta}: solo el administrador modifica; el gerente puede consultar pero no actuar`, () => {
      assert.equal(probar(metodo, ruta, "admin").paso, true);
      assert.deepEqual(probar(metodo, ruta, "gerente"), {
        paso: false,
        estado: 403,
      });
      assert.deepEqual(probar(metodo, ruta, "empleado"), {
        paso: false,
        estado: 403,
      });
      assert.deepEqual(probar(metodo, ruta, undefined), {
        paso: false,
        estado: 401,
      });
    });
  }

  it("no hay rutas de desempeño sin protección", () => {
    const registradas = rutas.stack
      .filter((c) => c.route)
      .map((c) => `${Object.keys(c.route.methods)[0]} ${c.route.path}`);
    const esperadas = [...CONSULTAS, ...ACCIONES].map(([m, r]) => `${m} ${r}`);
    assert.deepEqual(registradas.sort(), esperadas.sort());
  });
});

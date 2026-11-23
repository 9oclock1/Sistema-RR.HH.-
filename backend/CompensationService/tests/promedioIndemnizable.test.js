const { test, describe, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/db");
const desvinculacionesModel = require("../src/models/desvinculacionesModel");
const modelo = require("../src/models/promedioIndemnizableModel");
const servicio = require("../src/services/promedioIndemnizableService");
const { MESES_PROMEDIO, periodoLimite, calcularPromedio } = require("../src/utils/promedioIndemnizable");

const ID_EMPLEADO = "11111111-1111-1111-1111-111111111111";
const ID_ADMIN = "22222222-2222-2222-2222-222222222222";
const ID_PROCESO = "33333333-3333-3333-3333-333333333333";
const IDENTIDAD_ADMIN = { idEmpleado: ID_ADMIN, rol: "admin" };

function crearClienteFalso() {
  const comandos = [];
  return {
    comandos,
    async query(sql) {
      comandos.push(String(sql).trim());
      return { rows: [] };
    },
    release() {},
  };
}

function planilla(periodo, totalGanado, { diasPagados = 30, haberMensual = 3000 } = {}) {
  return {
    periodo,
    id_planilla: `p-${periodo}`,
    id_planilla_empleado: `pe-${periodo}`,
    dias_pagados: diasPagados,
    haber_mensual: haberMensual,
    total_ganado: totalGanado,
  };
}

function procesoBase(extras = {}) {
  return {
    id_proceso: ID_PROCESO,
    id_empleado: ID_EMPLEADO,
    nombre_empleado: "Elena Paredes Gómez",
    fecha_ingreso: "2019-03-01",
    causal: { codigo: "DESPIDO_LEGAL", nombre: "Despido legal (causa justificada)" },
    fecha_retiro: "2026-10-15",
    corresponde_desahucio: false,
    estado: "INICIADO",
    ...extras,
  };
}

afterEach(() => {
  mock.restoreAll();
});

describe("periodoLimite", () => {
  test("extrae AAAA-MM de fecha_retiro", () => {
    assert.equal(periodoLimite("2026-11-10"), "2026-11");
  });
});

describe("calcularPromedio", () => {
  test("salarios variables y bonos en 3 meses: calcula promedio y ordena de más antiguo a más reciente", () => {
    const entradaDesordenada = [
      planilla("2026-10", 2450.0, { diasPagados: 15, haberMensual: 4500 }),
      planilla("2026-08", 5275.0, { diasPagados: 30, haberMensual: 4500 }),
      planilla("2026-09", 5200.0, { diasPagados: 30, haberMensual: 4500 }),
    ];

    const res = calcularPromedio(entradaDesordenada, "2026-10");

    assert.equal(res.meses_considerados, 3);
    assert.equal(res.total_considerado, 12925.0);
    assert.equal(res.promedio, 4308.33);
    assert.deepEqual(
      res.meses.map((m) => m.periodo),
      ["2026-08", "2026-09", "2026-10"]
    );
    assert.deepEqual(res.observaciones, ["En 2026-10 se pagaron 15 de 30 días."]);
  });

  test("cambio de sueldo a mitad del periodo (haber 4000 -> 4400) con bonos", () => {
    const res = calcularPromedio(
      [
        planilla("2026-08", 4600.0, { haberMensual: 4000 }),
        planilla("2026-09", 4650.0, { haberMensual: 4400 }),
        planilla("2026-10", 4833.33, { haberMensual: 4400 }),
      ],
      "2026-10"
    );

    assert.equal(res.total_considerado, 14083.33);
    assert.equal(res.promedio, 4694.44);
  });

  test("redondeo con la mitad hacia arriba", () => {
    const res = calcularPromedio(
      [planilla("2026-09", 1000.0), planilla("2026-10", 1000.01)],
      "2026-10"
    );

    assert.equal(res.promedio, 1000.01);
  });

  test("AC2: antigüedad menor a tres meses con 2 meses y con 1 mes", () => {
    const dosMeses = calcularPromedio(
      [planilla("2026-09", 3000.0), planilla("2026-10", 3125.0)],
      "2026-10"
    );
    assert.equal(dosMeses.meses_considerados, 2);
    assert.equal(dosMeses.promedio, 3062.5);
    assert.deepEqual(dosMeses.observaciones, [
      "Solo hay 2 planillas cerradas del colaborador hasta 2026-10: el promedio se calculó con 2 meses.",
    ]);

    const unMes = calcularPromedio([planilla("2026-10", 3125.0)], "2026-10");
    assert.equal(unMes.meses_considerados, 1);
    assert.equal(unMes.promedio, 3125.0);
    assert.deepEqual(unMes.observaciones, [
      "Solo hay 1 planilla cerrada del colaborador hasta 2026-10: el promedio se calculó con 1 mes.",
    ]);
  });

  test("sin planillas lanza 409 SIN_PLANILLAS_CERRADAS con el periodo en el mensaje", () => {
    assert.throws(
      () => calcularPromedio([], "2026-10"),
      (err) =>
        err.estado === 409 &&
        err.codigo === "SIN_PLANILLAS_CERRADAS" &&
        err.message.includes("2026-10")
    );
  });

  test("observaciones: días < 30, mes del retiro sin planilla, meses no consecutivos (singular y plural) y sin observaciones", () => {
    const sinObs = calcularPromedio(
      [planilla("2026-08", 3320.0), planilla("2026-09", 3200.0), planilla("2026-10", 3530.0)],
      "2026-10"
    );
    assert.deepEqual(sinObs.observaciones, []);

    const faltaMesRetiro = calcularPromedio(
      [planilla("2026-08", 4600.0), planilla("2026-09", 4650.0), planilla("2026-10", 4833.33)],
      "2026-11"
    );
    assert.deepEqual(faltaMesRetiro.observaciones, [
      "No hay una planilla cerrada de 2026-11 (mes del retiro): si se cierra después, recalcule el promedio.",
    ]);

    const huecoSingular = calcularPromedio(
      [planilla("2026-07", 3000), planilla("2026-09", 3000), planilla("2026-10", 3000)],
      "2026-10"
    );
    assert.deepEqual(huecoSingular.observaciones, [
      "Los meses considerados no son consecutivos: falta la planilla cerrada de 2026-08.",
    ]);

    const huecoPlural = calcularPromedio(
      [planilla("2026-06", 3000), planilla("2026-09", 3000), planilla("2026-10", 3000)],
      "2026-10"
    );
    assert.deepEqual(huecoPlural.observaciones, [
      "Los meses considerados no son consecutivos: faltan las planillas cerradas de 2026-07, 2026-08.",
    ]);

    const diasMenos30 = calcularPromedio(
      [
        planilla("2026-08", 3000, { diasPagados: 28 }),
        planilla("2026-09", 3000, { diasPagados: 30 }),
        planilla("2026-10", 2000, { diasPagados: 20 }),
      ],
      "2026-10"
    );
    assert.deepEqual(diasMenos30.observaciones, [
      "En 2026-08 se pagaron 28 de 30 días.",
      "En 2026-10 se pagaron 20 de 30 días.",
    ]);
  });
});

describe("promedioIndemnizableService", () => {
  test("rechaza con 403 si falta X-Rol o no es admin, sin consultar el modelo", async () => {
    const obtenerMock = mock.method(desvinculacionesModel, "obtenerProceso");
    const listarMock = mock.method(modelo, "listarUltimasPlanillasCerradas");

    await assert.rejects(
      () => servicio.calcular(ID_PROCESO, { rol: null }),
      (err) => err.estado === 403
    );
    await assert.rejects(
      () => servicio.obtener(ID_PROCESO, { rol: "supervisor" }),
      (err) => err.estado === 403
    );

    assert.equal(obtenerMock.mock.callCount(), 0);
    assert.equal(listarMock.mock.callCount(), 0);
  });

  test("id inválido o proceso inexistente devuelve 404", async () => {
    mock.method(desvinculacionesModel, "obtenerProceso", async () => null);

    await assert.rejects(
      () => servicio.calcular("no-es-uuid", IDENTIDAD_ADMIN),
      (err) => err.estado === 404
    );
    await assert.rejects(
      () => servicio.calcular(ID_PROCESO, IDENTIDAD_ADMIN),
      (err) => err.estado === 404
    );
    await assert.rejects(
      () => servicio.obtener("no-es-uuid", IDENTIDAD_ADMIN),
      (err) => err.estado === 404
    );
  });

  test("proceso CERRADO o ANULADO devuelve 409 PROCESO_NO_ABIERTO sin guardar nada", async () => {
    const guardarMock = mock.method(modelo, "guardarPromedio");

    for (const estado of ["CERRADO", "ANULADO"]) {
      mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase({ estado }));
      await assert.rejects(
        () => servicio.calcular(ID_PROCESO, IDENTIDAD_ADMIN),
        (err) => err.estado === 409 && err.codigo === "PROCESO_NO_ABIERTO"
      );
    }

    assert.equal(guardarMock.mock.callCount(), 0);
  });

  test("llama a listarUltimasPlanillasCerradas con id_empleado, periodo del retiro y 3", async () => {
    const clienteFalso = crearClienteFalso();
    mock.method(pool, "connect", async () => clienteFalso);
    mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase({ fecha_retiro: "2026-11-10" }));
    const listarMock = mock.method(modelo, "listarUltimasPlanillasCerradas", async () => [
      planilla("2026-10", 4833.33),
      planilla("2026-09", 4650.0),
      planilla("2026-08", 4600.0),
    ]);
    mock.method(modelo, "bloquearProceso", async () => ({ id_proceso: ID_PROCESO, estado: "INICIADO" }));
    mock.method(modelo, "guardarPromedio", async () => {});
    mock.method(modelo, "marcarEnCurso", async () => {});
    mock.method(modelo, "obtenerDesglose", async () => ({ id_proceso: ID_PROCESO, promedio: 4694.44 }));

    await servicio.calcular(ID_PROCESO, IDENTIDAD_ADMIN);

    assert.equal(listarMock.mock.callCount(), 1);
    assert.deepEqual(listarMock.mock.calls[0].arguments, [ID_EMPLEADO, "2026-11", MESES_PROMEDIO]);
  });

  test("cálculo correcto de proceso INICIADO: guarda promedio, marca EN_CURSO y hace COMMIT", async () => {
    const clienteFalso = crearClienteFalso();
    mock.method(pool, "connect", async () => clienteFalso);
    mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase({ estado: "INICIADO" }));
    mock.method(modelo, "listarUltimasPlanillasCerradas", async () => [
      planilla("2026-10", 2450.0, { diasPagados: 15, haberMensual: 4500 }),
      planilla("2026-09", 5200.0, { diasPagados: 30, haberMensual: 4500 }),
      planilla("2026-08", 5275.0, { diasPagados: 30, haberMensual: 4500 }),
    ]);
    mock.method(modelo, "bloquearProceso", async () => ({ id_proceso: ID_PROCESO, estado: "INICIADO" }));

    let resultadoGuardado = null;
    mock.method(modelo, "guardarPromedio", async (_c, _id, resultado) => {
      resultadoGuardado = resultado;
    });
    const marcarMock = mock.method(modelo, "marcarEnCurso", async () => {});
    const desgloseEsperado = { id_proceso: ID_PROCESO, estado_proceso: "EN_CURSO", promedio: 4308.33 };
    mock.method(modelo, "obtenerDesglose", async () => desgloseEsperado);

    const res = await servicio.calcular(ID_PROCESO, IDENTIDAD_ADMIN);

    assert.deepEqual(res, desgloseEsperado);
    assert.equal(resultadoGuardado.promedio, 4308.33);
    assert.equal(resultadoGuardado.total_considerado, 12925.0);
    assert.equal(marcarMock.mock.callCount(), 1);
    assert.ok(clienteFalso.comandos.includes("BEGIN"));
    assert.ok(clienteFalso.comandos.includes("COMMIT"));
    assert.ok(!clienteFalso.comandos.includes("ROLLBACK"));
  });

  test("en proceso EN_CURSO no llama a marcarEnCurso y el recálculo reemplaza al anterior", async () => {
    const clienteFalso = crearClienteFalso();
    mock.method(pool, "connect", async () => clienteFalso);
    mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase({ estado: "EN_CURSO" }));
    mock.method(modelo, "listarUltimasPlanillasCerradas", async () => [planilla("2026-10", 3530.0)]);
    mock.method(modelo, "bloquearProceso", async () => ({ id_proceso: ID_PROCESO, estado: "EN_CURSO" }));
    const guardarMock = mock.method(modelo, "guardarPromedio", async () => {});
    const marcarMock = mock.method(modelo, "marcarEnCurso", async () => {});
    mock.method(modelo, "obtenerDesglose", async () => ({ id_proceso: ID_PROCESO, promedio: 3530.0 }));

    await servicio.calcular(ID_PROCESO, IDENTIDAD_ADMIN);

    assert.equal(guardarMock.mock.callCount(), 1);
    assert.equal(marcarMock.mock.callCount(), 0);
    assert.ok(clienteFalso.comandos.includes("COMMIT"));
  });

  test("si bloquearProceso devuelve proceso no abierto -> 409, ROLLBACK y nada guardado", async () => {
    const clienteFalso = crearClienteFalso();
    mock.method(pool, "connect", async () => clienteFalso);
    mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase({ estado: "INICIADO" }));
    mock.method(modelo, "listarUltimasPlanillasCerradas", async () => [planilla("2026-10", 3530.0)]);
    mock.method(modelo, "bloquearProceso", async () => ({ id_proceso: ID_PROCESO, estado: "CERRADO" }));
    const guardarMock = mock.method(modelo, "guardarPromedio", async () => {});

    await assert.rejects(
      () => servicio.calcular(ID_PROCESO, IDENTIDAD_ADMIN),
      (err) => err.estado === 409 && err.codigo === "PROCESO_NO_ABIERTO"
    );

    assert.equal(guardarMock.mock.callCount(), 0);
    assert.ok(clienteFalso.comandos.includes("ROLLBACK"));
    assert.ok(!clienteFalso.comandos.includes("COMMIT"));
  });

  test("obtener: sin cálculo -> 404 PROMEDIO_NO_CALCULADO; con cálculo -> devuelve desglose con meses e ingresos", async () => {
    mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase());
    mock.method(modelo, "obtenerDesglose", async () => null);

    await assert.rejects(
      () => servicio.obtener(ID_PROCESO, IDENTIDAD_ADMIN),
      (err) => err.estado === 404 && err.codigo === "PROMEDIO_NO_CALCULADO"
    );

    const desglose = {
      id_proceso: ID_PROCESO,
      promedio: 3350.0,
      meses: [
        {
          periodo: "2026-08",
          dias_pagados: 30,
          total_ganado: 3320.0,
          ingresos: [
            { codigo: "HABER-BASICO", nombre: "Haber básico", resultado: 3200.0 },
            { codigo: "HORAS-EXTRA", nombre: "Horas extraordinarias", resultado: 120.0 },
          ],
        },
      ],
    };
    mock.method(modelo, "obtenerDesglose", async () => desglose);

    const res = await servicio.obtener(ID_PROCESO, IDENTIDAD_ADMIN);
    assert.deepEqual(res, desglose);
  });
});

describe("rol Contador (solo lectura)", () => {
  afterEach(() => mock.restoreAll());

  const IDENTIDAD_CONTADOR = { idEmpleado: ID_ADMIN, rol: "contador" };

  test("el Contador consulta el desglose del sueldo promedio", async () => {
    const desglose = { id_proceso: ID_PROCESO, promedio: 3350.0, meses: [] };
    mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase());
    mock.method(modelo, "obtenerDesglose", async () => desglose);

    assert.deepEqual(await servicio.obtener(ID_PROCESO, IDENTIDAD_CONTADOR), desglose);
    assert.deepEqual(await servicio.obtener(ID_PROCESO, { rol: " Contador " }), desglose);
  });

  test("el Contador no puede calcular ni recalcular: 403 sin consultar el modelo", async () => {
    const obtenerProceso = mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase());
    const guardar = mock.method(modelo, "guardarPromedio", async () => {});

    await assert.rejects(
      () => servicio.calcular(ID_PROCESO, IDENTIDAD_CONTADOR),
      (err) => err.estado === 403
    );
    assert.equal(obtenerProceso.mock.callCount(), 0);
    assert.equal(guardar.mock.callCount(), 0);
  });

  test("el Contador lista los procesos y las causales, pero no registra bajas ni descarga el respaldo", async () => {
    const desvinculacionesServicio = require("../src/services/desvinculacionesService");
    const { validarConsulta } = require("../src/utils/desvinculaciones");
    mock.method(desvinculacionesModel, "listarProcesos", async () => []);
    mock.method(desvinculacionesModel, "listarCausalesActivas", async () => []);
    mock.method(desvinculacionesModel, "obtenerProceso", async () => procesoBase());
    const obtenerDocumento = mock.method(desvinculacionesModel, "obtenerDocumento", async () => ({}));

    assert.deepEqual(await desvinculacionesServicio.listar({}, IDENTIDAD_CONTADOR), []);
    assert.deepEqual(await desvinculacionesServicio.listarCausales(IDENTIDAD_CONTADOR), []);
    assert.equal((await desvinculacionesServicio.obtener(ID_PROCESO, IDENTIDAD_CONTADOR)).id_proceso, ID_PROCESO);

    await assert.rejects(
      () => desvinculacionesServicio.obtenerDocumento(ID_PROCESO, IDENTIDAD_CONTADOR),
      (err) => err.estado === 403
    );
    assert.equal(obtenerDocumento.mock.callCount(), 0);
    await assert.rejects(
      () => desvinculacionesServicio.registrar({}, null, IDENTIDAD_CONTADOR),
      (err) => err.estado === 403
    );

    for (const rol of [undefined, "", "supervisor", "auditor", "empleado"]) {
      assert.throws(() => validarConsulta({ rol }), (err) => err.estado === 403);
    }
  });
});

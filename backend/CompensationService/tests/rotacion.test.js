const { test, describe, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const modelo = require("../src/models/rotacion.model");
const empleadosCliente = require("../src/clients/empleados.cliente");
const servicio = require("../src/services/rotacion.service");
const { ErrorApp } = require("../src/utils/errores");
const { hoyLaPaz } = require("../src/utils/fechas");
const {
  METAS,
  semaforo,
  validarConsulta,
  resolverAlcance,
  construirTrayectorias,
  movimiento,
  rotacionMensual,
  retencion,
  rotacionTemprana,
  motivosDeBaja,
  calcularTablero,
} = require("../src/utils/rotacion");

const SOP = "aaaaaaaa-0000-4000-8000-000000000001";
const MIR = "aaaaaaaa-0000-4000-8000-000000000002";
const ATC = "bbbbbbbb-0000-4000-8000-000000000001";
const RRHH = "bbbbbbbb-0000-4000-8000-000000000002";
const SUPERVISOR = "cccccccc-0000-4000-8000-000000000001";

const CAUSALES = [
  { codigo: "RENUNCIA", nombre: "Renuncia voluntaria" },
  { codigo: "CONCLUSION_CONTRATO", nombre: "Conclusión de contrato" },
  { codigo: "DESPIDO_LEGAL", nombre: "Despido legal" },
  { codigo: "DESAHUCIO", nombre: "Desahucio" },
];

let secuencia = 0;
const empleado = (ingreso, cambios = {}) => ({
  id_empleado: `dddddddd-0000-4000-8000-${String(++secuencia).padStart(12, "0")}`,
  fecha_ingreso: ingreso,
  id_sucursal: SOP,
  id_departamento: ATC,
  estado_codigo: "ACTIVO",
  activo: true,
  ...cambios,
});
const dadoDeBaja = (ingreso, cambios = {}) => empleado(ingreso, { estado_codigo: "BAJA", activo: false, ...cambios });
const baja = (emp, fechaRetiro, codigoCausal = "RENUNCIA") => ({
  id_empleado: emp.id_empleado,
  fecha_ingreso: emp.fecha_ingreso,
  fecha_retiro: fechaRetiro,
  codigo_causal: codigoCausal,
});
const plantilla = (n, ingreso = "2024-01-15", cambios = {}) => Array.from({ length: n }, () => empleado(ingreso, cambios));
const trayectorias = (empleados, bajas = []) => construirTrayectorias(empleados, bajas).trayectorias;

describe("semáforo (verde cumple, amarillo a menos del 10% de la meta, rojo no cumple)", () => {
  test("meta máxima: rotación mensual ≤ 3%", () => {
    const meta = METAS["KPI-10"];
    assert.equal(semaforo(0, meta), "verde");
    assert.equal(semaforo(3, meta), "verde");
    assert.equal(semaforo(3.1, meta), "amarillo");
    assert.equal(semaforo(3.3, meta), "amarillo");
    assert.equal(semaforo(3.4, meta), "rojo");
  });

  test("meta mínima: retención ≥ 90%", () => {
    const meta = METAS["KPI-11"];
    assert.equal(semaforo(100, meta), "verde");
    assert.equal(semaforo(90, meta), "verde");
    assert.equal(semaforo(89.9, meta), "amarillo");
    assert.equal(semaforo(81, meta), "amarillo");
    assert.equal(semaforo(80.9, meta), "rojo");
  });

  test("rotación temprana ≤ 15%: amarillo hasta 16,5%", () => {
    const meta = METAS["KPI-12"];
    assert.equal(semaforo(15, meta), "verde");
    assert.equal(semaforo(16.5, meta), "amarillo");
    assert.equal(semaforo(16.6, meta), "rojo");
  });

  test("sin valor no se colorea", () => {
    assert.equal(semaforo(null, METAS["KPI-10"]), "sin_datos");
    assert.equal(semaforo(undefined, METAS["KPI-11"]), "sin_datos");
  });
});

describe("validación de la consulta", () => {
  const HOY = "2026-11-22";

  test("sin periodo toma el mes actual", () => {
    assert.deepEqual(validarConsulta({}, HOY), { periodo: "2026-11", idSucursal: null, idDepartamento: null });
    assert.equal(validarConsulta({ periodo: "" }, HOY).periodo, "2026-11");
  });

  test("acepta un mes pasado y filtros con UUID en mayúsculas", () => {
    const r = validarConsulta({ periodo: "2025-12", id_sucursal: SOP.toUpperCase(), id_departamento: RRHH }, HOY);
    assert.deepEqual(r, { periodo: "2025-12", idSucursal: SOP, idDepartamento: RRHH });
  });

  const rechaza = (consulta, campos) => {
    assert.throws(
      () => validarConsulta(consulta, HOY),
      (e) => e instanceof ErrorApp && e.estado === 400 && e.detalles.map((d) => d.campo).join() === campos.join()
    );
  };

  test("rechaza periodos mal formados, futuros o anteriores a 2000", () => {
    rechaza({ periodo: "2026-13" }, ["periodo"]);
    rechaza({ periodo: "2026-1" }, ["periodo"]);
    rechaza({ periodo: "noviembre" }, ["periodo"]);
    rechaza({ periodo: ["2026-10", "2026-09"] }, ["periodo"]);
    rechaza({ periodo: "2026-12" }, ["periodo"]);
    rechaza({ periodo: "1999-12" }, ["periodo"]);
  });

  test("rechaza sucursal y área que no son UUID, informando ambas", () => {
    rechaza({ id_sucursal: "abc", id_departamento: "1" }, ["id_sucursal", "id_departamento"]);
  });
});

describe("alcance por rol", () => {
  const empleados = [empleado("2020-01-01", { id_empleado: SUPERVISOR, id_sucursal: MIR })];

  test("administrador y gerente ven toda la cadena o la sucursal que elijan", () => {
    assert.deepEqual(resolverAlcance({ rol: "admin" }, empleados, null), { rol: "admin", sucursal_fija: false, id_sucursal: null });
    assert.deepEqual(resolverAlcance({ rol: " Gerente " }, empleados, SOP), { rol: "gerente", sucursal_fija: false, id_sucursal: SOP });
  });

  test("el supervisor queda fijo en su sucursal", () => {
    assert.deepEqual(resolverAlcance({ rol: "supervisor", idEmpleado: SUPERVISOR.toUpperCase() }, empleados, null), {
      rol: "supervisor",
      sucursal_fija: true,
      id_sucursal: MIR,
    });
    assert.equal(resolverAlcance({ rol: "supervisor", idEmpleado: SUPERVISOR }, empleados, MIR).id_sucursal, MIR);
  });

  const prohibido = (identidad, sucursal = null) =>
    assert.throws(() => resolverAlcance(identidad, empleados, sucursal), (e) => e instanceof ErrorApp && e.estado === 403);

  test("el supervisor no puede pedir otra sucursal", () => prohibido({ rol: "supervisor", idEmpleado: SUPERVISOR }, SOP));

  test("supervisor sin identificar, desconocido o sin acceso: 403", () => {
    prohibido({ rol: "supervisor" });
    prohibido({ rol: "supervisor", idEmpleado: "no-es-uuid" });
    prohibido({ rol: "supervisor", idEmpleado: "cccccccc-0000-4000-8000-000000000999" });
    const inactivo = [empleado("2020-01-01", { id_empleado: SUPERVISOR, activo: false })];
    assert.throws(() => resolverAlcance({ rol: "supervisor", idEmpleado: SUPERVISOR }, inactivo, null), { estado: 403 });
  });

  test("otros roles o sin rol: 403", () => {
    prohibido({ rol: "empleado" });
    prohibido({ rol: "reclutador" });
    prohibido({});
  });
});

describe("trayectorias", () => {
  test("toma la baja con el retiro más reciente de cada colaborador", () => {
    const e = dadoDeBaja("2023-01-01");
    const [t] = trayectorias([e], [baja(e, "2025-03-31", "DESPIDO_LEGAL"), baja(e, "2026-02-10", "RENUNCIA")]);
    assert.equal(t.retiro, "2026-02-10");
    assert.equal(t.codigo_causal, "RENUNCIA");
  });

  test("una BAJA sin proceso de desvinculación no tiene fecha y queda fuera, contada aparte", () => {
    const { trayectorias: lista, sinRegistro } = construirTrayectorias([empleado("2023-01-01"), dadoDeBaja("2023-01-01")], []);
    assert.equal(lista.length, 1);
    assert.equal(sinRegistro.length, 1);
  });

  test("un suspendido sin proceso sigue en planilla", () => {
    const lista = trayectorias([empleado("2023-01-01", { estado_codigo: "SUSPENDIDO", activo: false })]);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].retiro, null);
  });

  test("sin fecha de ingreso en EmployeeService usa la copiada en el proceso; sin ninguna, se omite", () => {
    const e = dadoDeBaja(null);
    const [t] = trayectorias([e], [{ ...baja(e, "2026-01-31"), fecha_ingreso: "2022-06-01" }]);
    assert.equal(t.ingreso, "2022-06-01");
    assert.equal(trayectorias([empleado(null)]).length, 0);
  });
});

describe("cortes de periodo", () => {
  test("ingreso el día 1 cuenta como ingreso del mes, no en la plantilla inicial", () => {
    const m = movimiento(trayectorias([empleado("2026-03-01")]), "2026-03-01", "2026-03-31");
    assert.deepEqual(m, { inicial: 0, final: 1, bajas: 0, ingresos: 1 });
  });

  test("retiro el último día cuenta como baja del mes y ya no está en la plantilla final", () => {
    const e = dadoDeBaja("2024-01-01");
    const m = movimiento(trayectorias([e], [baja(e, "2026-03-31")]), "2026-03-01", "2026-03-31");
    assert.deepEqual(m, { inicial: 1, final: 0, bajas: 1, ingresos: 0 });
  });

  test("retiro el día 1 es baja de ese mes y estaba en la plantilla inicial", () => {
    const e = dadoDeBaja("2024-01-01");
    const tr = trayectorias([e], [baja(e, "2026-03-01")]);
    assert.deepEqual(movimiento(tr, "2026-03-01", "2026-03-31"), { inicial: 1, final: 0, bajas: 1, ingresos: 0 });
    assert.equal(movimiento(tr, "2026-02-01", "2026-02-28").bajas, 0);
  });

  test("plantilla final = inicial + ingresos − bajas", () => {
    const salen = [dadoDeBaja("2025-01-01"), dadoDeBaja("2026-05-03"), dadoDeBaja("2026-05-10")];
    const tr = trayectorias(
      [...plantilla(20), ...salen, empleado("2026-05-20")],
      [baja(salen[0], "2026-05-05"), baja(salen[1], "2026-05-31"), baja(salen[2], "2026-06-02")]
    );
    const m = movimiento(tr, "2026-05-01", "2026-05-31");
    assert.equal(m.final, m.inicial + m.ingresos - m.bajas);
    assert.deepEqual(m, { inicial: 21, final: 22, bajas: 2, ingresos: 3 });
  });
});

describe("KPI-10 rotación mensual", () => {
  test("bajas / ((inicio + final) / 2) × 100, redondeado a un decimal", () => {
    const salen = [dadoDeBaja("2024-01-01"), dadoDeBaja("2024-01-01")];
    const tr = trayectorias([...plantilla(64), ...salen], salen.map((e) => baja(e, "2026-07-15")));
    const r = rotacionMensual(tr, "2026-07", "2026-11-22");
    assert.equal(r.valor, 3.1); // 2 / ((66 + 64) / 2) = 3,08 %
    assert.deepEqual(r.detalle, { bajas: 2, ingresos: 0, plantilla_inicio: 66, plantilla_final: 64, plantilla_promedio: 65 });
    assert.equal(semaforo(r.valor, METAS["KPI-10"]), "amarillo");
  });

  test("sin plantilla no hay división entre cero: sin datos", () => {
    assert.equal(rotacionMensual([], "2026-07", "2026-11-22").valor, null);
  });

  test("el mes en curso se corta en el día de hoy", () => {
    const e = dadoDeBaja("2024-01-01");
    const tr = trayectorias([...plantilla(9), e], [baja(e, "2026-11-25")]);
    assert.equal(rotacionMensual(tr, "2026-11", "2026-11-22").detalle.bajas, 0);
    assert.equal(rotacionMensual(tr, "2026-11", "2026-11-30").detalle.bajas, 1);
  });
});

describe("KPI-11 retención", () => {
  test("solo cuenta a quienes estaban al inicio; los ingresos posteriores no la mejoran", () => {
    const salen = [dadoDeBaja("2020-01-01"), dadoDeBaja("2020-01-01")];
    const nuevos = plantilla(5, "2026-03-01");
    const tr = trayectorias([...plantilla(18, "2020-01-01"), ...salen, ...nuevos], salen.map((e) => baja(e, "2026-06-30")));
    const r = retencion(tr, "2025-12-01", "2026-11-22");
    assert.deepEqual(r.detalle, { empleados_inicio: 20, siguen_activos: 18 });
    assert.equal(r.valor, 90);
  });

  test("quien entra y sale dentro del tramo no afecta la retención", () => {
    const e = dadoDeBaja("2026-02-01");
    const r = retencion(trayectorias([...plantilla(10, "2020-01-01"), e], [baja(e, "2026-03-01")]), "2025-12-01", "2026-11-22");
    assert.equal(r.valor, 100);
  });

  test("sin plantilla al inicio: sin datos", () => {
    assert.equal(retencion(trayectorias(plantilla(3, "2026-05-01")), "2025-12-01", "2026-11-22").valor, null);
  });
});

describe("KPI-12 rotación temprana", () => {
  test("bajas con menos de 90 días sobre los ingresos del tramo", () => {
    const temprana = dadoDeBaja("2026-03-01");
    const limite = dadoDeBaja("2026-03-01");
    const tr = trayectorias(
      [...plantilla(4, "2026-04-01"), temprana, limite, dadoDeBaja("2020-01-01", { id_empleado: "x" })],
      [baja(temprana, "2026-05-29"), baja(limite, "2026-05-30")] // 89 y 90 días
    );
    const r = rotacionTemprana(tr, "2025-12-01", "2026-11-22");
    assert.deepEqual(r.detalle, { bajas_tempranas: 1, ingresos: 6 });
    assert.equal(r.valor, 16.7);
  });

  test("sin ingresos en el tramo: sin datos", () => {
    assert.equal(rotacionTemprana(trayectorias(plantilla(5, "2020-01-01")), "2025-12-01", "2026-11-22").valor, null);
  });
});

describe("motivos de baja", () => {
  test("lista todas las causales del catálogo, aun sin bajas, con su porcentaje", () => {
    const salen = [dadoDeBaja("2024-01-01"), dadoDeBaja("2024-01-01"), dadoDeBaja("2024-01-01")];
    const tr = trayectorias(salen, [baja(salen[0], "2026-02-01"), baja(salen[1], "2026-03-01"), baja(salen[2], "2026-04-01", "DESAHUCIO")]);
    const m = motivosDeBaja(tr, CAUSALES, "2025-12-01", "2026-11-22");
    assert.equal(m.total, 3);
    assert.deepEqual(
      m.items.map((i) => [i.codigo, i.cantidad, i.porcentaje]),
      [["RENUNCIA", 2, 66.7], ["CONCLUSION_CONTRATO", 0, 0], ["DESPIDO_LEGAL", 0, 0], ["DESAHUCIO", 1, 33.3]]
    );
  });

  test("bajas fuera del tramo no cuentan; causal desconocida se agrega al final", () => {
    const salen = [dadoDeBaja("2020-01-01"), dadoDeBaja("2020-01-01")];
    const tr = trayectorias(salen, [baja(salen[0], "2025-11-30"), baja(salen[1], "2026-01-10", "OTRA")]);
    const m = motivosDeBaja(tr, CAUSALES, "2025-12-01", "2026-11-22");
    assert.equal(m.total, 1);
    assert.deepEqual(m.items.at(-1), { codigo: "OTRA", nombre: "OTRA", cantidad: 1, porcentaje: 100 });
  });
});

describe("tablero completo", () => {
  const salenSop = [dadoDeBaja("2023-01-01"), dadoDeBaja("2026-09-01")];
  const saleMir = dadoDeBaja("2023-01-01", { id_sucursal: MIR, id_departamento: RRHH });
  const empleados = [
    ...plantilla(30),
    ...plantilla(10, "2024-01-15", { id_sucursal: MIR }),
    ...salenSop,
    saleMir,
    dadoDeBaja("2022-01-01", { id_sucursal: MIR }),
  ];
  const bajas = [baja(salenSop[0], "2026-11-10"), baja(salenSop[1], "2026-10-15", "CONCLUSION_CONTRATO"), baja(saleMir, "2026-01-20", "DESPIDO_LEGAL")];
  const tablero = (extra = {}) => calcularTablero({ empleados, bajas, causales: CAUSALES, periodo: "2026-11", hoy: "2026-11-22", ...extra });

  test("devuelve los tres KPI con su semáforo, la tendencia de 12 meses y los motivos", () => {
    const t = tablero();
    assert.equal(t.corte, "2026-11-22");
    assert.deepEqual(t.ventana, { desde: "2025-12", hasta: "2026-11" });
    assert.deepEqual(t.kpis.map((k) => k.codigo), ["KPI-10", "KPI-11", "KPI-12"]);
    assert.deepEqual(t.kpis[0].tramo, { desde: "2026-11-01", hasta: "2026-11-22" });
    assert.deepEqual(t.kpis[1].tramo, { desde: "2025-12-01", hasta: "2026-11-22" });
    assert.equal(t.tendencia.length, 12);
    assert.equal(t.tendencia[0].periodo, "2025-12");
    assert.equal(t.tendencia[11].periodo, "2026-11");
    assert.equal(t.motivos.total, 3);
    assert.equal(t.avisos.bajas_sin_registro, 1);
    for (const k of t.kpis) assert.equal(k.estado, semaforo(k.valor, METAS[k.codigo]));
  });

  test("filtrar por sucursal o área recalcula indicadores, tendencia, motivos y avisos", () => {
    const sop = tablero({ idSucursal: SOP });
    assert.equal(sop.motivos.total, 2);
    assert.equal(sop.avisos.bajas_sin_registro, 0);
    assert.equal(sop.tendencia[1].bajas, 0);
    const rrhh = tablero({ idDepartamento: RRHH });
    assert.equal(rrhh.motivos.total, 1);
    assert.equal(rrhh.tendencia[1].bajas, 1); // enero 2026
    assert.notDeepEqual(sop.kpis.map((k) => k.valor), rrhh.kpis.map((k) => k.valor));
  });

  test("un periodo pasado usa el mes completo y su propia ventana", () => {
    const t = tablero({ periodo: "2026-10" });
    assert.equal(t.corte, "2026-10-31");
    assert.equal(t.tendencia[11].periodo, "2026-10");
    assert.equal(t.kpis[0].detalle.bajas, 1);
  });
});

describe("servicio", () => {
  afterEach(() => mock.restoreAll());

  const preparar = (empleados, bajas = []) => {
    mock.method(empleadosCliente, "listarEmpleados", async () => empleados);
    mock.method(modelo, "listarBajas", async () => bajas);
    mock.method(modelo, "listarCausales", async () => CAUSALES);
  };

  test("el supervisor recibe su sucursal fija aunque no la pida", async () => {
    preparar([empleado("2020-01-01", { id_empleado: SUPERVISOR, id_sucursal: MIR }), ...plantilla(5)]);
    const t = await servicio.obtenerTablero({}, { rol: "supervisor", idEmpleado: SUPERVISOR });
    assert.deepEqual(t.filtros, { id_sucursal: MIR, id_departamento: null });
    assert.deepEqual(t.alcance, { rol: "supervisor", sucursal_fija: true });
    assert.equal(t.periodo, hoyLaPaz().slice(0, 7));
  });

  test("valida los filtros antes de consultar a EmployeeService", async () => {
    preparar([]);
    await assert.rejects(servicio.obtenerTablero({ periodo: "x" }, { rol: "admin" }), { estado: 400 });
    assert.equal(empleadosCliente.listarEmpleados.mock.callCount(), 0);
  });

  test("si EmployeeService no responde, 503", async () => {
    mock.method(empleadosCliente, "listarEmpleados", async () => {
      throw new ErrorApp(503, "EmployeeService no responde.");
    });
    mock.method(modelo, "listarBajas", async () => []);
    mock.method(modelo, "listarCausales", async () => CAUSALES);
    await assert.rejects(servicio.obtenerTablero({}, { rol: "gerente" }), { estado: 503 });
  });
});

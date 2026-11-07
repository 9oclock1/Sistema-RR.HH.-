const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validarCondicion,
  validarEdicionCondicion,
  validarAsignacion,
  validarCambioFin,
  rangoPeriodo,
  cumpleCondicion,
  bonosDetectados,
  bonosAsignados,
} = require("../src/utils/condiciones");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";

const campos = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.detalles.map((d) => d.campo);
  }
  return [];
};

const base = {
  codigo: "bono-trasnoche",
  nombre: "Bono por trasnoche",
  forma_calculo: "MONTO_FIJO",
  valor: 50,
  vigente_desde: "2026-01-01",
  tipo_condicion: "TRASNOCHE",
  minutos_nocturnos_minimos: 240,
};

const vigencia = (id, valor, desde, hasta = null) => ({ id_vigencia: id, valor, vigente_desde: desde, vigente_hasta: hasta });
const condicion = (extra) => ({
  id_condicion: "c-1",
  tipo_condicion: "TRASNOCHE",
  minutos_nocturnos_minimos: 240,
  forma_calculo: "MONTO_FIJO",
  vigencias: [vigencia("v-1", 50, "2026-01-01")],
  ...extra,
});
const jornada = (id, fecha, extra) => ({
  id_empleado: id,
  fecha_jornada: fecha,
  tipo_dia: "HABIL",
  feriado: null,
  minutos_trabajados: 480,
  minutos_nocturnos: 0,
  ...extra,
});

test("la condición es un concepto de ingreso: código en mayúsculas, sin base en monto fijo", () => {
  const { concepto, vigencia: v, condicion: c } = validarCondicion(base);
  assert.equal(concepto.codigo, "BONO-TRASNOCHE");
  assert.equal(concepto.tipo, "INGRESO");
  assert.equal(concepto.es_de_ley, false);
  assert.equal(concepto.base_calculo, null);
  assert.deepEqual(v, { valor: 50, vigente_desde: "2026-01-01", vigente_hasta: null });
  assert.deepEqual(c, { tipo_condicion: "TRASNOCHE", minutos_nocturnos_minimos: 240 });
});

test("un porcentaje se calcula siempre sobre el haber básico, aunque se pida otra base", () => {
  const { concepto } = validarCondicion({
    ...base,
    forma_calculo: "PORCENTAJE",
    base_calculo: "TOTAL_GANADO",
    valor: 10,
    tipo_condicion: "ASIGNACION",
  });
  assert.equal(concepto.base_calculo, "HABER_BASICO");
});

test("solo el trasnoche lleva minutos nocturnos mínimos", () => {
  assert.deepEqual(validarCondicion({ ...base, tipo_condicion: "FERIADO", minutos_nocturnos_minimos: 30 }).condicion, {
    tipo_condicion: "FERIADO",
    minutos_nocturnos_minimos: null,
  });
  assert.deepEqual(campos(() => validarCondicion({ ...base, minutos_nocturnos_minimos: 0 })), ["minutos_nocturnos_minimos"]);
  assert.deepEqual(campos(() => validarCondicion({ ...base, minutos_nocturnos_minimos: 601 })), ["minutos_nocturnos_minimos"]);
  assert.deepEqual(campos(() => validarCondicion({ ...base, minutos_nocturnos_minimos: "240" })), [
    "minutos_nocturnos_minimos",
  ]);
});

test("junta los errores del concepto y de la condición en el orden del formulario", () => {
  assert.deepEqual(campos(() => validarCondicion({ tipo_condicion: "OTRA" })), [
    "forma_calculo",
    "codigo",
    "nombre",
    "valor",
    "vigente_desde",
    "tipo_condicion",
  ]);
});

test("al editar no cambian el tipo de condición ni la forma de cálculo", () => {
  const actual = { tipo_condicion: "TRASNOCHE", forma_calculo: "MONTO_FIJO" };
  assert.deepEqual(
    campos(() => validarEdicionCondicion({ ...base, tipo_condicion: "FERIADO", forma_calculo: "PORCENTAJE" }, actual)),
    ["tipo_condicion", "forma_calculo"]
  );
  const { concepto, minutos_nocturnos_minimos } = validarEdicionCondicion({ ...base, minutos_nocturnos_minimos: 180 }, actual);
  assert.equal(concepto.nombre, "Bono por trasnoche");
  assert.equal(minutos_nocturnos_minimos, 180);
});

test("periodo: mes AAAA-MM hasta el mes en curso, con sus días", () => {
  assert.deepEqual(rangoPeriodo("2026-02", "2026-11-04"), { desde: "2026-02-01", hasta: "2026-02-28", dias: 28 });
  assert.deepEqual(rangoPeriodo("2028-02", "2028-03-01"), { desde: "2028-02-01", hasta: "2028-02-29", dias: 29 });
  assert.deepEqual(rangoPeriodo("2026-11", "2026-11-04").hasta, "2026-11-30");
  assert.deepEqual(campos(() => rangoPeriodo("2026-12", "2026-11-04")), ["periodo"]);
  for (const malo of ["2026-13", "2026-1", "26-01", undefined, 202611]) {
    assert.deepEqual(campos(() => rangoPeriodo(malo, "2026-11-04")), ["periodo"], String(malo));
  }
});

test("trasnoche: cuenta la jornada con los minutos nocturnos mínimos", () => {
  const c = condicion();
  assert.equal(cumpleCondicion(c, jornada(ANA, "2026-10-05", { minutos_nocturnos: 240 })), true);
  assert.equal(cumpleCondicion(c, jornada(ANA, "2026-10-05", { minutos_nocturnos: 239 })), false);
});

test("feriado: cuenta el feriado trabajado aunque caiga en domingo", () => {
  const c = condicion({ tipo_condicion: "FERIADO", minutos_nocturnos_minimos: null });
  assert.equal(cumpleCondicion(c, jornada(ANA, "2026-11-02", { tipo_dia: "FERIADO", feriado: "Todos Santos" })), true);
  assert.equal(cumpleCondicion(c, jornada(ANA, "2026-08-02", { tipo_dia: "DOMINGO", feriado: "Feriado" })), true);
  assert.equal(cumpleCondicion(c, jornada(ANA, "2026-08-02", { tipo_dia: "DOMINGO" })), false);
  assert.equal(cumpleCondicion(c, jornada(ANA, "2026-11-02", { feriado: "Todos Santos", minutos_trabajados: 0 })), false);
});

test("detección: un bono por colaborador con las jornadas que cumplen, monto fijo por jornada", () => {
  const jornadas = [
    jornada(ANA, "2026-10-07", { minutos_nocturnos: 450 }),
    jornada(ANA, "2026-10-05", { minutos_nocturnos: 450 }),
    jornada(ANA, "2026-10-06", { minutos_nocturnos: 60 }),
    jornada(LUIS, "2026-10-05", { minutos_nocturnos: 300 }),
  ];
  const bonos = bonosDetectados([condicion()], jornadas);
  assert.equal(bonos.length, 2);
  const ana = bonos.find((b) => b.id_empleado === ANA);
  assert.deepEqual(ana, {
    id_condicion: "c-1",
    id_vigencia: "v-1",
    id_asignacion: null,
    id_empleado: ANA,
    origen: "DETECCION",
    cantidad: 2,
    fechas: ["2026-10-05", "2026-10-07"],
    factor: 2,
    valor: 50,
    monto: 100,
  });
});

test("detección con porcentaje: factor de jornadas sobre 30 días y sin monto (lo calcula la planilla)", () => {
  const c = condicion({ forma_calculo: "PORCENTAJE", vigencias: [vigencia("v-1", 25, "2026-01-01")] });
  const [bono] = bonosDetectados([c], [jornada(ANA, "2026-10-05", { minutos_nocturnos: 450 })]);
  assert.equal(bono.factor, 0.033333);
  assert.equal(bono.valor, 25);
  assert.equal(bono.monto, null);
});

test("detección: cada jornada usa la vigencia de su fecha y se separa por vigencia", () => {
  const c = condicion({
    vigencias: [vigencia("v-1", 50, "2026-01-01", "2026-10-14"), vigencia("v-2", 60, "2026-10-15")],
  });
  const jornadas = ["2026-10-10", "2026-10-14", "2026-10-15", "2026-10-20", "2026-10-21"].map((f) =>
    jornada(ANA, f, { minutos_nocturnos: 400 })
  );
  const bonos = bonosDetectados([c], jornadas);
  assert.deepEqual(
    bonos.map((b) => [b.id_vigencia, b.cantidad, b.monto]),
    [
      ["v-1", 2, 100],
      ["v-2", 3, 180],
    ]
  );
});

test("detección: sin vigencia en la fecha no hay bono, y las condiciones por asignación no se detectan", () => {
  const sinVigencia = condicion({ vigencias: [vigencia("v-1", 50, "2026-11-01")] });
  const porAsignacion = condicion({ id_condicion: "c-2", tipo_condicion: "ASIGNACION" });
  assert.deepEqual(bonosDetectados([sinVigencia, porAsignacion], [jornada(ANA, "2026-10-05", { minutos_nocturnos: 600 })]), []);
});

const congelados = (extra) =>
  condicion({ id_condicion: "c-3", tipo_condicion: "ASIGNACION", minutos_nocturnos_minimos: null, ...extra });
const asignacion = (desde, hasta = null, extra) => ({
  id_asignacion: "a-1",
  id_condicion: "c-3",
  id_empleado: ANA,
  nombre_empleado: "Ana Quispe",
  vigente_desde: desde,
  vigente_hasta: hasta,
  ...extra,
});
const OCTUBRE = { desde: "2026-10-01", hasta: "2026-10-31", dias: 31 };

test("asignación vigente todo el mes: valor mensual completo", () => {
  const c = congelados({ vigencias: [vigencia("v-3", 300, "2026-01-01")] });
  const [bono] = bonosAsignados([c], [asignacion("2026-09-01")], OCTUBRE);
  assert.deepEqual(bono, {
    id_condicion: "c-3",
    id_vigencia: "v-3",
    id_asignacion: "a-1",
    fechas: [],
    id_empleado: ANA,
    nombre_empleado: "Ana Quispe",
    origen: "ASIGNACION",
    cantidad: 31,
    factor: 1,
    valor: 300,
    monto: 300,
  });
});

test("asignación parte del mes: se prorratea por los días asignados", () => {
  const c = congelados({ vigencias: [vigencia("v-3", 310, "2026-01-01")] });
  const [bono] = bonosAsignados([c], [asignacion("2026-10-22", "2026-11-15")], OCTUBRE);
  assert.equal(bono.cantidad, 10);
  assert.equal(bono.monto, 100);
  const [corta] = bonosAsignados([c], [asignacion("2026-09-01", "2026-10-03")], OCTUBRE);
  assert.equal(corta.cantidad, 3);
  assert.equal(corta.monto, 30);
});

test("asignación terminada o futura: sin bono; condición inactiva (fuera de la lista): sin bono", () => {
  const c = congelados();
  assert.deepEqual(bonosAsignados([c], [asignacion("2026-11-01")], OCTUBRE), []);
  assert.deepEqual(bonosAsignados([c], [asignacion("2026-08-01", "2026-09-30")], OCTUBRE), []);
  assert.deepEqual(bonosAsignados([], [asignacion("2026-09-01")], OCTUBRE), []);
});

test("asignación con porcentaje: factor de días del mes, sin monto", () => {
  const c = congelados({ forma_calculo: "PORCENTAJE", vigencias: [vigencia("v-3", 10, "2026-01-01")] });
  const [bono] = bonosAsignados([c], [asignacion("2026-10-17")], OCTUBRE);
  assert.equal(bono.cantidad, 15);
  assert.equal(bono.factor, 0.483871);
  assert.equal(bono.monto, null);
});

test("asignación con cambio de valor en el mes: un bono por vigencia", () => {
  const c = congelados({
    vigencias: [vigencia("v-3", 310, "2026-01-01", "2026-10-15"), vigencia("v-4", 620, "2026-10-16")],
  });
  const bonos = bonosAsignados([c], [asignacion("2026-09-01")], OCTUBRE);
  assert.deepEqual(
    bonos.map((b) => [b.id_vigencia, b.cantidad, b.monto]),
    [
      ["v-3", 15, 150],
      ["v-4", 16, 320],
    ]
  );
});

test("asignación: colaboradores sin repetir, fechas y motivo", () => {
  const datos = validarAsignacion({
    ids_empleado: [ANA, ANA.toUpperCase(), LUIS],
    vigente_desde: "2026-10-01",
    vigente_hasta: "",
    motivo: "  Cámara de congelados  ",
  });
  assert.deepEqual(datos, { ids: [ANA, LUIS], vigente_desde: "2026-10-01", vigente_hasta: null, motivo: "Cámara de congelados" });
  assert.deepEqual(campos(() => validarAsignacion({})), ["ids_empleado", "vigente_desde"]);
  assert.deepEqual(
    campos(() => validarAsignacion({ ids_empleado: ["x"], vigente_desde: "2026-10-05", vigente_hasta: "2026-10-01" })),
    ["ids_empleado", "vigente_hasta"]
  );
  assert.deepEqual(campos(() => validarAsignacion({ ids_empleado: [ANA], vigente_desde: "2026-10-05", motivo: "x".repeat(251) })), [
    "motivo",
  ]);
});

test("fin de asignación: fecha posterior al inicio o null para dejarla abierta", () => {
  assert.equal(validarCambioFin({ vigente_hasta: "2026-10-31" }, "2026-10-01"), "2026-10-31");
  assert.equal(validarCambioFin({ vigente_hasta: null }, "2026-10-01"), null);
  assert.deepEqual(campos(() => validarCambioFin({}, "2026-10-01")), ["vigente_hasta"]);
  assert.deepEqual(campos(() => validarCambioFin({ vigente_hasta: "2026-09-30" }, "2026-10-01")), ["vigente_hasta"]);
});

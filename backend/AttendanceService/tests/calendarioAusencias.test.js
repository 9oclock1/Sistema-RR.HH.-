// KAN-55 (RF-35): reglas puras del calendario consolidado y de la detección de baja cobertura.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  DIAS_MAXIMOS,
  UMBRAL_PREDETERMINADO,
  leerRango,
  resolverUmbral,
  validarUmbral,
  calcularDias,
} = require("../src/utils/calendarioAusencias");

const SUC = "11111111-1111-4111-8111-111111111111";
const PAN = "22222222-2222-4222-8222-222222222222";
const CAJ = "33333333-3333-4333-8333-333333333333";

const persona = (id, area = PAN, activo = true) => ({ id_empleado: id, id_departamento: area, area: area === PAN ? "Panadería" : "Cajas", activo });
const ausencia = (id, inicio, fin, tipo = "VACACIONES") => ({
  empleado: { id_empleado: id },
  tipo: { codigo: tipo },
  fecha_inicio: inicio,
  fecha_fin: fin,
});

test("el rango por defecto es el mes en curso", () => {
  assert.deepEqual(leerRango({}, "2026-11-18"), { desde: "2026-11-01", hasta: "2026-11-30" });
  assert.deepEqual(leerRango({}, "2028-02-10"), { desde: "2028-02-01", hasta: "2028-02-29" });
});

test("acepta el rango semanal o diario y rechaza fechas inválidas o rangos excesivos", () => {
  assert.deepEqual(leerRango({ desde: "2026-11-02", hasta: "2026-11-08" }, "2026-11-18"), { desde: "2026-11-02", hasta: "2026-11-08" });
  assert.deepEqual(leerRango({ desde: "2026-11-02", hasta: "2026-11-02" }, "2026-11-18"), { desde: "2026-11-02", hasta: "2026-11-02" });
  assert.throws(() => leerRango({ desde: "2026-13-01" }, "2026-11-18"), (e) => e.estado === 400 && e.detalles[0].campo === "desde");
  assert.throws(() => leerRango({ desde: "2026-11-10", hasta: "2026-11-01" }, "2026-11-18"), (e) => e.estado === 400);
  assert.throws(() => leerRango({ desde: "2026-01-01", hasta: "2026-12-31" }, "2026-11-18"), (e) => e.detalles[0].campo === "hasta");
  assert.equal(DIAS_MAXIMOS, 92);
});

test("el umbral más específico gana: sucursal y área, área, sucursal, general y predeterminado", () => {
  const umbrales = [
    { id_sucursal: null, id_departamento: null, max_ausentes_porcentaje: 50, min_presentes: 1 },
    { id_sucursal: SUC, id_departamento: null, max_ausentes_porcentaje: 40, min_presentes: 2 },
    { id_sucursal: null, id_departamento: PAN, max_ausentes_porcentaje: 30, min_presentes: 3 },
    { id_sucursal: SUC, id_departamento: PAN, max_ausentes_porcentaje: 20, min_presentes: 4 },
  ];
  assert.equal(resolverUmbral(umbrales, SUC, PAN).origen, "SUCURSAL_Y_AREA");
  assert.equal(resolverUmbral(umbrales, SUC, PAN).max_ausentes_porcentaje, 20);
  assert.equal(resolverUmbral(umbrales, "otra", PAN).origen, "AREA");
  assert.equal(resolverUmbral(umbrales, SUC, CAJ).origen, "SUCURSAL");
  assert.equal(resolverUmbral(umbrales, "otra", CAJ).origen, "GENERAL");
  assert.deepEqual(resolverUmbral([], SUC, PAN), { ...UMBRAL_PREDETERMINADO, origen: "PREDETERMINADO" });
});

test("valida el umbral: porcentaje entero de 1 a 100 y mínimo de personas no negativo", () => {
  assert.deepEqual(validarUmbral({ id_departamento: PAN, max_ausentes_porcentaje: "25", min_presentes: 2 }), {
    idSucursal: null,
    idDepartamento: PAN,
    maxAusentesPorcentaje: 25,
    minPresentes: 2,
  });
  assert.equal(validarUmbral({ max_ausentes_porcentaje: 30 }).minPresentes, UMBRAL_PREDETERMINADO.min_presentes);
  for (const malo of [0, 101, 12.5, "abc", undefined]) {
    assert.throws(() => validarUmbral({ max_ausentes_porcentaje: malo }), (e) => e.estado === 400 && e.detalles[0].campo === "max_ausentes_porcentaje");
  }
  assert.throws(() => validarUmbral({ max_ausentes_porcentaje: 30, min_presentes: -1 }), (e) => e.detalles[0].campo === "min_presentes");
  assert.throws(() => validarUmbral({ max_ausentes_porcentaje: 30, id_sucursal: "x" }), (e) => e.detalles[0].campo === "id_sucursal");
});

// Lunes 2 a viernes 6 de noviembre de 2026 (sin feriados), equipo de 5 en panadería.
const EQUIPO = ["a", "b", "c", "d", "e"].map((id) => persona(id));
const base = { desde: "2026-11-02", hasta: "2026-11-08", idSucursal: SUC, personal: EQUIPO, ausencias: [], turnos: [], feriados: [], umbrales: [] };

test("sin ausencias no hay alertas y el fin de semana no es laborable", () => {
  const dias = calcularDias(base);
  assert.equal(dias.length, 7);
  assert.ok(dias.every((d) => !d.baja_cobertura && d.ausentes === 0));
  assert.deepEqual(dias.map((d) => d.laborable), [true, true, true, true, true, false, false]);
});

test("criterio 3: una ausencia por encima del porcentaje tolerado da alerta de baja cobertura solo esos días", () => {
  // 2 de 5 = 40 % > 30 % el martes y el miércoles.
  const dias = calcularDias({ ...base, ausencias: [ausencia("a", "2026-11-03", "2026-11-04"), ausencia("b", "2026-11-03", "2026-11-04", "MEDICA")] });
  assert.deepEqual(dias.map((d) => d.baja_cobertura), [false, true, true, false, false, false, false]);
  const alerta = dias[1].alertas[0];
  assert.equal(alerta.id_departamento, PAN);
  assert.equal(alerta.area, "Panadería");
  assert.equal(alerta.ausentes, 2);
  assert.equal(alerta.presentes, 3);
  assert.equal(alerta.programados, 5);
  assert.equal(alerta.porcentaje_ausentes, 40);
  assert.deepEqual(alerta.motivos, ["PORCENTAJE"]);
  assert.equal(dias[1].ausentes, 2);
});

test("una ausencia dentro del umbral no genera alerta", () => {
  // 1 de 5 = 20 %.
  const dias = calcularDias({ ...base, ausencias: [ausencia("a", "2026-11-03", "2026-11-03")] });
  assert.equal(dias[1].ausentes, 1);
  assert.equal(dias[1].baja_cobertura, false);
});

test("el porcentaje justo en el umbral se tolera; solo lo supera da alerta", () => {
  const equipo10 = Array.from({ length: 10 }, (_, i) => persona(`e${i}`));
  const tres = ["e0", "e1", "e2"].map((id) => ausencia(id, "2026-11-03", "2026-11-03"));
  const cuatro = [...tres, ausencia("e3", "2026-11-03", "2026-11-03")];
  assert.equal(calcularDias({ ...base, personal: equipo10, ausencias: tres })[1].baja_cobertura, false);
  assert.equal(calcularDias({ ...base, personal: equipo10, ausencias: cuatro })[1].baja_cobertura, true);
});

test("el mínimo de presentes dispara la alerta aunque el porcentaje sea tolerable", () => {
  const umbrales = [{ id_sucursal: null, id_departamento: PAN, max_ausentes_porcentaje: 100, min_presentes: 4 }];
  const dias = calcularDias({ ...base, umbrales, ausencias: [ausencia("a", "2026-11-03", "2026-11-03"), ausencia("b", "2026-11-03", "2026-11-03")] });
  assert.deepEqual(dias[1].alertas[0].motivos, ["MINIMO_PRESENTES"]);
});

test("el umbral configurado para el área reemplaza al predeterminado", () => {
  const umbrales = [{ id_sucursal: SUC, id_departamento: PAN, max_ausentes_porcentaje: 10, min_presentes: 0 }];
  const dias = calcularDias({ ...base, umbrales, ausencias: [ausencia("a", "2026-11-03", "2026-11-03")] });
  assert.equal(dias[1].baja_cobertura, true);
  assert.equal(dias[1].alertas[0].max_ausentes_porcentaje, 10);
});

test("las áreas se evalúan por separado", () => {
  const personal = [...EQUIPO, persona("x", CAJ), persona("y", CAJ), persona("z", CAJ), persona("w", CAJ)];
  // Panadería: 1 de 5 (20 %). Cajas: 2 de 4 (50 %).
  const dias = calcularDias({
    ...base,
    personal,
    ausencias: [ausencia("a", "2026-11-03", "2026-11-03"), ausencia("x", "2026-11-03", "2026-11-03"), ausencia("y", "2026-11-03", "2026-11-03")],
  });
  assert.equal(dias[1].alertas.length, 1);
  assert.equal(dias[1].alertas[0].id_departamento, CAJ);
  assert.equal(dias[1].ausentes, 3);
});

test("un empleado inactivo no cuenta en el equipo", () => {
  const personal = [...EQUIPO, persona("baja", PAN, false)];
  const dias = calcularDias({ ...base, personal, ausencias: [ausencia("a", "2026-11-03", "2026-11-03")] });
  assert.equal(dias[1].baja_cobertura, false);
});

test("un día de descanso publicado no cuenta como ausencia que reduzca la cobertura", () => {
  // Los dos ausentes descansan ese martes: no estaban programados, así que no restan cobertura.
  const turnos = [
    { id_empleado: "a", fecha: "2026-11-03", es_descanso: true },
    { id_empleado: "b", fecha: "2026-11-03", es_descanso: true },
  ];
  const dias = calcularDias({ ...base, turnos, ausencias: [ausencia("a", "2026-11-03", "2026-11-03"), ausencia("b", "2026-11-03", "2026-11-03")] });
  assert.equal(dias[1].baja_cobertura, false);
});

test("un turno publicado en sábado lo vuelve laborable y la ausencia ese día pesa", () => {
  const turnos = EQUIPO.slice(0, 2).map((p) => ({ id_empleado: p.id_empleado, fecha: "2026-11-07", es_descanso: false }));
  const dias = calcularDias({ ...base, turnos, ausencias: [ausencia("a", "2026-11-07", "2026-11-07")] });
  assert.equal(dias[5].laborable, true);
  // 1 de 2 programados = 50 %.
  assert.equal(dias[5].baja_cobertura, true);
  assert.equal(dias[5].alertas[0].programados, 2);
});

test("un feriado sin turno publicado no es laborable ni genera alerta", () => {
  const dias = calcularDias({
    ...base,
    feriados: [{ fecha: "2026-11-02", nombre: "Todos Santos" }],
    ausencias: [ausencia("a", "2026-11-02", "2026-11-02"), ausencia("b", "2026-11-02", "2026-11-02")],
  });
  assert.equal(dias[0].feriado, "Todos Santos");
  assert.equal(dias[0].laborable, false);
  assert.equal(dias[0].baja_cobertura, false);
});

test("una ausencia que empieza antes del rango y termina dentro se cuenta desde el primer día", () => {
  const dias = calcularDias({ ...base, ausencias: [ausencia("a", "2026-10-28", "2026-11-03"), ausencia("b", "2026-10-30", "2026-11-02")] });
  assert.equal(dias[0].ausentes, 2);
  assert.equal(dias[1].ausentes, 1);
  assert.equal(dias[2].ausentes, 0);
});

test("sin personal activo solo marca los días laborables del calendario", () => {
  const dias = calcularDias({ ...base, personal: [] });
  assert.deepEqual(dias.map((d) => d.laborable), [true, true, true, true, true, false, false]);
  assert.ok(dias.every((d) => d.alertas.length === 0));
});

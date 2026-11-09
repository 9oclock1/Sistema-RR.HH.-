const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  diasEnComun,
  rangoPlanilla,
  tramoSinConsolidar,
  validarResponsable,
  contratoDelMes,
  diasDeLicencia,
  consolidarPlanilla,
} = require("../src/utils/planillas");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const EVA = "0d3f5a4e-6a59-4a39-9a43-1f1e7e1c2b11";
const OCTUBRE = { desde: "2026-10-01", hasta: "2026-10-31", dias: 31, datos_hasta: "2026-10-31", en_curso: false };

const version = (id, haber, desde, hasta = null, empleado = ANA) => ({
  id_contrato: id,
  id_empleado: empleado,
  numero_contrato: `CT-${id}`,
  haber_mensual_pactado: haber,
  vigente_desde: desde,
  vigente_hasta: hasta,
});

const estado = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.estado;
  }
  return null;
};

test("diasEnComun cuenta los días que se cruzan, con fin abierto", () => {
  assert.equal(diasEnComun("2026-09-20", "2026-10-05", "2026-10-01", "2026-10-31"), 5);
  assert.equal(diasEnComun("2026-10-10", null, "2026-10-01", "2026-10-31"), 22);
  assert.equal(diasEnComun("2026-11-01", null, "2026-10-01", "2026-10-31"), 0);
});

test("rangoPlanilla: mes cerrado, mes en curso hasta ayer, primer día del mes y mes futuro", () => {
  assert.deepEqual(rangoPlanilla("2026-10", "2026-11-07"), { ...OCTUBRE });
  const enCurso = rangoPlanilla("2026-11", "2026-11-07");
  assert.equal(enCurso.datos_hasta, "2026-11-06");
  assert.equal(enCurso.en_curso, true);
  assert.equal(estado(() => rangoPlanilla("2026-11", "2026-11-01")), 409);
  assert.equal(estado(() => rangoPlanilla("2026-12", "2026-11-07")), 400);
  assert.equal(estado(() => rangoPlanilla("2026-13", "2026-11-07")), 400);
  assert.equal(estado(() => rangoPlanilla(undefined, "2026-11-07")), 400);
});

test("tramoSinConsolidar: cubierto, hueco al inicio, en medio y al final", () => {
  const p = (a, b) => ({ fecha_inicio: a, fecha_fin: b });
  assert.equal(tramoSinConsolidar([p("2026-09-25", "2026-10-15"), p("2026-10-16", "2026-11-02")], "2026-10-01", "2026-10-31"), null);
  assert.deepEqual(tramoSinConsolidar([], "2026-10-01", "2026-10-31"), { desde: "2026-10-01", hasta: "2026-10-31" });
  assert.deepEqual(tramoSinConsolidar([p("2026-10-05", "2026-10-31")], "2026-10-01", "2026-10-31"), {
    desde: "2026-10-01",
    hasta: "2026-10-04",
  });
  assert.deepEqual(tramoSinConsolidar([p("2026-10-16", "2026-10-31"), p("2026-10-01", "2026-10-10")], "2026-10-01", "2026-10-31"), {
    desde: "2026-10-11",
    hasta: "2026-10-15",
  });
  assert.deepEqual(tramoSinConsolidar([p("2026-10-01", "2026-10-20")], "2026-10-01", "2026-10-31"), {
    desde: "2026-10-21",
    hasta: "2026-10-31",
  });
});

test("validarResponsable: solo el administrador con un usuario válido", () => {
  assert.equal(validarResponsable({ idEmpleado: ANA.toUpperCase(), rol: "Admin" }), ANA);
  assert.equal(estado(() => validarResponsable({ idEmpleado: ANA, rol: "gerente" })), 403);
  assert.equal(estado(() => validarResponsable({ idEmpleado: ANA })), 403);
  assert.equal(estado(() => validarResponsable({ rol: "admin" })), 401);
  assert.equal(estado(() => validarResponsable({ idEmpleado: "abc", rol: "admin" })), 401);
});

test("contratoDelMes: mes completo son 30 días aunque el mes tenga 31", () => {
  const c = contratoDelMes([version("a", 4000, "2025-01-01")], OCTUBRE);
  assert.equal(c.dias_contrato, 30);
  assert.equal(c.haber_mensual, 4000);
  assert.equal(c.contrato_desde, "2026-10-01");
  assert.equal(c.contrato_hasta, "2026-10-31");
});

test("contratoDelMes: ingreso o salida en el mes cuenta los días cubiertos", () => {
  assert.equal(contratoDelMes([version("a", 4000, "2026-10-21")], OCTUBRE).dias_contrato, 11);
  const sale = contratoDelMes([version("a", 4000, "2025-01-01", "2026-10-10")], OCTUBRE);
  assert.equal(sale.dias_contrato, 10);
  assert.equal(sale.contrato_hasta, "2026-10-10");
  assert.equal(contratoDelMes([version("a", 4000, "2026-11-01")], OCTUBRE), null);
  assert.equal(contratoDelMes([version("a", 4000, "2025-01-01", "2026-09-30")], OCTUBRE), null);
  const febrero = { desde: "2027-02-01", hasta: "2027-02-28", dias: 28 };
  assert.equal(contratoDelMes([version("a", 4000, "2026-01-01")], febrero).dias_contrato, 30);
});

test("contratoDelMes: un ajuste salarial en el mes promedia el haber por días y toma la última versión", () => {
  const c = contratoDelMes([version("b", 4600, "2026-10-17"), version("a", 4000, "2025-01-01", "2026-10-16")], OCTUBRE);
  assert.equal(c.id_contrato, "b");
  assert.equal(c.haber_mensual, Math.round(((4000 * 16 + 4600 * 15) / 31) * 100) / 100);
  assert.deepEqual(c.haberes, [4000, 4600]);
  assert.equal(c.dias_contrato, 30);
});

test("diasDeLicencia: separa con y sin goce dentro del contrato", () => {
  const contrato = { contrato_desde: "2026-10-01", contrato_hasta: "2026-10-31" };
  const dias = diasDeLicencia(
    [
      { fecha_inicio: "2026-09-29", fecha_fin: "2026-10-02", con_goce_haberes: true },
      { fecha_inicio: "2026-10-20", fecha_fin: "2026-10-21", con_goce_haberes: false },
      { fecha_inicio: "2026-10-31", fecha_fin: "2026-11-03", con_goce_haberes: false },
    ],
    contrato
  );
  assert.deepEqual(dias, { con_goce: 2, sin_goce: 3 });
});

const personal = [
  { id_empleado: ANA, nombre_completo: "Ana Pérez", cargo: "Cajera", area: "Cajas", sucursal: "Centro", activo: true },
  { id_empleado: LUIS.toUpperCase(), nombre_completo: "Luis Rojas", cargo: "Reponedor", area: "Congelados", sucursal: "Centro", activo: true },
  { id_empleado: EVA, nombre_completo: "Eva Soto", activo: true },
];

const bono = (empleado, extra = {}) => ({
  empleado: { id_empleado: empleado },
  condicion: { codigo: "TN-1", nombre: "Bono por trasnoche", forma_calculo: "MONTO_FIJO" },
  origen: "DETECCION",
  id_vigencia: "v-1",
  cantidad: 2,
  fechas: ["2026-10-05", "2026-10-06"],
  factor: 2,
  valor: 50,
  monto: 100,
  ...extra,
});

const datos = (extra = {}) => ({
  personal,
  contratos: [version("a", 4000, "2025-01-01"), version("l", 3100, "2026-10-21", null, LUIS)],
  asistencia: [
    { empleado: { id_empleado: ANA }, faltas_injustificadas: 2, atrasos: 3, minutos_retraso: 25 },
    { empleado: { id_empleado: LUIS }, faltas_injustificadas: 0, atrasos: 0, minutos_retraso: 0 },
  ],
  horasExtra: [{ empleado: { id_empleado: ANA }, minutos_extra_habil: 120, minutos_extra_feriado: 60, minutos_nocturnos: 450 }],
  licencias: [{ id_empleado: ANA, fecha_inicio: "2026-10-20", fecha_fin: "2026-10-20", con_goce_haberes: false }],
  bonos: [bono(ANA)],
  ...extra,
});

test("consolidarPlanilla: una fila por colaborador con contrato, con días, atrasos, horas y bonos", () => {
  const { empleados, advertencias } = consolidarPlanilla(datos(), OCTUBRE);
  assert.deepEqual(
    empleados.map((e) => e.nombre_empleado),
    ["Ana Pérez", "Luis Rojas"]
  );
  const ana = empleados[0];
  assert.equal(ana.dias_contrato, 30);
  assert.equal(ana.faltas_injustificadas, 2);
  assert.equal(ana.dias_licencia_sin_goce, 1);
  assert.equal(ana.dias_pagados, 27);
  assert.equal(ana.atrasos, 3);
  assert.equal(ana.minutos_atraso, 25);
  assert.equal(ana.minutos_extra_habil, 120);
  assert.equal(ana.minutos_extra_feriado, 60);
  assert.equal(ana.minutos_extra_domingo, 0);
  assert.equal(ana.minutos_nocturnos, 450);
  assert.equal(ana.novedades.length, 1);
  assert.deepEqual(ana.novedades[0], {
    origen: "BONO_CONDICION",
    id_vigencia: "v-1",
    codigo: "TN-1",
    nombre: "Bono por trasnoche",
    forma_calculo: "MONTO_FIJO",
    cantidad: 2,
    factor: 2,
    valor: 50,
    monto: 100,
    detalle: "2 jornadas: 05/10, 06/10",
  });
  assert.match(ana.observaciones.join(" "), /1 día de licencia sin goce/);

  const luis = empleados[1];
  assert.equal(luis.id_empleado, LUIS);
  assert.equal(luis.dias_contrato, 11);
  assert.equal(luis.dias_pagados, 11);
  assert.deepEqual(luis.observaciones, ["Contrato desde el 21/10."]);
  assert.match(advertencias.join(" "), /1 colaborador activo no tiene contrato en el mes y no se incluye: Eva Soto/);
});

test("consolidarPlanilla: horas extra o bonos de quien no tiene contrato se advierten", () => {
  const { advertencias } = consolidarPlanilla(
    datos({ bonos: [bono(EVA)], horasExtra: [{ empleado: { id_empleado: EVA }, minutos_extra_habil: 30 }] }),
    OCTUBRE
  );
  assert.match(advertencias.join(" "), /1 colaborador sin contrato en el mes tiene horas extra o bonos/);
});

test("consolidarPlanilla: días pagados no bajan de cero y el mes en curso se advierte", () => {
  const enCurso = { ...OCTUBRE, datos_hasta: "2026-10-20", en_curso: true };
  const { empleados, advertencias } = consolidarPlanilla(
    datos({ asistencia: [{ empleado: { id_empleado: ANA }, faltas_injustificadas: 40, atrasos: 0, minutos_retraso: 0 }] }),
    enCurso
  );
  assert.equal(empleados[0].dias_pagados, 0);
  assert.match(advertencias[0], /Mes en curso: incluye datos hasta el 20\/10/);
});

test("consolidarPlanilla: bono asignado y porcentaje sin monto", () => {
  const asignado = bono(ANA, {
    origen: "ASIGNACION",
    fechas: [],
    cantidad: 11,
    condicion: { codigo: "CG-1", nombre: "Bono congelados", forma_calculo: "PORCENTAJE" },
    monto: null,
  });
  const { empleados } = consolidarPlanilla(datos({ bonos: [asignado] }), OCTUBRE);
  assert.equal(empleados[0].novedades[0].detalle, "11 días asignados");
  assert.equal(empleados[0].novedades[0].monto, null);
});

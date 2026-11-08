const { test } = require("node:test");
const assert = require("node:assert/strict");
const { antiguedadDelColaborador, calcularEmpleado, validarConsistencia, dosDecimales } = require("../src/utils/calculo");

const concepto = (codigo, tipo, valor, extra = {}) => ({
  id_concepto: `c-${codigo}`,
  codigo,
  nombre: codigo,
  tipo,
  forma_calculo: "PORCENTAJE",
  base_calculo: "TOTAL_GANADO",
  id_vigencia: `v-${codigo}`,
  valor,
  es_condicion: false,
  ...extra,
});
const sobreHaber = { base_calculo: "HABER_BASICO" };
const fijo = { forma_calculo: "MONTO_FIJO", base_calculo: null };

// Conceptos sembrados en init.sql (KAN-62 y KAN-64).
const DE_LEY = [
  concepto("HABER-BASICO", "INGRESO", 100, sobreHaber),
  concepto("HORAS-EXTRA", "INGRESO", 100, sobreHaber),
  concepto("DOMINICAL", "INGRESO", 100, sobreHaber),
  concepto("RECARGO-NOCTURNO", "INGRESO", 25, sobreHaber),
  concepto("SIP-VEJEZ", "DESCUENTO", 10),
  concepto("SIP-RIESGO", "DESCUENTO", 1.71),
  concepto("SIP-COMISION", "DESCUENTO", 0.5),
  concepto("SIP-SOLIDARIO", "DESCUENTO", 0.5),
  concepto("ANS-13000", "DESCUENTO", 1),
  concepto("ANS-25000", "DESCUENTO", 5),
  concepto("ANS-35000", "DESCUENTO", 10),
  concepto("CNS-SALUD", "APORTE", 10),
  concepto("SIP-RIESGO-PROF", "APORTE", 1.71),
  concepto("PRO-VIVIENDA", "APORTE", 2),
  concepto("SIP-SOLIDARIO-PAT", "APORTE", 3),
];

const fila = (extra = {}) => ({
  haber_mensual: 4000,
  dias_pagados: 30,
  minutos_extra_habil: 0,
  minutos_extra_domingo: 0,
  minutos_extra_feriado: 0,
  minutos_domingo: 0,
  minutos_feriado: 0,
  minutos_descanso: 0,
  minutos_nocturnos: 0,
  novedades: [],
  ...extra,
});
const de = (resultado, codigo) => resultado.renglones.find((r) => r.codigo === codigo);

test("mes completo: haber básico, aportes laborales de 12,71 % y aportes patronales aparte", () => {
  const r = calcularEmpleado(fila(), DE_LEY);
  assert.equal(de(r, "HABER-BASICO").resultado, 4000);
  assert.equal(r.total_ganado, 4000);
  assert.equal(r.total_descuentos, 508.4);
  assert.equal(r.liquido_pagable, 3491.6);
  assert.equal(r.total_aportes, 668.4);
  assert.deepEqual(r.alertas, []);
  assert.equal(de(r, "ANS-13000"), undefined);
});

test("días pagados: el haber básico se prorratea sobre 30 y los porcentajes van sobre el total ganado", () => {
  const r = calcularEmpleado(fila({ haber_mensual: 3100, dias_pagados: 11 }), DE_LEY);
  assert.equal(de(r, "HABER-BASICO").resultado, 1136.67);
  assert.equal(de(r, "HABER-BASICO").cantidad, 11);
  assert.equal(de(r, "SIP-VEJEZ").base, 1136.67);
  assert.equal(de(r, "SIP-VEJEZ").resultado, 113.67);
});

test("horas extra con 100 % de recargo, dominicales y recargo nocturno sobre el valor de la hora (haber / 240)", () => {
  const r = calcularEmpleado(
    fila({ haber_mensual: 4800, minutos_extra_habil: 90, minutos_extra_feriado: 30, minutos_domingo: 480, minutos_nocturnos: 450 }),
    DE_LEY
  );
  // valor hora = 20
  assert.equal(de(r, "HORAS-EXTRA").resultado, 80);
  assert.equal(de(r, "HORAS-EXTRA").cantidad, 2);
  assert.equal(de(r, "HORAS-EXTRA").base, 20);
  assert.equal(de(r, "DOMINICAL").resultado, 160);
  assert.equal(de(r, "RECARGO-NOCTURNO").resultado, 37.5);
  assert.equal(r.total_ganado, 4800 + 80 + 160 + 37.5);
});

test("bonos por condiciones especiales: monto fijo tal cual y porcentaje del haber por su factor", () => {
  const novedades = [
    { codigo: "TN", nombre: "Trasnoche", forma_calculo: "MONTO_FIJO", id_vigencia: "v-tn", cantidad: 3, factor: 3, valor: 50, monto: 150, detalle: "3 jornadas" },
    { codigo: "CG", nombre: "Congelados", forma_calculo: "PORCENTAJE", id_vigencia: "v-cg", cantidad: 11, factor: 11 / 31, valor: 10, monto: null, detalle: "11 días asignados" },
  ];
  const r = calcularEmpleado(fila({ haber_mensual: 3100, novedades }), DE_LEY);
  assert.equal(de(r, "TN").resultado, 150);
  assert.equal(de(r, "TN").tipo, "INGRESO");
  assert.equal(de(r, "CG").resultado, 110);
  assert.equal(r.total_ganado, 3100 + 150 + 110);
});

test("los conceptos de condiciones especiales no se aplican a todos: llegan como bonos", () => {
  const conCondicion = [...DE_LEY, concepto("TN", "INGRESO", 50, { ...fijo, es_condicion: true })];
  assert.equal(de(calcularEmpleado(fila(), conCondicion), "TN"), undefined);
});

test("conceptos generales: ingreso fijo por días pagados, descuento fijo completo y porcentaje sobre el haber ganado", () => {
  const generales = [
    ...DE_LEY,
    concepto("TRANSPORTE", "INGRESO", 300, fijo),
    concepto("SINDICATO", "DESCUENTO", 25, fijo),
    concepto("FONDO", "DESCUENTO", 1, sobreHaber),
  ];
  const r = calcularEmpleado(fila({ dias_pagados: 15 }), generales);
  assert.equal(de(r, "TRANSPORTE").resultado, 150);
  assert.equal(de(r, "SINDICATO").resultado, 25);
  assert.equal(de(r, "FONDO").base, 2000);
  assert.equal(de(r, "FONDO").resultado, 20);
  assert.equal(r.total_ganado, 2150);
});

test("un ingreso en porcentaje del total ganado se toma sobre los ingresos anteriores", () => {
  const r = calcularEmpleado(fila(), [...DE_LEY, concepto("PRODUCTIVIDAD", "INGRESO", 5)]);
  assert.equal(de(r, "PRODUCTIVIDAD").base, 4000);
  assert.equal(de(r, "PRODUCTIVIDAD").resultado, 200);
});

test("Aporte Nacional Solidario: cada tramo sobre lo que supera su umbral", () => {
  const r = calcularEmpleado(fila({ haber_mensual: 40000 }), DE_LEY);
  assert.equal(de(r, "ANS-13000").base, 27000);
  assert.equal(de(r, "ANS-13000").resultado, 270);
  assert.equal(de(r, "ANS-25000").resultado, 750);
  assert.equal(de(r, "ANS-35000").resultado, 500);
  const medio = calcularEmpleado(fila({ haber_mensual: 20000 }), DE_LEY);
  assert.equal(de(medio, "ANS-13000").resultado, 70);
  assert.equal(de(medio, "ANS-25000"), undefined);
});

test("redondeo: cada renglón a centavos y los totales son la suma de los renglones", () => {
  assert.equal(dosDecimales(0.005), 0.01);
  assert.equal(dosDecimales(1.005), 1.01);
  const r = calcularEmpleado(fila({ haber_mensual: 3333.33, dias_pagados: 7 }), DE_LEY);
  const suma = (tipo) => Math.round(r.renglones.filter((x) => x.tipo === tipo).reduce((t, x) => t + x.resultado * 100, 0)) / 100;
  assert.equal(r.total_ganado, suma("INGRESO"));
  assert.equal(r.total_descuentos, suma("DESCUENTO"));
  assert.equal(r.liquido_pagable, Math.round((r.total_ganado - r.total_descuentos) * 100) / 100);
  assert.ok(r.renglones.every((x) => Number.isInteger(Math.round(x.resultado * 100)) && x.resultado === dosDecimales(x.resultado)));
});

test("cero días pagados: haber en cero, sin descuentos en porcentaje y sin alertas", () => {
  const r = calcularEmpleado(fila({ dias_pagados: 0 }), DE_LEY);
  assert.equal(de(r, "HABER-BASICO").resultado, 0);
  assert.equal(r.total_ganado, 0);
  assert.equal(r.liquido_pagable, 0);
  assert.deepEqual(r.alertas, []);
  assert.equal(de(r, "SIP-VEJEZ"), undefined);
});

test("criterio 3: líquido negativo marca una alerta", () => {
  const r = calcularEmpleado(fila({ dias_pagados: 1 }), [...DE_LEY, concepto("PRESTAMO", "DESCUENTO", 500, fijo)]);
  assert.ok(r.liquido_pagable < 0);
  assert.match(r.alertas.join(" "), /líquido pagable es negativo/);
});

test("criterio 3: falta un concepto de cálculo → alerta (y total ganado en cero con días pagados)", () => {
  const sinHaber = DE_LEY.filter((c) => c.codigo !== "HABER-BASICO");
  const r = calcularEmpleado(fila(), sinHaber);
  assert.match(r.alertas.join(" "), /Falta el concepto HABER-BASICO/);
  assert.match(r.alertas.join(" "), /total ganado es cero aunque tiene 30 días pagados/);
  const sinExtra = calcularEmpleado(fila({ minutos_extra_habil: 60 }), DE_LEY.filter((c) => c.codigo !== "HORAS-EXTRA"));
  assert.match(sinExtra.alertas.join(" "), /Falta el concepto HORAS-EXTRA/);
  assert.deepEqual(calcularEmpleado(fila(), DE_LEY.filter((c) => c.codigo !== "HORAS-EXTRA")).alertas, []);
});

test("criterio 3: totales que no cuadran con el detalle", () => {
  const r = calcularEmpleado(fila(), DE_LEY);
  assert.deepEqual(validarConsistencia(r, fila()), []);
  assert.match(validarConsistencia({ ...r, total_ganado: r.total_ganado + 0.01 }, fila()).join(" "), /no cuadran/);
  assert.match(validarConsistencia({ ...r, liquido_pagable: r.liquido_pagable - 1 }, fila()).join(" "), /no cuadran/);
});

test("criterio 4: cada renglón lleva su vigencia, base, valor, resultado y orden", () => {
  const r = calcularEmpleado(fila({ minutos_extra_habil: 60 }), DE_LEY);
  const vejez = de(r, "SIP-VEJEZ");
  assert.deepEqual(
    { id_vigencia: vejez.id_vigencia, tipo: vejez.tipo, base: vejez.base, valor: vejez.valor, resultado: vejez.resultado },
    { id_vigencia: "v-SIP-VEJEZ", tipo: "DESCUENTO", base: r.total_ganado, valor: 10, resultado: dosDecimales(r.total_ganado * 0.1) }
  );
  assert.deepEqual(r.renglones.map((x) => x.orden), r.renglones.map((_, i) => i + 1));
  assert.equal(r.renglones[0].codigo, "HABER-BASICO");
});

const ESCALA = {
  tramos: [
    { anios_desde: 2, anios_hasta: 4, porcentaje: 5 },
    { anios_desde: 5, anios_hasta: 7, porcentaje: 11 },
    { anios_desde: 8, anios_hasta: null, porcentaje: 18 },
  ],
};

test("antigüedad: años al día 1 del mes y porcentaje del tramo de la escala vigente", () => {
  assert.deepEqual(antiguedadDelColaborador(ESCALA, "2018-02-01", "2026-01-01"), { anios: 7, porcentaje: 11 });
  assert.deepEqual(antiguedadDelColaborador(ESCALA, "2018-02-01", "2026-02-01"), { anios: 8, porcentaje: 18 });
  assert.deepEqual(antiguedadDelColaborador(ESCALA, "2025-03-01", "2026-11-01"), { anios: 1, porcentaje: null });
});

test("antigüedad: sin escala vigente o sin fecha de ingreso → alerta", () => {
  assert.match(antiguedadDelColaborador(null, "2018-02-01", "2026-11-01").alerta, /escala de antigüedad/);
  assert.match(antiguedadDelColaborador(ESCALA, null, "2026-11-01").alerta, /fecha de ingreso/);
  const r = calcularEmpleado(fila({ antiguedad: antiguedadDelColaborador(null, "2018-02-01", "2026-11-01") }), DE_LEY);
  assert.equal(de(r, "BONO-ANTIGUEDAD"), undefined);
  assert.match(r.alertas.join(" "), /bono de antigüedad/);
});

test("criterio 1: el bono de antigüedad suma al total ganado y los aportes van sobre ese total", () => {
  const r = calcularEmpleado(fila({ antiguedad: { anios: 8, porcentaje: 18 } }), DE_LEY);
  const bono = de(r, "BONO-ANTIGUEDAD");
  assert.deepEqual(
    { tipo: bono.tipo, id_vigencia: bono.id_vigencia, base: bono.base, valor: bono.valor, resultado: bono.resultado },
    { tipo: "INGRESO", id_vigencia: null, base: 4000, valor: 18, resultado: 720 }
  );
  assert.equal(r.total_ganado, 4720);
  assert.equal(de(r, "SIP-VEJEZ").base, 4720);
  assert.equal(r.renglones[1].codigo, "BONO-ANTIGUEDAD");
  assert.deepEqual(r.alertas, []);
});

test("criterio 1: el bono de antigüedad se prorratea por los días pagados", () => {
  const r = calcularEmpleado(fila({ dias_pagados: 27, antiguedad: { anios: 3, porcentaje: 5 } }), DE_LEY);
  assert.equal(de(r, "BONO-ANTIGUEDAD").resultado, 180);
});

test("criterio 1: por debajo del primer tramo no hay bono ni alerta", () => {
  const r = calcularEmpleado(fila({ antiguedad: { anios: 1, porcentaje: null } }), DE_LEY);
  assert.equal(de(r, "BONO-ANTIGUEDAD"), undefined);
  assert.deepEqual(r.alertas, []);
});

test("criterio 2: las cuotas de préstamos y anticipos del mes se descuentan por su monto", () => {
  const cuotas = [
    { tipo: "PRESTAMO", numero_cuota: 2, monto: 333.33 },
    { tipo: "ANTICIPO", numero_cuota: 1, monto: 200 },
  ];
  const r = calcularEmpleado(fila({ cuotas }), DE_LEY);
  const renglones = r.renglones.filter((x) => x.codigo === "CUOTA-PRESTAMO");
  assert.deepEqual(
    renglones.map((x) => [x.tipo, x.nombre, x.forma_calculo, x.id_vigencia, x.resultado]),
    [
      ["DESCUENTO", "Cuota de préstamo", "MONTO_FIJO", null, 333.33],
      ["DESCUENTO", "Cuota de anticipo de sueldo", "MONTO_FIJO", null, 200],
    ]
  );
  assert.equal(de(r, "SIP-VEJEZ").base, 4000);
  assert.equal(r.total_descuentos, 1041.73);
  assert.equal(r.liquido_pagable, 2958.27);
  assert.deepEqual(r.alertas, []);
});

test("criterio 3: una cuota mayor al líquido deja el líquido negativo y marca alerta", () => {
  const r = calcularEmpleado(fila({ cuotas: [{ tipo: "PRESTAMO", numero_cuota: 1, monto: 5000 }] }), DE_LEY);
  assert.ok(r.liquido_pagable < 0);
  assert.match(r.alertas.join(" "), /negativo/);
});

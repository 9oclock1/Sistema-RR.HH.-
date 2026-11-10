const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validarIdEmpleado,
  validarFiltros,
  validarTipoBono,
  validarFuenteHistorial,
  validarAuditor,
  claveBono,
  diffBonos,
  filaAuditoria,
  filasDeAuditoria,
  aCsv,
} = require("../src/utils/bonificaciones");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const COND_FRIO = "c0000000-0000-0000-0000-000000000001";
const VIGENCIA_1 = "v0000000-0000-0000-0000-000000000001";
const VIGENCIA_2 = "v0000000-0000-0000-0000-000000000002";
const REGLA_VENTAS = "r0000000-0000-0000-0000-000000000001";

const campos = (fn) => {
  try {
    fn();
    return [];
  } catch (error) {
    return error.detalles.map((d) => d.campo);
  }
};

const bono = (extra) => ({
  id_condicion: COND_FRIO,
  id_vigencia: VIGENCIA_1,
  id_empleado: ANA,
  nombre_empleado: "Ana Pérez",
  id_asignacion: null,
  valor: 50,
  monto: 50,
  factor: 1,
  ...extra,
});

const bonoProductividad = (extra) => ({
  id_empleado: ANA,
  nombre_empleado: "Ana Pérez",
  id_regla: REGLA_VENTAS,
  valor: 500,
  monto: 500,
  ...extra,
});

// ---- validarIdEmpleado ----

test("validarIdEmpleado acepta un UUID y lo normaliza a minúsculas", () => {
  assert.equal(validarIdEmpleado(ANA.toUpperCase()), ANA);
});

test("validarIdEmpleado rechaza un id inválido", () => {
  assert.deepEqual(campos(() => validarIdEmpleado("no-es-uuid")), ["id_empleado"]);
  assert.deepEqual(campos(() => validarIdEmpleado(undefined)), ["id_empleado"]);
});

// ---- validarFiltros / validarTipoBono ----

test("validarFiltros acepta periodo y tipo de condición válidos", () => {
  const filtros = validarFiltros({ periodo: "2026-11", tipo: "TRASNOCHE" });
  assert.deepEqual(filtros, { periodo: "2026-11", tipo: "TRASNOCHE" });
});

test("validarFiltros rechaza un periodo o un tipo inválidos", () => {
  assert.deepEqual(campos(() => validarFiltros({ periodo: "2026-13" })), ["periodo"]);
  assert.deepEqual(campos(() => validarFiltros({ tipo: "VACACIONES" })), ["tipo"]);
});

test("validarTipoBono (auditoría) acepta CONDICION y PRODUCTIVIDAD, y rechaza ANTIGUEDAD", () => {
  assert.equal(validarTipoBono("CONDICION"), "CONDICION");
  assert.equal(validarTipoBono("PRODUCTIVIDAD"), "PRODUCTIVIDAD");
  assert.equal(validarTipoBono(undefined), null);
  // ANTIGUEDAD no se audita: no se persiste por colaborador, solo aparece en el historial.
  assert.deepEqual(campos(() => validarTipoBono("ANTIGUEDAD")), ["tipo_bono"]);
});

test("validarFuenteHistorial acepta además ANTIGUEDAD, de solo lectura", () => {
  assert.equal(validarFuenteHistorial("CONDICION"), "CONDICION");
  assert.equal(validarFuenteHistorial("PRODUCTIVIDAD"), "PRODUCTIVIDAD");
  assert.equal(validarFuenteHistorial("ANTIGUEDAD"), "ANTIGUEDAD");
  assert.equal(validarFuenteHistorial(undefined), null);
  assert.deepEqual(campos(() => validarFuenteHistorial("VACACIONES")), ["tipo_bono"]);
});

// ---- validarAuditor (RBAC) ----

test("validarAuditor permite admin y auditor, y rechaza cualquier otro rol", () => {
  assert.doesNotThrow(() => validarAuditor({ rol: "admin" }));
  assert.doesNotThrow(() => validarAuditor({ rol: "Auditor" }));
  assert.throws(() => validarAuditor({ rol: "supervisor" }), (error) => error.estado === 403);
  assert.throws(() => validarAuditor({}), (error) => error.estado === 403);
});

// ---- diffBonos: altas, modificaciones y anulaciones ----

test("diffBonos detecta un alta cuando el bono no existía antes", () => {
  const cambios = diffBonos([], [bono()]);
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0].accion, "ALTA");
});

test("diffBonos no genera cambios cuando el reproceso no altera nada", () => {
  const anterior = bono();
  const nuevo = bono();
  assert.deepEqual(diffBonos([anterior], [nuevo]), []);
});

test("diffBonos detecta una modificación cuando cambia el monto", () => {
  const anterior = bono({ monto: 50 });
  const nuevo = bono({ monto: 80 });
  const cambios = diffBonos([anterior], [nuevo]);
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0].accion, "MODIFICACION");
  assert.equal(cambios[0].anterior.monto, 50);
  assert.equal(cambios[0].bono.monto, 80);
});

test("diffBonos detecta una anulación cuando el bono ya no está en el nuevo proceso", () => {
  const cambios = diffBonos([bono()], []);
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0].accion, "ANULACION");
});

test("diffBonos distingue bonos de distintos colaboradores como bonos distintos", () => {
  const deAna = bono({ id_empleado: ANA });
  const deLuis = bono({ id_empleado: LUIS });
  // Luis es nuevo, Ana sigue igual: solo un alta, ningún cambio para Ana.
  const cambios = diffBonos([deAna], [deAna, deLuis]);
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0].accion, "ALTA");
  assert.equal(cambios[0].bono.id_empleado, LUIS);
});

// Regresión (revisión del PO): una condición con una vigencia nueva es el mismo bono con otro valor, no un
// bono distinto. Antes, claveBono incluía id_vigencia y esto se registraba como ANULACION + ALTA en vez de
// una sola MODIFICACION con el valor anterior.
test("diffBonos registra una MODIFICACION, no ANULACION + ALTA, cuando solo cambia la vigencia", () => {
  const anterior = bono({ id_vigencia: VIGENCIA_1, valor: 50, monto: 50 });
  const nuevo = bono({ id_vigencia: VIGENCIA_2, valor: 80, monto: 80 });
  const cambios = diffBonos([anterior], [nuevo]);
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0].accion, "MODIFICACION");
  assert.equal(cambios[0].anterior.valor, 50);
  assert.equal(cambios[0].bono.valor, 80);
});

test("claveBono (CONDICION) no depende de id_vigencia", () => {
  const a = bono({ id_vigencia: VIGENCIA_1 });
  const b = bono({ id_vigencia: VIGENCIA_2 });
  assert.equal(claveBono(a, "CONDICION"), claveBono(b, "CONDICION"));
});

// ---- diffBonos / filaAuditoria con tipoBono PRODUCTIVIDAD (KAN-71) ----

test("claveBono (PRODUCTIVIDAD) identifica el bono por colaborador y regla, no por condición", () => {
  const a = bonoProductividad({ id_regla: REGLA_VENTAS });
  assert.equal(claveBono(a, "PRODUCTIVIDAD"), `${ANA}|${REGLA_VENTAS}`);
});

test("diffBonos (PRODUCTIVIDAD) detecta alta, modificación y anulación igual que CONDICION", () => {
  const alta = diffBonos([], [bonoProductividad()], "PRODUCTIVIDAD");
  assert.equal(alta.length, 1);
  assert.equal(alta[0].accion, "ALTA");

  const sinCambios = diffBonos([bonoProductividad()], [bonoProductividad()], "PRODUCTIVIDAD");
  assert.deepEqual(sinCambios, []);

  const modificacion = diffBonos(
    [bonoProductividad({ monto: 500 })],
    [bonoProductividad({ monto: 650 })],
    "PRODUCTIVIDAD"
  );
  assert.equal(modificacion.length, 1);
  assert.equal(modificacion[0].accion, "MODIFICACION");
  assert.equal(modificacion[0].anterior.monto, 500);
  assert.equal(modificacion[0].bono.monto, 650);

  const anulacion = diffBonos([bonoProductividad()], [], "PRODUCTIVIDAD");
  assert.equal(anulacion.length, 1);
  assert.equal(anulacion[0].accion, "ANULACION");
});

test("diffBonos (PRODUCTIVIDAD) distingue colaboradores con la misma regla", () => {
  const deAna = bonoProductividad({ id_empleado: ANA });
  const deLuis = bonoProductividad({ id_empleado: LUIS });
  const cambios = diffBonos([deAna], [deAna, deLuis], "PRODUCTIVIDAD");
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0].bono.id_empleado, LUIS);
});

test("filaAuditoria (PRODUCTIVIDAD) deja id_regla y deja nulos id_condicion/id_asignacion", () => {
  const filas = filasDeAuditoria({
    anteriores: [],
    nuevos: [bonoProductividad()],
    periodo: "2026-11",
    identidad: { idEmpleado: ANA, rol: "admin" },
    tipoBono: "PRODUCTIVIDAD",
  });
  assert.equal(filas.length, 1);
  const [fila] = filas;
  assert.equal(fila.tipo_bono, "PRODUCTIVIDAD");
  assert.equal(fila.id_regla, REGLA_VENTAS);
  assert.equal(fila.id_condicion, null);
  assert.equal(fila.id_asignacion, null);
});

test("filaAuditoria (CONDICION, por defecto) deja id_regla en null", () => {
  const filas = filasDeAuditoria({ anteriores: [], nuevos: [bono()], periodo: "2026-11", identidad: {} });
  assert.equal(filas[0].tipo_bono, "CONDICION");
  assert.equal(filas[0].id_regla, null);
  assert.equal(filas[0].id_condicion, COND_FRIO);
});

// ---- filasDeAuditoria: fila lista para insertar, con el usuario y el valor anterior ----

test("filasDeAuditoria arma una fila de alta con valor_anterior nulo y el usuario que procesó", () => {
  const filas = filasDeAuditoria({
    anteriores: [],
    nuevos: [bono()],
    periodo: "2026-11",
    identidad: { idEmpleado: ANA, rol: "admin" },
  });
  assert.equal(filas.length, 1);
  const [fila] = filas;
  assert.equal(fila.accion, "ALTA");
  assert.equal(fila.periodo, "2026-11");
  assert.equal(fila.valor_anterior, null);
  assert.equal(fila.valor_nuevo, 50);
  assert.equal(fila.realizado_por, ANA);
  assert.equal(fila.realizado_por_rol, "admin");
});

test("filasDeAuditoria arma una fila de anulación con valor_nuevo nulo", () => {
  const filas = filasDeAuditoria({ anteriores: [bono()], nuevos: [], periodo: "2026-11", identidad: {} });
  assert.equal(filas[0].accion, "ANULACION");
  assert.equal(filas[0].valor_anterior, 50);
  assert.equal(filas[0].valor_nuevo, null);
  assert.equal(filas[0].realizado_por, null);
});

test("filasDeAuditoria sin identidad deja realizado_por en null en vez de fallar", () => {
  const filas = filasDeAuditoria({ anteriores: [], nuevos: [bono()], periodo: "2026-11", identidad: undefined });
  assert.equal(filas[0].realizado_por, null);
  assert.equal(filas[0].realizado_por_rol, null);
});

// ---- aCsv ----

test("aCsv arma un CSV con BOM, separador ; y escapa comillas", () => {
  const columnas = [
    { titulo: "Nombre", valor: (f) => f.nombre },
    { titulo: "Nota", valor: (f) => f.nota },
  ];
  const csv = aCsv(columnas, [{ nombre: 'Ana "Pato"', nota: "ok; bien" }]);
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes('"Ana ""Pato"""'));
  assert.ok(csv.includes('"ok; bien"'));
  assert.ok(csv.includes("\r\n"));
});

test("aCsv con una lista vacía devuelve solo el encabezado", () => {
  const columnas = [{ titulo: "Periodo", valor: (f) => f.periodo }];
  const csv = aCsv(columnas, []);
  assert.equal(csv, "﻿Periodo\r\n");
});

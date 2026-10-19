const { test } = require("node:test");
const assert = require("node:assert/strict");
const { calcularPeriodo, diasDelPeriodo, esFechaValida, sumarDias } = require("../src/utils/periodos");
const { validarNuevoRol, validarCambios, MAXIMO_CAMBIOS } = require("../src/utils/validarRol");

const UUID = "4192f252-acf0-4522-a109-e051cad9a50b";
const RANGO = { fecha_inicio: "2026-10-12", fecha_fin: "2026-10-18" };

test("la semana va de lunes a domingo aunque se elija otro día", () => {
  const esperada = { fecha_inicio: "2026-10-12", fecha_fin: "2026-10-18" };
  assert.deepEqual(calcularPeriodo("SEMANAL", "2026-10-12"), esperada);
  assert.deepEqual(calcularPeriodo("SEMANAL", "2026-10-15"), esperada);
  assert.deepEqual(calcularPeriodo("SEMANAL", "2026-10-18"), esperada);
});

test("una semana puede cruzar el cambio de mes y de año", () => {
  assert.deepEqual(calcularPeriodo("SEMANAL", "2027-01-01"), { fecha_inicio: "2026-12-28", fecha_fin: "2027-01-03" });
});

test("el mes va del 1 al último día, con febrero bisiesto", () => {
  assert.deepEqual(calcularPeriodo("MENSUAL", "2026-10-20"), { fecha_inicio: "2026-10-01", fecha_fin: "2026-10-31" });
  assert.deepEqual(calcularPeriodo("MENSUAL", "2028-02-10"), { fecha_inicio: "2028-02-01", fecha_fin: "2028-02-29" });
  assert.equal(diasDelPeriodo("2028-02-01", "2028-02-29").length, 29);
});

test("fechas inválidas", () => {
  assert.equal(esFechaValida("2026-02-30"), false);
  assert.equal(esFechaValida("2026-2-3"), false);
  assert.equal(esFechaValida("2026-13-01"), false);
  assert.equal(esFechaValida(20261012), false);
  assert.equal(sumarDias("2026-10-31", 1), "2026-11-01");
});

test("nuevo rol: exige sucursal, área, periodo y fecha", () => {
  assert.throws(() => validarNuevoRol({}), (error) => {
    assert.equal(error.estado, 400);
    assert.deepEqual(error.detalles.map((d) => d.campo), ["id_sucursal", "id_departamento", "periodo", "fecha"]);
    return true;
  });
  assert.throws(() => validarNuevoRol({ id_sucursal: UUID, id_departamento: UUID, periodo: "ANUAL", fecha: "2026-10-12" }), {
    estado: 400,
  });
});

test("cambios: convierte cada asignación y la última gana si se repite la celda", () => {
  const cambios = validarCambios(
    {
      asignaciones: [
        { id_empleado: UUID.toUpperCase(), fecha: "2026-10-12", id_turno: UUID },
        { id_empleado: UUID, fecha: "2026-10-12", descanso: true },
        { id_empleado: UUID, fecha: "2026-10-13" },
      ],
    },
    RANGO
  );
  assert.deepEqual(cambios, [
    { id_empleado: UUID, fecha: "2026-10-12", id_turno: null, descanso: true },
    { id_empleado: UUID, fecha: "2026-10-13", id_turno: null, descanso: false },
  ]);
});

test("cambios: rechaza fechas fuera del rol, turno y descanso a la vez e identificadores inválidos", () => {
  assert.throws(
    () =>
      validarCambios(
        {
          asignaciones: [
            { id_empleado: UUID, fecha: "2026-10-19", descanso: true },
            { id_empleado: UUID, fecha: "2026-10-12", id_turno: UUID, descanso: true },
            { id_empleado: "abc", fecha: "2026-10-12", id_turno: "x" },
            null,
          ],
        },
        RANGO
      ),
    (error) => {
      assert.equal(error.estado, 400);
      assert.deepEqual(error.detalles.map((d) => d.campo), [
        "asignaciones[0].fecha",
        "asignaciones[1].descanso",
        "asignaciones[2].id_empleado",
        "asignaciones[2].id_turno",
        "asignaciones[3]",
      ]);
      return true;
    }
  );
});

test("cambios: lista vacía o demasiado grande", () => {
  assert.throws(() => validarCambios({ asignaciones: [] }, RANGO), { estado: 400 });
  assert.throws(() => validarCambios({}, RANGO), { estado: 400 });
  const muchos = Array.from({ length: MAXIMO_CAMBIOS + 1 }, () => ({ id_empleado: UUID, fecha: "2026-10-12", descanso: true }));
  assert.throws(() => validarCambios({ asignaciones: muchos }, RANGO), { estado: 400 });
});

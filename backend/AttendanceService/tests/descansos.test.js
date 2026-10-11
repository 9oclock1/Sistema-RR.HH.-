const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarDescansos, intervaloTurno, describirHoras, TIPO_ALERTA } = require("../src/utils/descansos");

const MANANA = { nombre: "Mañana", hora_inicio: "06:00:00", hora_fin: "14:00:00" };
const TARDE = { nombre: "Tarde", hora_inicio: "14:00", hora_fin: "22:00" };
const NOCHE = { nombre: "Noche", hora_inicio: "22:00", hora_fin: "06:00" };
const ANA = "ana";
const LUIS = "luis";

const turno = (id_empleado, fecha, t) => ({ id_empleado, fecha, turno: t });

test("un turno nocturno termina al día siguiente", () => {
  const { inicio, fin } = intervaloTurno("2026-10-12", NOCHE);
  assert.equal(fin - inicio, 8 * 60);
});

test("Noche seguida de Mañana: no hay descanso", () => {
  const [alerta, ...resto] = validarDescansos([turno(ANA, "2026-10-12", NOCHE), turno(ANA, "2026-10-13", MANANA)]);
  assert.equal(resto.length, 0);
  assert.equal(alerta.tipo, TIPO_ALERTA.DESCANSO_INSUFICIENTE);
  assert.equal(alerta.minutos_descanso, 0);
  assert.equal(alerta.fecha, "2026-10-13");
  assert.equal(alerta.fecha_anterior, "2026-10-12");
  assert.match(alerta.mensaje, /No hay descanso entre el turno Noche del 12\/10 y el turno Mañana del 13\/10/);
});

test("Tarde seguida de Mañana: 8 h de descanso, menos de 11", () => {
  const [alerta] = validarDescansos([turno(ANA, "2026-10-14", TARDE), turno(ANA, "2026-10-15", MANANA)]);
  assert.equal(alerta.minutos_descanso, 8 * 60);
  assert.match(alerta.mensaje, /Solo 8 h de descanso/);
});

test("exactamente 11 h de descanso es válido", () => {
  const corta = { nombre: "Corta", hora_inicio: "08:00", hora_fin: "13:00" };
  assert.deepEqual(validarDescansos([turno(ANA, "2026-10-14", corta), turno(ANA, "2026-10-15", { ...corta, hora_inicio: "00:00", hora_fin: "05:00" })]), []);
});

test("10 h 59 min de descanso genera alerta", () => {
  const siguiente = { nombre: "Temprano", hora_inicio: "08:59", hora_fin: "12:00" };
  const [alerta] = validarDescansos([turno(ANA, "2026-10-14", TARDE), turno(ANA, "2026-10-15", siguiente)]);
  assert.equal(alerta.minutos_descanso, 10 * 60 + 59);
  assert.match(alerta.mensaje, /Solo 10 h 59 min/);
});

test("un turno que empieza antes de que termine el anterior es solapamiento", () => {
  const largo = { nombre: "Largo", hora_inicio: "20:00", hora_fin: "07:00" };
  const [alerta] = validarDescansos([turno(ANA, "2026-10-12", largo), turno(ANA, "2026-10-13", MANANA)]);
  assert.equal(alerta.tipo, TIPO_ALERTA.SOLAPAMIENTO);
  assert.match(alerta.mensaje, /se superpone con el turno Largo del 12\/10/);
});

test("un descanso entre turnos no cuenta como turno", () => {
  assert.deepEqual(
    validarDescansos([turno(ANA, "2026-10-12", NOCHE), turno(ANA, "2026-10-13", null), turno(ANA, "2026-10-14", MANANA)]),
    []
  );
});

test("la rotación habitual (misma franja toda la semana) no genera alertas", () => {
  const semana = ["12", "13", "14", "15", "16"].map((d) => turno(ANA, `2026-10-${d}`, NOCHE));
  assert.deepEqual(validarDescansos(semana), []);
});

test("los turnos de empleados distintos no se comparan entre sí", () => {
  assert.deepEqual(validarDescansos([turno(ANA, "2026-10-12", NOCHE), turno(LUIS, "2026-10-13", MANANA)]), []);
});

test("el descanso mínimo se puede configurar", () => {
  const pares = [turno(ANA, "2026-10-14", TARDE), turno(ANA, "2026-10-15", MANANA)];
  assert.equal(validarDescansos(pares, { horasMinimas: 8 }).length, 0);
  assert.equal(validarDescansos(pares, { horasMinimas: 12 }).length, 1);
});

test("las alertas salen ordenadas por fecha sin importar el orden de entrada", () => {
  const alertas = validarDescansos([
    turno(LUIS, "2026-10-16", MANANA),
    turno(ANA, "2026-10-13", MANANA),
    turno(LUIS, "2026-10-15", TARDE),
    turno(ANA, "2026-10-12", NOCHE),
  ]);
  assert.deepEqual(alertas.map((a) => [a.id_empleado, a.fecha]), [[ANA, "2026-10-13"], [LUIS, "2026-10-16"]]);
});

test("describe horas y minutos", () => {
  assert.equal(describirHoras(45), "45 min");
  assert.equal(describirHoras(600), "10 h");
  assert.equal(describirHoras(605), "10 h 5 min");
});

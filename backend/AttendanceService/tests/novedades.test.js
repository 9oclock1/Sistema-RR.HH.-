const { test } = require("node:test");
const assert = require("node:assert/strict");
const { contrastarJornada, estadoJornada, horarioProgramado } = require("../src/utils/novedades");

// Mañana 08:00–16:00, 60 min de refrigerio y 10 de tolerancia; Noche 22:00–06:00.
const manana = { hora_inicio: "08:00:00", hora_fin: "16:00:00", minutos_refrigerio: 60, minutos_tolerancia: 10 };
const noche = { hora_inicio: "22:00:00", hora_fin: "06:00:00", minutos_refrigerio: 30, minutos_tolerancia: 5 };
const FECHA = "2026-10-12";

const enBolivia = (fechaHora) => new Date(`${fechaHora}-04:00`);
const marcaje = (id, tipo, fechaHora, fechaJornada = FECHA) => ({
  id_marcaje: id,
  tipo_codigo: tipo,
  fecha_jornada: fechaJornada,
  fecha_hora_marcaje: enBolivia(fechaHora),
});

const contrastar = ({ turno = manana, marcajes = [], ahora = `${FECHA}T20:00:00`, ...resto } = {}) =>
  contrastarJornada({ turno, fecha: FECHA, marcajes, ahoraMs: enBolivia(ahora).getTime(), minutosCierre: 120, ...resto });

const tipos = (resultado) => resultado.novedades.map((n) => n.tipo);

test("el horario programado usa la hora de Bolivia y cruza la medianoche en turnos nocturnos", () => {
  const diurno = horarioProgramado(manana, FECHA);
  assert.equal(new Date(diurno.inicioMs).toISOString(), "2026-10-12T12:00:00.000Z");
  assert.equal(new Date(diurno.limiteMs).toISOString(), "2026-10-12T12:10:00.000Z");
  assert.equal(new Date(diurno.finMs).toISOString(), "2026-10-12T20:00:00.000Z");
  assert.equal(new Date(horarioProgramado(noche, FECHA).finMs).toISOString(), "2026-10-13T10:00:00.000Z");
});

test("entrada dentro de la tolerancia: sin novedades", () => {
  const resultado = contrastar({
    marcajes: [marcaje("e", "ENTRADA", `${FECHA}T08:07:00`), marcaje("s", "SALIDA", `${FECHA}T16:02:00`)],
  });
  assert.deepEqual(resultado.novedades, []);
  assert.equal(resultado.entrada.id_marcaje, "e");
  assert.equal(resultado.salida.id_marcaje, "s");
});

test("entrada justo en el límite de tolerancia es puntual", () => {
  assert.deepEqual(contrastar({ marcajes: [marcaje("e", "ENTRADA", `${FECHA}T08:10:00`)], ahora: `${FECHA}T09:00:00` }).novedades, []);
});

test("entrada fuera de la tolerancia: atraso con los minutos desde el inicio del turno", () => {
  const resultado = contrastar({ marcajes: [marcaje("e", "ENTRADA", `${FECHA}T08:12:00`)], ahora: `${FECHA}T09:00:00` });
  assert.deepEqual(resultado.novedades, [{ tipo: "ATRASO", minutos: 12, minutos_penalizacion: 12, id_marcaje: "e" }]);
});

test("un segundo después del límite ya es atraso y cuenta el minuto iniciado", () => {
  const resultado = contrastar({ marcajes: [marcaje("e", "ENTRADA", `${FECHA}T08:10:01`)], ahora: `${FECHA}T09:00:00` });
  assert.equal(resultado.novedades[0].minutos, 11);
});

test("sin tolerancia, un segundo tarde es un minuto de atraso", () => {
  const resultado = contrastar({
    turno: { ...manana, minutos_tolerancia: 0 },
    marcajes: [marcaje("e", "ENTRADA", `${FECHA}T08:00:01`)],
    ahora: `${FECHA}T09:00:00`,
  });
  assert.deepEqual(tipos(resultado), ["ATRASO"]);
  assert.equal(resultado.novedades[0].minutos, 1);
});

test("entrada anticipada dentro de la ventana es puntual", () => {
  const resultado = contrastar({ marcajes: [marcaje("e", "ENTRADA", `${FECHA}T04:30:00`)], ahora: `${FECHA}T09:00:00` });
  assert.equal(resultado.entrada.id_marcaje, "e");
  assert.deepEqual(resultado.novedades, []);
});

test("una entrada marcada después del fin del turno no cuenta para él", () => {
  const resultado = contrastar({ marcajes: [marcaje("e", "ENTRADA", `${FECHA}T16:30:00`)] });
  assert.equal(resultado.entrada, null);
  assert.deepEqual(tipos(resultado), ["INASISTENCIA"]);
});

test("sin entrada y antes del fin del turno todavía no hay inasistencia", () => {
  assert.deepEqual(contrastar({ ahora: `${FECHA}T15:59:59` }).novedades, []);
});

test("sin entrada al terminar el turno: inasistencia con las horas efectivas como penalización", () => {
  const resultado = contrastar({ ahora: `${FECHA}T16:00:00` });
  assert.deepEqual(resultado.novedades, [
    { tipo: "INASISTENCIA", minutos: 420, minutos_penalizacion: 420, id_marcaje: null },
  ]);
});

test("una salida sin entrada no evita la inasistencia", () => {
  const resultado = contrastar({ marcajes: [marcaje("s", "SALIDA", `${FECHA}T16:00:00`)] });
  assert.deepEqual(tipos(resultado), ["INASISTENCIA"]);
});

test("no registra inasistencia si se indica que no corresponde (empleado inactivo)", () => {
  assert.deepEqual(contrastar({ registrarFaltas: false }).novedades, []);
});

test("día de descanso o sin turno: nada que contrastar", () => {
  assert.deepEqual(contrastar({ turno: { descanso: true } }).novedades, []);
  assert.deepEqual(contrastar({ turno: null }).novedades, []);
});

test("salida antes del fin del turno: salida anticipada con el tiempo faltante", () => {
  const resultado = contrastar({
    marcajes: [marcaje("e", "ENTRADA", `${FECHA}T08:00:00`), marcaje("s", "SALIDA", `${FECHA}T15:15:00`)],
  });
  assert.deepEqual(resultado.novedades, [
    { tipo: "SALIDA_ANTICIPADA", minutos: 45, minutos_penalizacion: 45, id_marcaje: "s" },
  ]);
});

test("salida a la hora exacta de fin no es anticipada", () => {
  const resultado = contrastar({
    marcajes: [marcaje("e", "ENTRADA", `${FECHA}T08:00:00`), marcaje("s", "SALIDA", `${FECHA}T16:00:00`)],
  });
  assert.deepEqual(resultado.novedades, []);
});

test("atraso y salida anticipada en la misma jornada", () => {
  const resultado = contrastar({
    marcajes: [marcaje("e", "ENTRADA", `${FECHA}T08:30:00`), marcaje("s", "SALIDA", `${FECHA}T15:50:00`)],
  });
  assert.deepEqual(tipos(resultado), ["ATRASO", "SALIDA_ANTICIPADA"]);
  assert.deepEqual(
    resultado.novedades.map((n) => n.minutos),
    [30, 10]
  );
});

test("omisión de salida: solo al cerrar la jornada y sin penalización", () => {
  const marcajes = [marcaje("e", "ENTRADA", `${FECHA}T08:00:00`)];
  assert.deepEqual(contrastar({ marcajes, ahora: `${FECHA}T17:59:59` }).novedades, []);
  const cerrada = contrastar({ marcajes, ahora: `${FECHA}T18:00:00` });
  assert.equal(cerrada.cerrada, true);
  assert.deepEqual(cerrada.novedades, [{ tipo: "OMISION_SALIDA", minutos: 0, minutos_penalizacion: 0, id_marcaje: "e" }]);
});

test("turno nocturno: la entrada de la víspera y la salida de la madrugada son de la misma jornada", () => {
  const resultado = contrastar({
    turno: noche,
    marcajes: [
      marcaje("e", "ENTRADA", `${FECHA}T22:20:00`),
      marcaje("s", "SALIDA", "2026-10-13T05:30:00", FECHA),
    ],
    ahora: "2026-10-13T09:00:00",
  });
  assert.deepEqual(
    resultado.novedades.map((n) => [n.tipo, n.minutos]),
    [
      ["ATRASO", 20],
      ["SALIDA_ANTICIPADA", 30],
    ]
  );
});

test("turno nocturno: una entrada pasada la medianoche cuenta para el turno de la víspera", () => {
  const resultado = contrastar({
    turno: noche,
    marcajes: [marcaje("e", "ENTRADA", "2026-10-13T00:15:00", "2026-10-13")],
    ahora: "2026-10-13T01:00:00",
  });
  assert.equal(resultado.entrada.id_marcaje, "e");
  assert.deepEqual(
    resultado.novedades.map((n) => [n.tipo, n.minutos]),
    [["ATRASO", 135]]
  );
});

test("turno nocturno: la inasistencia se registra al terminar el turno, al día siguiente", () => {
  assert.deepEqual(contrastar({ turno: noche, ahora: "2026-10-13T05:59:00" }).novedades, []);
  assert.deepEqual(tipos(contrastar({ turno: noche, ahora: "2026-10-13T06:00:00" })), ["INASISTENCIA"]);
});

test("estado de la jornada para el panel según la hora", () => {
  const estado = (opciones) => {
    const turno = opciones.turno === undefined ? manana : opciones.turno;
    const ahoraMs = enBolivia(opciones.ahora).getTime();
    return estadoJornada(turno, contrastar({ ...opciones, turno }), ahoraMs).codigo;
  };
  assert.equal(estado({ turno: null, ahora: `${FECHA}T09:00:00` }), "SIN_TURNO");
  assert.equal(estado({ turno: { descanso: true }, ahora: `${FECHA}T09:00:00` }), "DESCANSO");
  assert.equal(estado({ ahora: `${FECHA}T08:05:00` }), "POR_LLEGAR");
  assert.equal(estado({ ahora: `${FECHA}T08:10:00` }), "POR_LLEGAR");
  assert.equal(estado({ ahora: `${FECHA}T08:10:01` }), "SIN_MARCAR");
  assert.equal(estado({ ahora: `${FECHA}T16:00:00` }), "INASISTENCIA");
  assert.equal(estado({ marcajes: [marcaje("e", "ENTRADA", `${FECHA}T08:03:00`)], ahora: `${FECHA}T09:00:00` }), "PUNTUAL");
  assert.equal(estado({ marcajes: [marcaje("e", "ENTRADA", `${FECHA}T08:40:00`)], ahora: `${FECHA}T09:00:00` }), "ATRASO");
});

test("estado de la jornada con la novedad justificada", () => {
  const estado = (opciones, justificadas) =>
    estadoJornada(manana, contrastar({ ...opciones, turno: manana }), enBolivia(opciones.ahora).getTime(), justificadas)
      .codigo;
  const tarde = { marcajes: [marcaje("e", "ENTRADA", `${FECHA}T08:40:00`)], ahora: `${FECHA}T09:00:00` };
  assert.equal(estado({ ahora: `${FECHA}T16:00:00` }, new Set(["INASISTENCIA"])), "INASISTENCIA_JUSTIFICADA");
  assert.equal(estado(tarde, new Set(["ATRASO"])), "ATRASO_JUSTIFICADO");
  assert.equal(estado(tarde, new Set(["SALIDA_ANTICIPADA"])), "ATRASO");
  assert.equal(estado({ ahora: `${FECHA}T16:00:00` }, new Set()), "INASISTENCIA");
});

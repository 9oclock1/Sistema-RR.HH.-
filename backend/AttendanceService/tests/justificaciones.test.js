const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ErrorApp } = require("../src/utils/errores");
const {
  horasPlazo,
  venceEn,
  evaluarPlazo,
  errorDePlazo,
  validarSolicitud,
  validarRevision,
  nombreVisible,
} = require("../src/utils/justificaciones");
const { totalesJornada, armarCargaConsolidacion } = require("../src/utils/novedades");

const NOVEDAD = "5b0f7f43-2a59-4c47-9a49-6a3e7b0e1c11";
const MOTIVOS = [
  { id_motivo_justificacion: 1, codigo: "SALUD", nombre: "Salud o atención médica" },
  { id_motivo_justificacion: 5, codigo: "OTRO", nombre: "Otro motivo" },
];
const HORA = 60 * 60 * 1000;

const PDF = Buffer.from("%PDF-1.7\n%prueba");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const archivo = (originalname, mimetype, buffer) => ({ originalname, mimetype, buffer, size: buffer.length });

const atraso = {
  es_justificable: true,
  estado_codigo: "REGISTRADA",
  fecha_hora_marcaje: new Date("2026-10-12T12:25:00Z"),
  fin_programado: new Date("2026-10-12T20:00:00Z"),
};
const falta = { ...atraso, fecha_hora_marcaje: null };

const errorDe = (funcion) => {
  try {
    funcion();
  } catch (error) {
    return error;
  }
  assert.fail("se esperaba un error");
};

test("el plazo se cuenta desde la marca del atraso o, en una falta, desde el fin del turno", () => {
  assert.equal(venceEn(atraso, 48).toISOString(), "2026-10-14T12:25:00.000Z");
  assert.equal(venceEn(falta, 48).toISOString(), "2026-10-14T20:00:00.000Z");
});

test("HORAS_PLAZO_JUSTIFICACION configura el plazo; un valor inválido usa 48 horas", (t) => {
  t.after(() => delete process.env.HORAS_PLAZO_JUSTIFICACION);
  process.env.HORAS_PLAZO_JUSTIFICACION = "72";
  assert.equal(horasPlazo(), 72);
  for (const valor of ["0", "-5", "abc", "1.5", ""]) {
    process.env.HORAS_PLAZO_JUSTIFICACION = valor;
    assert.equal(horasPlazo(), 48);
  }
});

test("dentro del plazo la novedad se puede justificar", () => {
  const plazo = evaluarPlazo(atraso, { ahoraMs: venceEn(atraso, 48).getTime() - 1, horas: 48 });
  assert.equal(plazo.justificable, true);
  assert.equal(plazo.razon, null);
});

test("el último instante del plazo todavía cuenta; un milisegundo después venció", () => {
  const limite = venceEn(falta, 48).getTime();
  assert.equal(evaluarPlazo(falta, { ahoraMs: limite, horas: 48 }).justificable, true);
  const vencido = evaluarPlazo(falta, { ahoraMs: limite + 1, horas: 48 });
  assert.equal(vencido.justificable, false);
  assert.equal(vencido.razon, "VENCIDA");
});

test("no se justifica una novedad sin penalización, ya justificada o con una solicitud pendiente", () => {
  const ahoraMs = atraso.fecha_hora_marcaje.getTime() + HORA;
  const razon = (novedad, vigente) => evaluarPlazo(novedad, { vigente, ahoraMs, horas: 48 }).razon;
  assert.equal(razon({ ...atraso, es_justificable: false }), "NO_JUSTIFICABLE");
  assert.equal(razon({ ...atraso, estado_codigo: "JUSTIFICADA" }), "JUSTIFICADA");
  assert.equal(razon(atraso, { estado_codigo: "APROBADA" }), "JUSTIFICADA");
  assert.equal(razon(atraso, { estado_codigo: "PENDIENTE" }), "PENDIENTE");
});

test("con una solicitud rechazada se puede volver a presentar dentro del plazo", () => {
  const ahoraMs = atraso.fecha_hora_marcaje.getTime() + HORA;
  assert.equal(evaluarPlazo(atraso, { vigente: null, ahoraMs, horas: 48 }).justificable, true);
});

test("el plazo vencido responde 409 con la fecha y hora de Bolivia", () => {
  const error = errorDePlazo(evaluarPlazo(falta, { ahoraMs: Date.parse("2026-10-20T00:00:00Z"), horas: 48 }));
  assert.ok(error instanceof ErrorApp);
  assert.equal(error.estado, 409);
  assert.match(error.message, /venció el 14\/10\/2026,? 16:00/);
  assert.equal(error.detalles[0].campo, "id_novedad");
});

test("solicitud válida: motivo, descripción opcional y comprobantes PDF, JPG o PNG", () => {
  const datos = validarSolicitud(
    { id_novedad: NOVEDAD.toUpperCase(), id_motivo: "1", descripcion: "  Cita médica  " },
    [archivo("receta.pdf", "application/pdf", PDF), archivo("foto.png", "image/png", PNG), archivo("a.jpg", "image/jpeg", JPG)],
    MOTIVOS
  );
  assert.deepEqual(datos, { idNovedad: NOVEDAD, idMotivo: 1, descripcion: "Cita médica" });
  assert.equal(validarSolicitud({ id_novedad: NOVEDAD, id_motivo: "1" }, [archivo("r.pdf", "application/pdf", PDF)], MOTIVOS).descripcion, null);
});

test("sin novedad, motivo ni comprobante se informa cada campo", () => {
  const error = errorDe(() => validarSolicitud({}, [], MOTIVOS));
  assert.equal(error.estado, 400);
  assert.deepEqual(
    error.detalles.map((d) => d.campo),
    ["id_novedad", "id_motivo", "archivos"]
  );
});

test("novedad o motivo inválidos", () => {
  const error = errorDe(() =>
    validarSolicitud({ id_novedad: "123", id_motivo: "9" }, [archivo("r.pdf", "application/pdf", PDF)], MOTIVOS)
  );
  assert.deepEqual(error.detalles, [
    { campo: "id_novedad", mensaje: "Novedad inválida." },
    { campo: "id_motivo", mensaje: "Motivo inválido." },
  ]);
});

test("«Otro motivo» exige describirlo y la descripción tiene un máximo de 500 caracteres", () => {
  const pdf = [archivo("r.pdf", "application/pdf", PDF)];
  const sinDescripcion = errorDe(() => validarSolicitud({ id_novedad: NOVEDAD, id_motivo: "5", descripcion: "   " }, pdf, MOTIVOS));
  assert.deepEqual(sinDescripcion.detalles, [{ campo: "descripcion", mensaje: "Describa el motivo." }]);
  const larga = errorDe(() => validarSolicitud({ id_novedad: NOVEDAD, id_motivo: "1", descripcion: "x".repeat(501) }, pdf, MOTIVOS));
  assert.equal(larga.detalles[0].campo, "descripcion");
  assert.equal(validarSolicitud({ id_novedad: NOVEDAD, id_motivo: "1", descripcion: "x".repeat(500) }, pdf, MOTIVOS).descripcion.length, 500);
});

test("un archivo cuyo contenido no coincide con su tipo se rechaza aunque diga ser PDF", () => {
  const falso = archivo("virus.pdf", "application/pdf", Buffer.from("MZ\x90\x00 ejecutable"));
  const error = errorDe(() => validarSolicitud({ id_novedad: NOVEDAD, id_motivo: "1" }, [falso], MOTIVOS));
  assert.deepEqual(error.detalles, [{ campo: "archivos", mensaje: "«virus.pdf» no es un PDF, JPG o PNG válido." }]);
  const pngComoJpg = archivo("foto.jpg", "image/jpeg", PNG);
  assert.equal(errorDe(() => validarSolicitud({ id_novedad: NOVEDAD, id_motivo: "1" }, [pngComoJpg], MOTIVOS)).estado, 400);
});

test("el nombre visible del comprobante no conserva rutas ni caracteres de control", () => {
  assert.equal(nombreVisible("C:\\fakepath\\certificado médico.pdf"), "certificado médico.pdf");
  assert.equal(nombreVisible("../../etc/passwd"), "passwd");
  assert.equal(nombreVisible('rece"ta\u0000.pdf'), "receta.pdf");
  assert.equal(nombreVisible(""), "comprobante");
  assert.equal(nombreVisible(`${"a".repeat(300)}.pdf`).length, 255);
});

test("revisión: aprobar con comentario opcional; rechazar exige comentario", () => {
  assert.deepEqual(validarRevision({ decision: "aprobada" }), { decision: "APROBADA", idEstado: 2, comentario: null });
  assert.deepEqual(validarRevision({ decision: "RECHAZADA", comentario: " Sin firma " }), {
    decision: "RECHAZADA",
    idEstado: 3,
    comentario: "Sin firma",
  });
  assert.deepEqual(errorDe(() => validarRevision({ decision: "RECHAZADA", comentario: "  " })).detalles, [
    { campo: "comentario", mensaje: "Explique el motivo del rechazo." },
  ]);
  assert.deepEqual(errorDe(() => validarRevision({ decision: "QUIZAS" })).detalles.map((d) => d.campo), ["decision"]);
  assert.deepEqual(errorDe(() => validarRevision()).detalles.map((d) => d.campo), ["decision"]);
  assert.equal(errorDe(() => validarRevision({ decision: "APROBADA", comentario: "x".repeat(501) })).detalles[0].campo, "comentario");
});

const fila = (tipo, estado, penalizacion) => ({
  id_novedad: `${tipo}-${estado}`,
  id_empleado: "e",
  fecha_jornada: "2026-10-12",
  nombre_turno: "Mañana",
  inicio_programado: "2026-10-12T12:00:00Z",
  fin_programado: "2026-10-12T20:00:00Z",
  tipo_codigo: tipo,
  estado_codigo: estado,
  minutos: penalizacion,
  minutos_penalizacion: penalizacion,
  minutos_programados: 420,
});

test("horas efectivas: el turno menos la penalización no justificada", () => {
  assert.deepEqual(totalesJornada([fila("ATRASO", "REGISTRADA", 25), fila("SALIDA_ANTICIPADA", "REGISTRADA", 60)]), {
    minutos_programados: 420,
    minutos_penalizacion: 85,
    minutos_justificados: 0,
    minutos_efectivos: 335,
  });
  assert.deepEqual(totalesJornada([fila("ATRASO", "JUSTIFICADA", 25), fila("SALIDA_ANTICIPADA", "REGISTRADA", 60)]), {
    minutos_programados: 420,
    minutos_penalizacion: 60,
    minutos_justificados: 25,
    minutos_efectivos: 360,
  });
  assert.equal(totalesJornada([fila("INASISTENCIA", "REGISTRADA", 420)]).minutos_efectivos, 0);
  assert.equal(totalesJornada([fila("INASISTENCIA", "JUSTIFICADA", 420)]).minutos_efectivos, 420);
});

test("la jornada recalculada lleva el mismo detalle que la consolidada, con el tipo de evento indicado", () => {
  const novedades = [fila("INASISTENCIA", "JUSTIFICADA", 420)];
  const consolidada = armarCargaConsolidacion(novedades);
  const recalculada = armarCargaConsolidacion(novedades, "JORNADA_RECALCULADA");
  assert.equal(consolidada.evento, "JORNADA_CONSOLIDADA");
  assert.equal(recalculada.evento, "JORNADA_RECALCULADA");
  assert.deepEqual({ ...recalculada, evento: null }, { ...consolidada, evento: null });
  assert.deepEqual(
    [recalculada.minutos_penalizacion, recalculada.minutos_justificados, recalculada.minutos_efectivos],
    [0, 420, 420]
  );
});

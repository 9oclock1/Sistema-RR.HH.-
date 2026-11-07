// KAN-35 (RF-15.6): correos de entrevista que NotificationService envía a pedido de RecruitmentService.
// Plantillas, validación del aviso, clasificación de fallos del SMTP y el endpoint. El SMTP siempre está simulado.
process.env.NODE_ENV = "test";
const { test, describe, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const correo = require("../src/services/correo.service");
const servicio = require("../src/services/correosEntrevista.service");
const { armarCorreo } = require("../src/services/plantillasEntrevista");
const app = require("../index");

const ID_MENSAJE = "7a1c2d3e-0000-4000-8000-000000000001";

const datos = (cambios = {}) => ({
  candidato: { nombres: "Luis", apellidos: "Rojas" },
  puesto: "Cajero",
  codigo_convocatoria: "CONV-01",
  fecha_hora: "2030-03-15T14:00:00.000Z",
  duracion_minutos: 45,
  modalidad: "VIRTUAL",
  lugar_enlace: "https://meet.google.com/abc-defg-hij",
  evaluador: "Ana Quispe",
  fecha_hora_anterior: null,
  motivo: null,
  ...cambios,
});
const aviso = (cambios = {}) => ({ id_mensaje: ID_MENSAJE, para: "luis@test.com", tipo: "PROGRAMACION", datos: datos(), ...cambios });

describe("RF-15.6: plantillas de correo de entrevista", () => {
  test("criterio 2: la programación virtual lleva fecha, hora local, enlace de acceso y evaluador", () => {
    const { asunto, texto, html } = armarCorreo("PROGRAMACION", datos());
    assert.equal(asunto, "Entrevista programada: Cajero");
    assert.match(texto, /Estimado\(a\) Luis Rojas:/);
    assert.match(texto, /Fecha: viernes, 15 de marzo de 2030/);
    assert.match(texto, /Hora: 10:00 \(hora de La Paz\)/);
    assert.match(texto, /Duración estimada: 45 minutos/);
    assert.match(texto, /Enlace de acceso: https:\/\/meet\.google\.com\/abc-defg-hij/);
    assert.match(texto, /Entrevistador\(a\): Ana Quispe/);
    assert.match(html, /<a href="https:\/\/meet\.google\.com\/abc-defg-hij"/);
  });

  test("criterio 2: la programación presencial lleva la dirección", () => {
    const { texto, html } = armarCorreo("PROGRAMACION", datos({ modalidad: "PRESENCIAL", lugar_enlace: "Av. Arce 2631, piso 3" }));
    assert.match(texto, /Dirección: Av\. Arce 2631, piso 3/);
    assert.match(texto, /documento de identidad/);
    assert.doesNotMatch(html, /<a href/);
  });

  test("criterio 4: la reprogramación indica la fecha anterior, el motivo y los datos vigentes", () => {
    const { asunto, texto } = armarCorreo(
      "REPROGRAMACION",
      datos({ fecha_hora: "2030-03-16T13:00:00.000Z", fecha_hora_anterior: "2030-03-15T14:00:00.000Z", motivo: "Viaje del evaluador" }),
    );
    assert.equal(asunto, "Entrevista reprogramada: Cajero");
    assert.match(texto, /prevista para el viernes, 15 de marzo de 2030, 10:00 \(hora de La Paz\), fue reprogramada/);
    assert.match(texto, /Motivo: Viaje del evaluador/);
    assert.match(texto, /Fecha: sábado, 16 de marzo de 2030/);
    assert.match(texto, /Hora: 09:00/);
  });

  test("criterio 4: la cancelación informa el motivo y no repite los datos de acceso", () => {
    const { asunto, texto } = armarCorreo("CANCELACION", datos({ motivo: "La vacante fue cubierta" }));
    assert.equal(asunto, "Entrevista cancelada: Cajero");
    assert.match(texto, /fue cancelada/);
    assert.match(texto, /Motivo: La vacante fue cubierta/);
    assert.doesNotMatch(texto, /Enlace de acceso/);
  });

  test("el HTML escapa lo que escribe el reclutador", () => {
    const { html } = armarCorreo("CANCELACION", datos({ motivo: '<script>alert("x")</script>' }));
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  });
});

describe("RF-15.6: validación y envío del aviso", () => {
  let entregar;
  beforeEach(() => {
    mock.restoreAll();
    mock.method(console, "log", () => {});
    entregar = mock.method(correo, "entregarCorreo", async () => ({ enviado: true, permanente: false, motivo: null, idMensaje: "<m@x>" }));
  });

  test("rechaza un aviso incompleto indicando cada dato que falta", () => {
    assert.throws(
      () => servicio.validarAviso({ id_mensaje: "abc", para: "no-es-correo", tipo: "OTRO", datos: { modalidad: "VIRTUAL" } }),
      (error) => {
        assert.equal(error.estado, 400);
        const campos = error.detalles.map((d) => d.campo);
        for (const campo of ["id_mensaje", "para", "tipo", "datos.candidato", "datos.puesto", "datos.fecha_hora", "datos.duracion_minutos"]) {
          assert.ok(campos.includes(campo), campo);
        }
        return true;
      },
    );
  });

  test("envía el correo con HTML, texto y el identificador del aviso", async () => {
    const resultado = await servicio.enviarAvisoEntrevista(aviso());
    assert.equal(resultado.enviado, true);
    const enviado = entregar.mock.calls[0].arguments[0];
    assert.equal(enviado.para, "luis@test.com");
    assert.equal(enviado.idMensaje, ID_MENSAJE);
    assert.equal(enviado.asunto, "Entrevista programada: Cajero");
    assert.match(enviado.html, /<!doctype html>/);
  });

  test("una dirección rechazada responde 422 y un fallo temporal 503", async () => {
    entregar.mock.mockImplementation(async () => ({ enviado: false, permanente: true, motivo: "550 mailbox unavailable" }));
    await assert.rejects(servicio.enviarAvisoEntrevista(aviso()), { estado: 422 });
    entregar.mock.mockImplementation(async () => ({ enviado: false, permanente: false, motivo: "timeout" }));
    await assert.rejects(servicio.enviarAvisoEntrevista(aviso()), { estado: 503 });
  });

  test("clasifica los errores del SMTP: dirección rechazada es permanente; credenciales o red, no", () => {
    assert.equal(correo.clasificarError({ responseCode: 550, message: "no such user" }).permanente, true);
    assert.equal(correo.clasificarError({ code: "EENVELOPE", message: "No recipients" }).permanente, true);
    assert.equal(correo.clasificarError({ code: "EAUTH", responseCode: 535, message: "bad" }).permanente, false);
    assert.equal(correo.clasificarError({ code: "ECONNECTION", message: "refused" }).permanente, false);
    assert.equal(correo.clasificarError({ responseCode: 421, message: "try later" }).permanente, false);
  });

  test("sin SMTP configurado no envía y lo informa como fallo temporal", async () => {
    mock.restoreAll();
    const host = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;
    try {
      assert.deepEqual(await correo.entregarCorreo({ para: "luis@test.com", asunto: "a", texto: "b" }), {
        enviado: false,
        permanente: false,
        motivo: "El envío de correos no está configurado (SMTP_HOST).",
      });
    } finally {
      if (host !== undefined) process.env.SMTP_HOST = host;
    }
  });
});

describe("RF-15.6: endpoint POST /correos/entrevistas", () => {
  let servidor;
  let base;
  before(async () => {
    servidor = app.listen(0);
    await new Promise((listo) => servidor.once("listening", listo));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });
  after(() => servidor.close());
  beforeEach(() => {
    mock.restoreAll();
    mock.method(console, "log", () => {});
    mock.method(correo, "entregarCorreo", async () => ({ enviado: true, permanente: false, motivo: null, idMensaje: "<m@x>" }));
  });

  const enviar = (cuerpo, servicioEmisor = "recruitment-service") =>
    fetch(`${base}/correos/entrevistas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(servicioEmisor && { "X-Servicio": servicioEmisor }) },
      body: JSON.stringify(cuerpo),
    });

  test("solo lo puede usar RecruitmentService", async () => {
    assert.equal((await enviar(aviso(), null)).status, 401);
    assert.equal((await enviar(aviso(), "attendance-service")).status, 403);
  });

  test("responde 200 al enviar y 400 si el aviso está incompleto", async () => {
    const ok = await enviar(aviso());
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).asunto, "Entrevista programada: Cajero");
    const incompleto = await enviar({ para: "luis@test.com" });
    assert.equal(incompleto.status, 400);
    assert.ok((await incompleto.json()).detalles.length > 0);
  });
});

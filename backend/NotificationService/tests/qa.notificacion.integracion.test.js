// KAN-54 (RF-34), QA: despacho y recepción de alertas por HTTP real entre AttendanceService (emisor) y NotificationService
// (receptor), con la base y el SMTP simulados. Verifica lo que cruza la red: cabeceras, categoría, enlaces,
// justificación del rechazo, formato del correo y la bandeja que lee el portal.
process.env.NODE_ENV = "test";
const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/notificaciones.model");
const empleados = require("../src/services/empleados.service");
const correo = require("../src/services/correo.service");
const app = require("../index");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const ID_VACACION = "9f1c2d3e-0000-4000-8000-000000000002";
const ID_LICENCIA = "9f1c2d3e-0000-4000-8000-000000000003";

let servidor;
let base;
let emisor;
let guardadas;
let correos;

before(async () => {
  await new Promise((listo) => {
    servidor = app.listen(0, "127.0.0.1", listo);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
  // El emisor lee la URL al cargarse, así que se importa recién ahora.
  process.env.NOTIFICATION_SERVICE_URL = base;
  emisor = require("../../AttendanceService/src/services/notificaciones.service");
});

after(() => servidor.close());

beforeEach(() => {
  mock.restoreAll();
  delete process.env.PORTAL_URL;
  delete process.env.RUTA_VACACIONES;
  guardadas = [];
  correos = [];
  mock.method(modelo, "crear", async (datos) => {
    const notificacion = { id_notificacion: `n-${guardadas.length + 1}`, ...datos, correo_estado: "NO_APLICA", leida: false };
    guardadas.push(notificacion);
    return { notificacion, creada: true };
  });
  mock.method(modelo, "registrarCorreo", async () => {});
  mock.method(empleados, "obtenerEmpleado", async () => ({ id_empleado: ANA, correo: "ana.quispe@ejemplo.com", activo: true }));
  mock.method(correo, "enviarCorreo", async (mensaje) => {
    correos.push(mensaje);
    return { enviado: true, motivo: null };
  });
});

const vacaciones = (estado, motivo = null) => ({
  id_solicitud: ID_VACACION,
  id_empleado: ANA,
  estado_codigo: estado,
  fecha_inicio: "2026-12-07",
  fecha_fin: "2026-12-11",
  motivo_resolucion: motivo,
});
const licencia = { ...vacaciones("APROBADA"), id_solicitud: ID_LICENCIA, tipo_nombre: "Licencia médica" };

test("criterio 1: aprobar vacaciones deja la alerta en la bandeja del colaborador", async () => {
  const resultado = await emisor.notificarResolucion({
    solicitud: vacaciones("APROBADA"),
    idResolutor: LUIS,
    nombreResolutor: "Luis Rojas",
    categoria: "VACACIONES",
  });

  assert.deepEqual(resultado, { aceptada: true, reintentable: false });
  assert.equal(guardadas.length, 1);
  assert.equal(guardadas[0].idEmpleado, ANA);
  assert.equal(guardadas[0].tipo, "SOLICITUD_APROBADA");
  assert.equal(guardadas[0].titulo, "Solicitud aprobada: Vacaciones");
  assert.match(guardadas[0].mensaje, /07\/12\/2026 al 11\/12\/2026/);
  assert.match(guardadas[0].mensaje, /aprobada por Luis Rojas/);
});

test("criterio 2: el rechazo lleva la justificación formal del supervisor, completa", async () => {
  const motivo = "Dos compañeros ya están de licencia en esas fechas y no hay cobertura para el turno de la mañana.";
  await emisor.notificarResolucion({
    solicitud: vacaciones("RECHAZADA", motivo),
    idResolutor: LUIS,
    nombreResolutor: "Luis Rojas",
    categoria: "VACACIONES",
  });

  assert.equal(guardadas[0].tipo, "SOLICITUD_RECHAZADA");
  assert.match(guardadas[0].mensaje, new RegExp(`Justificación: ${motivo}`));
});

test("criterio 3: el correo resumen sale al correo del colaborador con la resolución y el enlace al detalle", async () => {
  process.env.PORTAL_URL = "https://rrhh.ejemplo.com/";
  await emisor.notificarResolucion({
    solicitud: vacaciones("RECHAZADA", "Sin cobertura"),
    idResolutor: LUIS,
    nombreResolutor: "Luis Rojas",
    categoria: "VACACIONES",
  });

  assert.equal(correos.length, 1);
  assert.equal(correos[0].para, "ana.quispe@ejemplo.com");
  assert.equal(correos[0].asunto, "Solicitud rechazada: Vacaciones");
  assert.match(correos[0].texto, /Su solicitud de «Vacaciones» para el 07\/12\/2026 al 11\/12\/2026 fue rechazada por Luis Rojas\./);
  assert.match(correos[0].texto, /Justificación: Sin cobertura/);
  assert.match(correos[0].texto, new RegExp(`https://rrhh\\.ejemplo\\.com/asistencia/solicitud-vacaciones\\?solicitud=${ID_VACACION}`));
  assert.match(correos[0].texto, /aviso automático/);
});

test("criterio 4: cada categoría enlaza a su propio detalle histórico", async () => {
  await emisor.notificarResolucion({ solicitud: vacaciones("APROBADA"), idResolutor: LUIS, nombreResolutor: "Luis", categoria: "VACACIONES" });
  await emisor.notificarResolucion({ solicitud: licencia, idResolutor: LUIS, nombreResolutor: "Luis", categoria: "LICENCIA" });

  assert.equal(guardadas[0].enlace, `/asistencia/solicitud-vacaciones?solicitud=${ID_VACACION}`);
  assert.equal(guardadas[1].enlace, `/asistencia/licencias?solicitud=${ID_LICENCIA}`);
  assert.equal(guardadas[1].titulo, "Solicitud aprobada: Licencia médica");
});

test("un colaborador sin correo igual recibe la alerta del portal", async () => {
  empleados.obtenerEmpleado.mock.mockImplementation(async () => ({ id_empleado: ANA, correo: null, activo: true }));
  correo.enviarCorreo.mock.mockImplementation(async () => ({ enviado: false, motivo: "El destinatario no tiene un correo registrado." }));

  const resultado = await emisor.notificarResolucion({
    solicitud: vacaciones("APROBADA"),
    idResolutor: LUIS,
    nombreResolutor: "Luis",
    categoria: "VACACIONES",
  });

  assert.equal(resultado.aceptada, true);
  assert.equal(guardadas.length, 1);
});

test("el receptor rechaza con 403 a quien no es supervisor y el emisor no lo reintenta", async () => {
  const respuesta = await fetch(`${base}/notificaciones/resolucion-solicitud`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Empleado-Id": ANA, "X-Rol": "empleado" },
    body: JSON.stringify({ ...vacaciones("APROBADA"), estado: "APROBADA", tipo_solicitud: "Vacaciones" }),
  });
  assert.equal(respuesta.status, 403);
  assert.equal(guardadas.length, 0);
});

test("un reintento del emisor no duplica la alerta ni el correo", async () => {
  modelo.crear.mock.mockImplementation(async (datos) => ({
    notificacion: { id_notificacion: "n-1", ...datos, correo_estado: "ENVIADO" },
    creada: false,
  }));

  const resultado = await emisor.notificarResolucion({
    solicitud: vacaciones("APROBADA"),
    idResolutor: LUIS,
    nombreResolutor: "Luis",
    categoria: "VACACIONES",
  });

  assert.equal(resultado.aceptada, true);
  assert.equal(correos.length, 0);
});

test("el portal lee su bandeja: página, total del filtro y no leídas", async () => {
  mock.method(modelo, "listar", async () => [{ id_notificacion: "n-1", titulo: "Solicitud aprobada: Vacaciones", leida: false }]);
  mock.method(modelo, "contarNoLeidas", async () => 4);
  const total = mock.method(modelo, "contarTotal", async () => 9);

  const respuesta = await fetch(`${base}/notificaciones?estado=no_leidas&limite=1`, { headers: { "X-Empleado-Id": ANA } });
  const cuerpo = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.equal(cuerpo.no_leidas, 4);
  assert.equal(cuerpo.total, 9);
  assert.equal(cuerpo.notificaciones.length, 1);
  assert.deepEqual(total.mock.calls[0].arguments, [ANA, true]);
});

test("marcar leída y marcar todas respetan al dueño de la bandeja", async () => {
  const una = mock.method(modelo, "marcarLeida", async (id, empleado) => (empleado === ANA ? { id_notificacion: id, leida: true } : undefined));
  const todas = mock.method(modelo, "marcarTodasLeidas", async () => 3);
  const id = "7a1c2d3e-0000-4000-8000-000000000009";

  const propia = await fetch(`${base}/notificaciones/${id}/leer`, { method: "POST", headers: { "X-Empleado-Id": ANA } });
  const ajena = await fetch(`${base}/notificaciones/${id}/leer`, { method: "POST", headers: { "X-Empleado-Id": LUIS } });
  const lote = await fetch(`${base}/notificaciones/leer-todas`, { method: "POST", headers: { "X-Empleado-Id": ANA } });

  assert.equal(propia.status, 200);
  assert.equal(ajena.status, 404);
  assert.deepEqual(await lote.json(), { marcadas: 3, no_leidas: 0 });
  assert.equal(una.mock.callCount(), 2);
  assert.equal(todas.mock.callCount(), 1);
});

// KAN-54 (RF-34): resolución de solicitudes y aviso al colaborador.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/licencias.model");
const empleados = require("../src/services/empleados.service");
const notificaciones = require("../src/services/notificaciones.service");
const servicio = require("../src/services/licencias.service");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const ID_SOLICITUD = "9f1c2d3e-0000-4000-8000-000000000001";

const pendiente = {
  id_solicitud: ID_SOLICITUD,
  id_empleado: ANA,
  tipo_nombre: "Licencia médica",
  fecha_inicio: "2026-11-02",
  fecha_fin: "2026-11-04",
  es_con_goce_haberes: true,
  estado_codigo: "PENDIENTE",
  estado_nombre: "Pendiente",
};
const resuelta = (estado, motivo = null) => ({
  ...pendiente,
  estado_codigo: estado,
  estado_nombre: estado === "APROBADA" ? "Aprobada" : "Rechazada",
  id_empleado_resolutor: LUIS,
  motivo_resolucion: motivo,
});

let resolver;
let notificar;
let marcar;

beforeEach(() => {
  mock.restoreAll();
  mock.method(empleados, "obtener", async () => ({ nombres: "Luis", activo: true }));
  mock.method(empleados, "obtenerNombre", async () => "Luis Rojas");
  resolver = mock.method(modelo, "resolver", async () => true);
  marcar = mock.method(modelo, "marcarResolucionNotificada", async () => {});
  mock.method(modelo, "obtener", async () => (resolver.mock.callCount() > 0 ? resuelta("APROBADA") : pendiente));
  notificar = mock.method(notificaciones, "notificarResolucion", async () => ({ aceptada: true, reintentable: false }));
});

test("criterio 1: al aprobar guarda la resolución y avisa al colaborador", async () => {
  const resultado = await servicio.resolver(LUIS, ID_SOLICITUD, { decision: "aprobada" });

  assert.deepEqual(resolver.mock.calls[0].arguments[0], {
    idSolicitud: ID_SOLICITUD,
    idEstado: 2,
    idResolutor: LUIS,
    motivo: null,
  });
  const aviso = notificar.mock.calls[0].arguments[0];
  assert.equal(aviso.solicitud.id_empleado, ANA);
  assert.equal(aviso.idResolutor, LUIS);
  assert.equal(aviso.nombreResolutor, "Luis Rojas");
  assert.equal(marcar.mock.callCount(), 1);
  assert.equal(resultado.notificacion_enviada, true);
});

test("criterio 2: un rechazo exige justificación y no cambia nada sin ella", async () => {
  await assert.rejects(servicio.resolver(LUIS, ID_SOLICITUD, { decision: "RECHAZADA", motivo: "  " }), (error) => {
    assert.equal(error.estado, 400);
    assert.equal(error.detalles[0].campo, "motivo");
    return true;
  });
  assert.equal(resolver.mock.callCount(), 0);
  assert.equal(notificar.mock.callCount(), 0);
});

test("criterio 2: el rechazo guarda la justificación y la envía en el aviso", async () => {
  modelo.obtener.mock.mockImplementation(async () => (resolver.mock.callCount() > 0 ? resuelta("RECHAZADA", "Sin cobertura") : pendiente));

  await servicio.resolver(LUIS, ID_SOLICITUD, { decision: "RECHAZADA", motivo: " Sin cobertura " });

  assert.equal(resolver.mock.calls[0].arguments[0].idEstado, 3);
  assert.equal(resolver.mock.calls[0].arguments[0].motivo, "Sin cobertura");
  assert.equal(notificar.mock.calls[0].arguments[0].solicitud.motivo_resolucion, "Sin cobertura");
});

test("si el aviso falla de forma reintentable, la resolución se conserva y el aviso queda pendiente", async () => {
  notificar.mock.mockImplementation(async () => ({ aceptada: false, reintentable: true }));

  const resultado = await servicio.resolver(LUIS, ID_SOLICITUD, { decision: "APROBADA" });

  assert.equal(resultado.notificacion_enviada, false);
  assert.equal(marcar.mock.callCount(), 0);
});

test("un rechazo definitivo del aviso no se reintenta eternamente", async () => {
  notificar.mock.mockImplementation(async () => ({ aceptada: false, reintentable: false }));

  await servicio.resolver(LUIS, ID_SOLICITUD, { decision: "APROBADA" });

  assert.equal(marcar.mock.callCount(), 1);
});

test("no permite resolver la propia solicitud", async () => {
  await assert.rejects(servicio.resolver(ANA, ID_SOLICITUD, { decision: "APROBADA" }), (error) => error.estado === 403);
  assert.equal(resolver.mock.callCount(), 0);
});

test("no resuelve una solicitud que ya no está pendiente", async () => {
  modelo.obtener.mock.mockImplementation(async () => resuelta("APROBADA"));

  await assert.rejects(servicio.resolver(LUIS, ID_SOLICITUD, { decision: "RECHAZADA", motivo: "x" }), (error) => error.estado === 409);
  assert.equal(resolver.mock.callCount(), 0);
});

test("si otro supervisor la resolvió primero, responde conflicto sin avisar", async () => {
  resolver.mock.mockImplementation(async () => false);

  await assert.rejects(servicio.resolver(LUIS, ID_SOLICITUD, { decision: "APROBADA" }), (error) => error.estado === 409);
  assert.equal(notificar.mock.callCount(), 0);
});

test("responde 404 si la solicitud no existe o el identificador no es válido", async () => {
  modelo.obtener.mock.mockImplementation(async () => undefined);

  await assert.rejects(servicio.resolver(LUIS, ID_SOLICITUD, { decision: "APROBADA" }), (error) => error.estado === 404);
  await assert.rejects(servicio.resolver(LUIS, "abc", { decision: "APROBADA" }), (error) => error.estado === 404);
});

test("el reintento envía los avisos pendientes y cuenta los aceptados", async () => {
  mock.method(modelo, "listarResolucionesSinNotificar", async () => [resuelta("APROBADA"), resuelta("RECHAZADA", "x")]);
  notificar.mock.mockImplementationOnce(async () => ({ aceptada: true, reintentable: false }));
  notificar.mock.mockImplementationOnce(async () => ({ aceptada: false, reintentable: true }));

  const resultado = await servicio.reintentarAvisosPendientes();

  assert.deepEqual(resultado, { pendientes: 2, enviados: 1 });
  assert.equal(marcar.mock.callCount(), 1);
});

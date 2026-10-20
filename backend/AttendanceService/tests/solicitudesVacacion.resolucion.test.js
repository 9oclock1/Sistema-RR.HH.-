// KAN-53 (RF-33): aprobación o rechazo de solicitudes de vacaciones.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/solicitudesVacacion.model");
const empleados = require("../src/services/empleados.service");
const notificaciones = require("../src/services/notificaciones.service");
const eventos = require("../src/services/eventos.service");
const servicio = require("../src/services/solicitudesVacacion.service");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const ID_SOLICITUD = "9f1c2d3e-0000-4000-8000-000000000002";
const UBICACION = { cargo: "Panadera", area: "Panadería", area_codigo: "PAN", sucursal: "Central" };

const pendiente = {
  id_solicitud: ID_SOLICITUD,
  id_empleado: ANA,
  fecha_inicio: "2026-12-07",
  fecha_fin: "2026-12-11",
  dias_habiles: 5,
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

const DB = { cliente: "transaccion" };
let guardar;
let notificar;
let marcar;
let transaccion;

beforeEach(() => {
  mock.restoreAll();
  mock.method(empleados, "obtener", async () => ({ nombres: "Luis", activo: true }));
  mock.method(empleados, "obtenerNombre", async () => "Luis Rojas");
  mock.method(empleados, "obtenerUbicacion", async () => UBICACION);
  guardar = mock.method(modelo, "resolver", async () => true);
  transaccion = mock.method(modelo, "enTransaccionDeEmpleado", async (_id, trabajo) => trabajo(DB));
  marcar = mock.method(modelo, "marcarResolucionNotificada", async () => {});
  mock.method(modelo, "obtener", async () => (guardar.mock.callCount() > 0 ? resuelta("APROBADA") : pendiente));
  notificar = mock.method(notificaciones, "notificarResolucion", async () => ({ aceptada: true, reintentable: false }));
});

test("criterio 2: al aprobar guarda la resolución en la transacción del empleado y avisa como VACACIONES", async () => {
  const registrar = mock.method(eventos, "registrarIndisponibilidad", async () => 1);

  const resultado = await servicio.resolverSolicitud(LUIS, ID_SOLICITUD, { decision: "aprobada" });

  assert.equal(transaccion.mock.calls[0].arguments[0], ANA);
  assert.deepEqual(guardar.mock.calls[0].arguments[0], {
    idSolicitud: ID_SOLICITUD,
    idEstado: 2,
    idResolutor: LUIS,
    motivo: null,
  });
  assert.equal(guardar.mock.calls[0].arguments[1], DB);
  assert.equal(registrar.mock.calls[0].arguments[0], DB);
  assert.equal(notificar.mock.calls[0].arguments[0].categoria, "VACACIONES");
  assert.equal(marcar.mock.callCount(), 1);
  assert.equal(resultado.notificacion_enviada, true);
  assert.equal(resultado.eventos_sincronizacion, 1);
});

test("criterio 4: el evento de indisponibilidad lleva empleado, área, fechas y quién aprobó", async () => {
  const registrar = mock.method(eventos, "registrarIndisponibilidad", async () => 2);

  await servicio.resolverSolicitud(LUIS, ID_SOLICITUD, { decision: "APROBADA" });

  const datos = registrar.mock.calls[0].arguments[1];
  assert.equal(datos.categoria, "VACACIONES");
  assert.equal(datos.solicitud.fecha_inicio, "2026-12-07");
  assert.equal(datos.solicitud.fecha_fin, "2026-12-11");
  assert.equal(datos.empleado.nombre_completo, "Luis Rojas");
  assert.equal(datos.ubicacion.area_codigo, "PAN");
  assert.equal(datos.aprobadoPor, "Luis Rojas");
});

test("criterio 3: un rechazo exige justificación y no toca el saldo ni la base sin ella", async () => {
  await assert.rejects(servicio.resolverSolicitud(LUIS, ID_SOLICITUD, { decision: "RECHAZADA", motivo: "   " }), (error) => {
    assert.equal(error.estado, 400);
    assert.equal(error.detalles[0].campo, "motivo");
    return true;
  });
  assert.equal(transaccion.mock.callCount(), 0);
  assert.equal(notificar.mock.callCount(), 0);
});

test("criterio 3: el rechazo guarda la justificación, libera los días y no sincroniza con otros módulos", async () => {
  const registrar = mock.method(eventos, "registrarIndisponibilidad", async () => 1);
  modelo.obtener.mock.mockImplementation(async () => (guardar.mock.callCount() > 0 ? resuelta("RECHAZADA", "Sin cobertura") : pendiente));

  const resultado = await servicio.resolverSolicitud(LUIS, ID_SOLICITUD, { decision: "RECHAZADA", motivo: " Sin cobertura " });

  assert.equal(guardar.mock.calls[0].arguments[0].idEstado, 3);
  assert.equal(guardar.mock.calls[0].arguments[0].motivo, "Sin cobertura");
  assert.equal(registrar.mock.callCount(), 0);
  assert.equal(empleados.obtenerUbicacion.mock.callCount(), 0);
  assert.equal(notificar.mock.calls[0].arguments[0].solicitud.motivo_resolucion, "Sin cobertura");
  assert.equal(resultado.eventos_sincronizacion, 0);
});

test("si no se conoce el área del empleado, no aprueba y no deja nada a medias", async () => {
  empleados.obtenerUbicacion.mock.mockImplementation(async () => null);

  await assert.rejects(servicio.resolverSolicitud(LUIS, ID_SOLICITUD, { decision: "APROBADA" }), (error) => error.estado === 503);
  assert.equal(transaccion.mock.callCount(), 0);
  assert.equal(notificar.mock.callCount(), 0);
});

test("si registrar el evento falla, la transacción se deshace y no se avisa al colaborador", async () => {
  mock.method(eventos, "registrarIndisponibilidad", async () => {
    throw new Error("falló el insert");
  });

  await assert.rejects(servicio.resolverSolicitud(LUIS, ID_SOLICITUD, { decision: "APROBADA" }), /falló el insert/);
  assert.equal(notificar.mock.callCount(), 0);
  assert.equal(marcar.mock.callCount(), 0);
});

test("no permite resolver la propia solicitud", async () => {
  await assert.rejects(servicio.resolverSolicitud(ANA, ID_SOLICITUD, { decision: "APROBADA" }), (error) => error.estado === 403);
  assert.equal(transaccion.mock.callCount(), 0);
});

test("no resuelve una solicitud que ya no está pendiente", async () => {
  modelo.obtener.mock.mockImplementation(async () => resuelta("APROBADA"));

  await assert.rejects(servicio.resolverSolicitud(LUIS, ID_SOLICITUD, { decision: "RECHAZADA", motivo: "x" }), (error) => error.estado === 409);
  assert.equal(transaccion.mock.callCount(), 0);
});

test("si otro supervisor la resolvió primero, responde conflicto sin avisar ni sincronizar", async () => {
  const registrar = mock.method(eventos, "registrarIndisponibilidad", async () => 1);
  guardar.mock.mockImplementation(async () => false);

  await assert.rejects(servicio.resolverSolicitud(LUIS, ID_SOLICITUD, { decision: "APROBADA" }), (error) => error.estado === 409);
  assert.equal(registrar.mock.callCount(), 0);
  assert.equal(notificar.mock.callCount(), 0);
});

test("responde 404 si la solicitud no existe o el identificador no es válido", async () => {
  modelo.obtener.mock.mockImplementation(async () => undefined);

  await assert.rejects(servicio.resolverSolicitud(LUIS, ID_SOLICITUD, { decision: "APROBADA" }), (error) => error.estado === 404);
  await assert.rejects(servicio.resolverSolicitud(LUIS, "abc", { decision: "APROBADA" }), (error) => error.estado === 404);
});

test("quien resuelve debe ser un empleado activo", async () => {
  empleados.obtener.mock.mockImplementation(async () => ({ nombres: "Luis", activo: false }));
  await assert.rejects(servicio.resolverSolicitud(LUIS, ID_SOLICITUD, { decision: "APROBADA" }), (error) => error.estado === 403);

  empleados.obtener.mock.mockImplementation(async () => null);
  await assert.rejects(servicio.resolverSolicitud(LUIS, ID_SOLICITUD, { decision: "APROBADA" }), (error) => error.estado === 403);
});

test("si el aviso falla de forma reintentable, la resolución se conserva y el aviso queda pendiente", async () => {
  mock.method(eventos, "registrarIndisponibilidad", async () => 1);
  notificar.mock.mockImplementation(async () => ({ aceptada: false, reintentable: true }));

  const resultado = await servicio.resolverSolicitud(LUIS, ID_SOLICITUD, { decision: "APROBADA" });

  assert.equal(resultado.notificacion_enviada, false);
  assert.equal(marcar.mock.callCount(), 0);
});

test("el reintento de avisos de vacaciones envía los pendientes y cuenta los aceptados", async () => {
  mock.method(modelo, "listarResolucionesSinNotificar", async () => [resuelta("APROBADA"), resuelta("RECHAZADA", "x")]);
  notificar.mock.mockImplementationOnce(async () => ({ aceptada: true, reintentable: false }));
  notificar.mock.mockImplementationOnce(async () => ({ aceptada: false, reintentable: true }));

  const resultado = await servicio.reintentarAvisosPendientes();

  assert.deepEqual(resultado, { pendientes: 2, enviados: 1 });
  assert.equal(notificar.mock.calls[0].arguments[0].categoria, "VACACIONES");
});

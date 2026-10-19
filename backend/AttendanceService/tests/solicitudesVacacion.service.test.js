const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/solicitudesVacacion.model");
const empleados = require("../src/services/empleados.service");
const notificaciones = require("../src/services/notificaciones.service");
const supervisores = require("../src/services/supervisores.service");
const servicio = require("../src/services/solicitudesVacacion.service");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = { id_empleado: "cb7995a6-4b23-4738-ab8b-37d0b203d73b", nombres: "Luis", apellidos: "Rojas" };
const ana = { id_empleado: ANA, nombres: "Ana", apellidos: "Quispe", activo: true, fecha_ingreso: "2024-01-15" };
const NOVIEMBRE = { fecha_inicio: "2026-11-09", fecha_fin: "2026-11-13" };
const TRANSACCION = { transaccion: true };

let registrar;
let avisar;

beforeEach(() => {
  mock.restoreAll();
  mock.method(empleados, "obtener", async (id) => (id === ANA ? ana : null));
  mock.method(modelo, "hoy", async () => "2026-10-18");
  mock.method(supervisores, "obtenerSupervisor", async () => LUIS);
  mock.method(modelo, "listarMovimientos", async () => []);
  mock.method(modelo, "listarTurnosPublicados", async () => []);
  mock.method(modelo, "listarFeriados", async () => []);
  mock.method(modelo, "listarSolapadas", async () => []);
  mock.method(modelo, "marcarNotificada", async () => {});
  mock.method(modelo, "enTransaccionDeEmpleado", async (id, trabajo) => trabajo(TRANSACCION));
  registrar = mock.method(modelo, "registrar", async (datos) => ({
    id_solicitud: "0b8f8c2e-5d0e-4c55-9d0f-6f2b1d2a7c11",
    fecha_inicio: datos.fechaInicio,
    fecha_fin: datos.fechaFin,
    dias_habiles: datos.diasHabiles,
    estado_codigo: "PENDIENTE",
  }));
  avisar = mock.method(notificaciones, "avisarSolicitudVacaciones", async () => true);
});

test("el saldo informa días ganados, comprometidos y disponibles", async () => {
  modelo.listarMovimientos.mock.mockImplementation(async () => [
    { id_estado_movimiento: 2, dias: 2 },
    { id_estado_movimiento: 1, dias: 3 },
    { id_estado_movimiento: 3, dias: 9 },
  ]);
  const saldo = await servicio.consultarSaldo(ANA);
  assert.equal(saldo.dias_ganados, 30);
  assert.equal(saldo.dias_comprometidos, 5);
  assert.equal(saldo.dias_disponibles, 25);
  assert.equal(saldo.empleado.supervisor, LUIS);
  assert.equal(modelo.listarMovimientos.mock.calls[0].arguments[0], ANA);
});

test("el cálculo respeta los turnos publicados: descanso entre semana y trabajo en fin de semana", async () => {
  modelo.listarTurnosPublicados.mock.mockImplementation(async () => [
    { fecha: "2026-11-10", es_descanso: true },
    { fecha: "2026-11-14", es_descanso: false },
  ]);
  const calculo = await servicio.calcular(ANA, { fecha_inicio: "2026-11-09", fecha_fin: "2026-11-15" });
  assert.equal(calculo.dias_habiles, 5);
  assert.equal(calculo.dias_descanso, 2);
  assert.deepEqual(modelo.listarTurnosPublicados.mock.calls[0].arguments.slice(0, 3), [ANA, "2026-11-09", "2026-11-15"]);
});

test("el cálculo excluye feriados y devuelve los problemas sin guardar", async () => {
  modelo.listarFeriados.mock.mockImplementation(async () => [{ fecha: "2026-11-02", nombre: "Difuntos" }]);
  const calculo = await servicio.calcular(ANA, { fecha_inicio: "2026-11-02", fecha_fin: "2026-11-06" });
  assert.equal(calculo.dias_habiles, 4);
  assert.deepEqual(calculo.problemas, []);
  assert.equal(registrar.mock.callCount(), 0);
});

test("registra la solicitud pendiente con los días hábiles calculados por el servidor", async () => {
  const solicitud = await servicio.registrarSolicitud(ANA, { ...NOVIEMBRE, dias_habiles: 1 });
  const [datos, db] = registrar.mock.calls[0].arguments;
  assert.deepEqual(datos, {
    idEmpleado: ANA,
    fechaInicio: "2026-11-09",
    fechaFin: "2026-11-13",
    diasHabiles: 5,
    idSupervisor: LUIS.id_empleado,
  });
  assert.equal(db, TRANSACCION);
  assert.equal(solicitud.estado_codigo, "PENDIENTE");
  assert.equal(solicitud.supervisor_notificado, true);
  assert.equal(solicitud.aviso_notificacion, null);
});

test("las validaciones se leen dentro de la transacción del empleado", async () => {
  await servicio.registrarSolicitud(ANA, NOVIEMBRE);
  assert.equal(modelo.enTransaccionDeEmpleado.mock.calls[0].arguments[0], ANA);
  assert.equal(modelo.listarMovimientos.mock.calls[0].arguments[1], TRANSACCION);
  assert.equal(modelo.listarTurnosPublicados.mock.calls[0].arguments[3], TRANSACCION);
  assert.equal(modelo.listarSolapadas.mock.calls[0].arguments[4], TRANSACCION);
});

test("notifica al supervisor directo y marca la solicitud como notificada", async () => {
  await servicio.registrarSolicitud(ANA, NOVIEMBRE);
  const { empleado, supervisor, solicitud } = avisar.mock.calls[0].arguments[0];
  assert.equal(empleado, ana);
  assert.equal(supervisor, LUIS);
  assert.equal(solicitud.dias_habiles, 5);
  assert.equal(modelo.marcarNotificada.mock.callCount(), 1);
});

test("si la notificación falla, la solicitud queda guardada y se avisa", async () => {
  avisar.mock.mockImplementation(async () => false);
  const solicitud = await servicio.registrarSolicitud(ANA, NOVIEMBRE);
  assert.equal(registrar.mock.callCount(), 1);
  assert.equal(solicitud.supervisor_notificado, false);
  assert.match(solicitud.aviso_notificacion, /no se pudo notificar a su supervisor/);
  assert.equal(modelo.marcarNotificada.mock.callCount(), 0);
});

test("sin supervisor asignado no intenta notificar", async () => {
  supervisores.obtenerSupervisor.mock.mockImplementation(async () => null);
  const solicitud = await servicio.registrarSolicitud(ANA, NOVIEMBRE);
  assert.equal(avisar.mock.callCount(), 0);
  assert.equal(registrar.mock.calls[0].arguments[0].idSupervisor, null);
  assert.match(solicitud.aviso_notificacion, /no tiene un supervisor directo/);
});

test("bloquea el registro por saldo insuficiente", async () => {
  modelo.listarMovimientos.mock.mockImplementation(async () => [{ id_estado_movimiento: 1, dias: 27 }]);
  await assert.rejects(servicio.registrarSolicitud(ANA, NOVIEMBRE), (error) => {
    assert.equal(error.estado, 409);
    assert.equal(error.message, "Saldo insuficiente: solicita 5 días hábiles y tiene 3 disponibles.");
    assert.equal(error.detalles[0].codigo, "SALDO_INSUFICIENTE");
    return true;
  });
  assert.equal(registrar.mock.callCount(), 0);
  assert.equal(avisar.mock.callCount(), 0);
});

test("bloquea el registro por conflicto de fechas", async () => {
  modelo.listarSolapadas.mock.mockImplementation(async () => [
    { fecha_inicio: "2026-11-12", fecha_fin: "2026-11-16", estado_nombre: "Pendiente" },
  ]);
  await assert.rejects(servicio.registrarSolicitud(ANA, NOVIEMBRE), (error) => {
    assert.equal(error.estado, 409);
    assert.equal(error.detalles[0].codigo, "CONFLICTO_FECHAS");
    return true;
  });
  assert.equal(registrar.mock.callCount(), 0);
});

test("bloquea el registro sin la anticipación mínima", async () => {
  await assert.rejects(servicio.registrarSolicitud(ANA, { fecha_inicio: "2026-10-21", fecha_fin: "2026-10-23" }), {
    estado: 409,
    message: "Debe solicitar con al menos 7 días de anticipación: la fecha de inicio más próxima es el 25/10/2026.",
  });
  assert.equal(registrar.mock.callCount(), 0);
});

test("rechaza a quien no tiene un año de antigüedad", async () => {
  empleados.obtener.mock.mockImplementation(async () => ({ ...ana, fecha_ingreso: "2026-02-02" }));
  await assert.rejects(servicio.registrarSolicitud(ANA, NOVIEMBRE), { estado: 403 });
  await assert.rejects(servicio.calcular(ANA, NOVIEMBRE), { estado: 403 });
  assert.equal(registrar.mock.callCount(), 0);
});

test("rechaza fechas inválidas sin consultar al empleado", async () => {
  await assert.rejects(servicio.registrarSolicitud(ANA, { fecha_inicio: "2026-11-13", fecha_fin: "2026-11-09" }), {
    estado: 400,
  });
  assert.equal(empleados.obtener.mock.callCount(), 0);
});

test("rechaza a un empleado inactivo o inexistente", async () => {
  empleados.obtener.mock.mockImplementation(async () => ({ ...ana, activo: false }));
  await assert.rejects(servicio.registrarSolicitud(ANA, NOVIEMBRE), { estado: 403 });
  await assert.rejects(servicio.consultarSaldo("abc"), { estado: 403 });
  assert.equal(registrar.mock.callCount(), 0);
});

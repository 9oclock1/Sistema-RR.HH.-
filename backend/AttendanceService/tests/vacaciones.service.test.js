const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/vacaciones.model");
const empleados = require("../src/services/empleados.service");
const notificaciones = require("../src/services/notificaciones.service");
const servicio = require("../src/services/vacaciones.service");
const { ESTADOS_EN_CURSO } = require("../src/utils/vacaciones");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = { id_empleado: "cb7995a6-4b23-4738-ab8b-37d0b203d73b", nombres: "Luis", apellidos: "Rojas" };
const ana = { id_empleado: ANA, nombres: "Ana", apellidos: "Quispe", activo: true, fecha_ingreso: "2024-01-15", supervisor: LUIS };
const NOVIEMBRE = { fecha_inicio: "2026-11-09", fecha_fin: "2026-11-13" };
const TRANSACCION = { transaccion: true };

let registrar;
let avisar;

beforeEach(() => {
  mock.restoreAll();
  mock.method(empleados, "obtener", async (id) => (id === ANA ? ana : null));
  mock.method(modelo, "hoy", async () => "2026-10-18");
  mock.method(modelo, "sumarDiasEnCurso", async () => 0);
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
  modelo.sumarDiasEnCurso.mock.mockImplementation(async () => 5);
  const saldo = await servicio.consultarSaldo(ANA);
  assert.equal(saldo.dias_ganados, 30);
  assert.equal(saldo.dias_comprometidos, 5);
  assert.equal(saldo.dias_disponibles, 25);
  assert.equal(saldo.empleado.supervisor, LUIS);
  assert.deepEqual(modelo.sumarDiasEnCurso.mock.calls[0].arguments.slice(0, 2), [ANA, ESTADOS_EN_CURSO]);
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
  assert.equal(modelo.sumarDiasEnCurso.mock.calls[0].arguments[2], TRANSACCION);
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
  empleados.obtener.mock.mockImplementation(async () => ({ ...ana, supervisor: null }));
  const solicitud = await servicio.registrarSolicitud(ANA, NOVIEMBRE);
  assert.equal(avisar.mock.callCount(), 0);
  assert.equal(registrar.mock.calls[0].arguments[0].idSupervisor, null);
  assert.match(solicitud.aviso_notificacion, /no tiene un supervisor directo/);
});

test("bloquea el registro por saldo insuficiente", async () => {
  modelo.sumarDiasEnCurso.mock.mockImplementation(async () => 27);
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

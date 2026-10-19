const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../src/config/db");
const modelo = require("../src/models/rolesTurno.model");
const empleados = require("../src/services/empleados.service");
const eventos = require("../src/services/eventos.service");
const servicio = require("../src/services/rolesTurno.service");

const ROL = "11111111-1111-4111-8111-111111111111";
const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const AJENO = "d97320a7-c29b-4405-a33b-a48dc65c6090";
const MANANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOCHE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const VIEJO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DIAS = ["2026-10-12", "2026-10-13"];
const ACTUALIZADO = new Date("2026-10-10T20:00:00Z");

const TURNOS = [
  { id_turno: MANANA, nombre: "Mañana", hora_inicio: "06:00:00", hora_fin: "14:00:00", esta_activo: true, tipo_codigo: "DIURNO" },
  { id_turno: NOCHE, nombre: "Noche", hora_inicio: "22:00:00", hora_fin: "06:00:00", esta_activo: true, tipo_codigo: "NOCTURNO" },
  { id_turno: VIEJO, nombre: "Antiguo", hora_inicio: "08:00:00", hora_fin: "16:00:00", esta_activo: false, tipo_codigo: "DIURNO" },
];

const filaRol = (cambios = {}) => ({
  id_rol: ROL,
  id_sucursal: "s",
  id_departamento: "a",
  fecha_inicio: DIAS[0],
  fecha_fin: DIAS[1],
  periodo_codigo: "SEMANAL",
  periodo_nombre: "Semanal",
  estado_codigo: "BORRADOR",
  estado_nombre: "Borrador",
  version_publicada: 0,
  tiene_cambios_sin_publicar: true,
  publicado_en: null,
  actualizado_en: ACTUALIZADO,
  ...cambios,
});

const celda = (id_empleado, fecha, id_turno) => ({ id_empleado, fecha, id_turno, descanso: id_turno === null });
const completas = () => [celda(ANA, DIAS[0], MANANA), celda(ANA, DIAS[1], null), celda(LUIS, DIAS[0], null), celda(LUIS, DIAS[1], MANANA)];

let asignaciones;
let rol;
let consultasCliente;

beforeEach(() => {
  mock.restoreAll();
  asignaciones = completas();
  rol = filaRol();
  consultasCliente = [];
  mock.method(modelo, "obtener", async () => rol);
  mock.method(modelo, "listarAsignaciones", async () => asignaciones);
  mock.method(modelo, "listarAsignacionesVecinas", async () => []);
  mock.method(modelo, "listarTurnos", async (ids) => TURNOS.filter((t) => ids.includes(t.id_turno)));
  mock.method(modelo, "bloquear", async () => true);
  mock.method(modelo, "aplicarCambios", async () => {});
  mock.method(modelo, "publicar", async () => filaRol({ version_publicada: 1, tiene_cambios_sin_publicar: false, publicado_en: ACTUALIZADO }));
  mock.method(empleados, "listarPorArea", async () => [
    { id_empleado: ANA, nombre_completo: "Ana Quispe", cargo: "Cajera", activo: true },
    { id_empleado: LUIS, nombre_completo: "Luis Rojas", cargo: "Cajero", activo: true },
    { id_empleado: AJENO, nombre_completo: "Carla Flores", cargo: "Reponedora", activo: false },
  ]);
  mock.method(empleados, "obtenerSucursal", async () => ({ id_sucursal: "s", nombre: "Centro" }));
  mock.method(empleados, "obtenerArea", async () => ({ id_departamento: "a", codigo: "PAN", nombre: "Panadería" }));
  mock.method(eventos, "listarDeRol", async () => []);
  mock.method(eventos, "registrarPublicacion", async () => {});
  mock.method(pool, "connect", async () => ({
    query: async (sql) => {
      consultasCliente.push(sql);
      return { rows: [] };
    },
    release: () => {},
  }));
});

test("la matriz tiene al personal activo del área, sin los inactivos", async () => {
  const detalle = await servicio.obtener(ROL);
  assert.deepEqual(detalle.empleados.map((e) => e.id_empleado), [ANA, LUIS]);
  assert.deepEqual(detalle.dias, DIAS);
  assert.equal(detalle.celdas_vacias, 0);
  assert.deepEqual(detalle.turnos.map((t) => [t.nombre, t.hora_inicio]), [["Mañana", "06:00"]]);
});

test("un rol inexistente o con id inválido responde 404", async () => {
  await assert.rejects(servicio.obtener("abc"), { estado: 404 });
  modelo.obtener.mock.mockImplementation(async () => undefined);
  await assert.rejects(servicio.obtener(ROL), { estado: 404 });
});

test("no publica con celdas vacías y explica cuántas faltan", async () => {
  asignaciones = completas().slice(1);
  await assert.rejects(servicio.publicar(ROL), (error) => {
    assert.equal(error.estado, 409);
    assert.match(error.detalles[0].mensaje, /Faltan 1 celda/);
    return true;
  });
  assert.equal(modelo.publicar.mock.callCount(), 0);
});

test("no publica con descanso insuficiente y nombra al colaborador", async () => {
  asignaciones = [celda(ANA, DIAS[0], NOCHE), celda(ANA, DIAS[1], MANANA), celda(LUIS, DIAS[0], null), celda(LUIS, DIAS[1], null)];
  await assert.rejects(servicio.publicar(ROL), (error) => {
    assert.equal(error.estado, 409);
    assert.match(error.detalles[0].mensaje, /^Ana Quispe: No hay descanso entre el turno Noche/);
    return true;
  });
  assert.equal(modelo.publicar.mock.callCount(), 0);
});

test("el descanso se valida también contra el día anterior de otro rol", async () => {
  modelo.listarAsignacionesVecinas.mock.mockImplementation(async () => [celda(ANA, "2026-10-11", NOCHE)]);
  const detalle = await servicio.obtener(ROL);
  assert.equal(detalle.alertas.length, 1);
  assert.equal(detalle.alertas[0].fecha_anterior, "2026-10-11");
});

test("no publica con un turno que fue desactivado", async () => {
  asignaciones = [celda(ANA, DIAS[0], VIEJO), celda(ANA, DIAS[1], null), celda(LUIS, DIAS[0], null), celda(LUIS, DIAS[1], null)];
  await assert.rejects(servicio.publicar(ROL), (error) => {
    assert.match(error.detalles[0].mensaje, /Antiguo está inactivo/);
    return true;
  });
});

test("publica solo al personal vigente y registra el evento en la misma transacción", async () => {
  const detalle = await servicio.publicar(ROL);
  assert.deepEqual(modelo.publicar.mock.calls[0].arguments.slice(1), [ROL, [ANA, LUIS]]);
  const [cliente, datos] = eventos.registrarPublicacion.mock.calls[0].arguments;
  assert.equal(typeof cliente.query, "function");
  assert.equal(datos.version_publicada, 1);
  assert.equal(datos.area.codigo, "PAN");
  assert.deepEqual(consultasCliente.filter((sql) => ["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)), ["BEGIN", "COMMIT"]);
  assert.equal(detalle.id_rol, ROL);
});

test("un rol publicado sin cambios no se vuelve a publicar", async () => {
  rol = filaRol({ version_publicada: 1, tiene_cambios_sin_publicar: false });
  await assert.rejects(servicio.publicar(ROL), { estado: 409, message: /No hay cambios por publicar/ });
});

test("si el rol cambió durante la publicación, se cancela", async () => {
  let llamadas = 0;
  modelo.obtener.mock.mockImplementation(async () => (llamadas++ === 0 ? rol : filaRol({ actualizado_en: new Date() })));
  await assert.rejects(servicio.publicar(ROL), { estado: 409, message: /cambió mientras se publicaba/ });
  assert.equal(modelo.publicar.mock.callCount(), 0);
  assert.ok(consultasCliente.includes("ROLLBACK"));
});

test("un colaborador con turno publicado en otro rol el mismo día: 409", async () => {
  modelo.publicar.mock.mockImplementation(async () => {
    throw Object.assign(new Error("duplicate"), { code: "23505", constraint: "uq_turno_publicado_empleado_fecha" });
  });
  await assert.rejects(servicio.publicar(ROL), { estado: 409, message: /turnos ya publicados en otro rol/ });
});

test("guardar rechaza empleados que no son del área", async () => {
  await assert.rejects(
    servicio.guardarAsignaciones(ROL, { asignaciones: [{ id_empleado: AJENO, fecha: DIAS[0], descanso: true }] }),
    { estado: 400, message: /no pertenecen al área/ }
  );
  assert.equal(modelo.aplicarCambios.mock.callCount(), 0);
});

test("guardar rechaza turnos inactivos o inexistentes", async () => {
  const otro = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  await assert.rejects(
    servicio.guardarAsignaciones(ROL, {
      asignaciones: [
        { id_empleado: ANA, fecha: DIAS[0], id_turno: VIEJO },
        { id_empleado: ANA, fecha: DIAS[1], id_turno: otro },
      ],
    }),
    (error) => {
      assert.equal(error.estado, 400);
      assert.deepEqual(error.detalles.map((d) => d.mensaje), ["El turno Antiguo está inactivo.", `El turno ${otro} no existe.`]);
      return true;
    }
  );
});

test("guardar aplica los cambios con el rol bloqueado", async () => {
  await servicio.guardarAsignaciones(ROL, { asignaciones: [{ id_empleado: ANA, fecha: DIAS[0], id_turno: NOCHE }] });
  assert.equal(modelo.bloquear.mock.callCount(), 1);
  assert.deepEqual(modelo.aplicarCambios.mock.calls[0].arguments.slice(1), [
    ROL,
    [{ id_empleado: ANA, fecha: DIAS[0], id_turno: NOCHE, descanso: false }],
  ]);
});

test("crear un rol que se cruza con otro responde 409 con sus fechas", async () => {
  mock.method(modelo, "crear", async () => {
    throw Object.assign(new Error("conflicting key"), { code: "23P01" });
  });
  mock.method(modelo, "buscarSolapado", async () => filaRol({ periodo_nombre: "Mensual", fecha_inicio: "2026-10-01", fecha_fin: "2026-10-31" }));
  await assert.rejects(
    servicio.crear({ id_sucursal: ROL, id_departamento: ROL, periodo: "SEMANAL", fecha: "2026-10-14" }),
    { estado: 409, message: /\(mensual, del 01\/10\/2026 al 31\/10\/2026\)/ }
  );
});

test("crear exige sucursal y área existentes", async () => {
  empleados.obtenerArea.mock.mockImplementation(async () => null);
  await assert.rejects(
    servicio.crear({ id_sucursal: ROL, id_departamento: ROL, periodo: "SEMANAL", fecha: "2026-10-14" }),
    (error) => {
      assert.equal(error.estado, 400);
      assert.equal(error.detalles[0].campo, "id_departamento");
      return true;
    }
  );
});

test("mis turnos: valida el rango de fechas y el empleado", async () => {
  mock.method(modelo, "hoy", async () => "2026-10-10");
  mock.method(modelo, "listarPublicadosDeEmpleado", async () => [
    { fecha: "2026-10-10", descanso: false, nombre_turno: "Mañana", hora_inicio: "06:00:00", hora_fin: "14:00:00" },
  ]);
  const resultado = await servicio.misTurnos(ANA);
  assert.deepEqual(resultado, {
    hoy: "2026-10-10",
    desde: "2026-10-10",
    hasta: "2026-10-16",
    turnos: [{ fecha: "2026-10-10", descanso: false, turno: { nombre: "Mañana", hora_inicio: "06:00", hora_fin: "14:00" } }],
  });
  await assert.rejects(servicio.misTurnos("abc"), { estado: 403 });
  await assert.rejects(servicio.misTurnos(ANA, { desde: "2026-13-01" }), { estado: 400 });
  await assert.rejects(servicio.misTurnos(ANA, { desde: "2026-10-10", hasta: "2026-10-09" }), { estado: 400 });
  await assert.rejects(servicio.misTurnos(ANA, { desde: "2026-10-01", hasta: "2026-12-31" }), { estado: 400 });
});

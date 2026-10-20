// KAN-55 (RF-35): alcance por rol, consulta del calendario, umbrales y contrato HTTP.
const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const modelo = require("../src/models/calendarioAusencias.model");
const empleados = require("../src/services/empleados.service");
const servicio = require("../src/services/calendarioAusencias.service");
const rutas = require("../src/routes/calendarioAusencias.routes");
const manejadorErrores = require("../src/middlewares/manejadorErrores");

const SUC = "11111111-1111-4111-8111-111111111111";
const OTRA = "99999999-9999-4999-8999-999999999999";
const PAN = "22222222-2222-4222-8222-222222222222";
const SUPERVISOR = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const RRHH = "d97320a7-c29b-4405-a33b-a48dc65c6090";
const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "5a0c3a0e-1111-4111-8111-000000000001";
const ID_UMBRAL = "7a1c2d3e-0000-4000-8000-000000000009";

const PERSONAL = [
  { id_empleado: ANA, nombre_completo: "Ana Quispe", cargo: "Panadera", area: "Panadería", id_departamento: PAN, activo: true },
  { id_empleado: LUIS, nombre_completo: "Luis Rojas", cargo: "Panadero", area: "Panadería", id_departamento: PAN, activo: true },
  { id_empleado: "baja", nombre_completo: "Carla Flores", cargo: "Panadera", area: "Panadería", id_departamento: PAN, activo: false },
];

const supervisor = { rol: "supervisor", idEmpleado: SUPERVISOR };
const rrhh = { rol: "admin", idEmpleado: RRHH };

beforeEach(() => {
  mock.restoreAll();
  mock.method(modelo, "hoy", async () => "2026-11-18");
  mock.method(empleados, "obtenerUbicacionConArea", async () => ({ id_sucursal: SUC, id_departamento: PAN }));
  mock.method(empleados, "listarPorArea", async () => PERSONAL);
  mock.method(empleados, "obtenerSucursal", async (id) => ({ id_sucursal: id, nombre: "Central" }));
  mock.method(empleados, "obtenerArea", async (id) => ({ id_departamento: id, nombre: "Panadería" }));
  mock.method(empleados, "listarSucursales", async () => [{ id_sucursal: SUC, nombre: "Central" }, { id_sucursal: OTRA, nombre: "Norte" }]);
  mock.method(empleados, "listarAreas", async () => [{ id_departamento: PAN, nombre: "Panadería" }]);
  mock.method(modelo, "listarTurnos", async () => []);
  mock.method(modelo, "listarFeriados", async () => []);
  mock.method(modelo, "listarUmbrales", async () => []);
  mock.method(modelo, "listarAprobadas", async () => [
    {
      categoria: "VACACIONES", id_solicitud: "s-1", id_empleado: ANA, tipo_codigo: "VACACIONES", tipo_nombre: "Vacaciones",
      fecha_inicio: "2026-11-09", fecha_fin: "2026-11-13", dias: 5, es_con_goce_haberes: true,
    },
    {
      categoria: "LICENCIA", id_solicitud: "s-2", id_empleado: LUIS, tipo_codigo: "MEDICA", tipo_nombre: "Licencia médica",
      fecha_inicio: "2026-11-10", fecha_fin: "2026-11-11", dias: 2, es_con_goce_haberes: true,
    },
  ]);
});

test("solo RRHH y supervisores acceden; el supervisor debe identificarse", async () => {
  await assert.rejects(servicio.consultar({ id_sucursal: SUC }, { rol: "empleado", idEmpleado: ANA }), (e) => e.estado === 403);
  await assert.rejects(servicio.consultar({ id_sucursal: SUC }, {}), (e) => e.estado === 403);
  await assert.rejects(servicio.consultar({}, { rol: "supervisor" }), (e) => e.estado === 401);
  await assert.rejects(servicio.consultar({}, { rol: "supervisor", idEmpleado: "no" }), (e) => e.estado === 400);
});

test("un supervisor sin sucursal asignada o desconocido no accede", async () => {
  empleados.obtenerUbicacionConArea.mock.mockImplementation(async () => null);
  await assert.rejects(servicio.consultar({}, supervisor), (e) => e.estado === 403);
  empleados.obtenerUbicacionConArea.mock.mockImplementation(async () => ({ id_sucursal: null }));
  await assert.rejects(servicio.consultar({}, supervisor), (e) => e.estado === 403);
});

test("el supervisor ve su sucursal por defecto y no puede pedir otra", async () => {
  const propia = await servicio.consultar({}, supervisor);
  assert.equal(propia.filtros.sucursal.id_sucursal, SUC);

  await assert.rejects(servicio.consultar({ id_sucursal: OTRA }, supervisor), (e) => e.estado === 403 && /su sucursal/.test(e.message));
});

test("RRHH elige cualquier sucursal pero debe elegir una", async () => {
  const resultado = await servicio.consultar({ id_sucursal: OTRA }, rrhh);
  assert.equal(resultado.filtros.sucursal.id_sucursal, OTRA);
  await assert.rejects(servicio.consultar({}, rrhh), (e) => e.estado === 400 && e.detalles[0].campo === "id_sucursal");
  await assert.rejects(servicio.consultar({ id_sucursal: SUC, id_departamento: "x" }, rrhh), (e) => e.detalles[0].campo === "id_departamento");
});

test("criterio 1: devuelve las vacaciones y licencias aprobadas del personal activo de la sucursal en el rango", async () => {
  const resultado = await servicio.consultar({ id_sucursal: SUC, desde: "2026-11-09", hasta: "2026-11-15" }, rrhh);

  assert.deepEqual(empleados.listarPorArea.mock.calls[0].arguments, [SUC, null]);
  const [ids, desde, hasta] = modelo.listarAprobadas.mock.calls[0].arguments;
  assert.deepEqual(ids, [ANA, LUIS]);
  assert.deepEqual([desde, hasta], ["2026-11-09", "2026-11-15"]);
  assert.equal(resultado.equipo.activos, 2);
  assert.equal(resultado.ausencias.length, 2);
  assert.equal(resultado.dias.length, 7);
  assert.equal(resultado.resumen.colaboradores_ausentes, 2);
  assert.equal(resultado.filtros.sucursal.nombre, "Central");
});

test("criterio 4: cada ausencia trae colaborador, cargo, tipo y período aprobado", async () => {
  const { ausencias } = await servicio.consultar({ id_sucursal: SUC, desde: "2026-11-09", hasta: "2026-11-15" }, rrhh);

  assert.deepEqual(ausencias[1], {
    clave: "LICENCIA-s-2",
    categoria: "LICENCIA",
    id_solicitud: "s-2",
    tipo: { codigo: "MEDICA", nombre: "Licencia médica" },
    empleado: { id_empleado: LUIS, nombre_completo: "Luis Rojas", cargo: "Panadero", area: "Panadería", id_departamento: PAN },
    fecha_inicio: "2026-11-10",
    fecha_fin: "2026-11-11",
    dias: 2,
    con_goce_haberes: true,
  });
});

test("criterio 2: el filtro por departamento se pide a EmployeeService y se informa", async () => {
  const resultado = await servicio.consultar({ id_sucursal: SUC, id_departamento: PAN }, rrhh);

  assert.deepEqual(empleados.listarPorArea.mock.calls[0].arguments, [SUC, PAN]);
  assert.deepEqual(resultado.filtros.area, { id_departamento: PAN, nombre: "Panadería" });
});

test("criterio 3: marca la baja cobertura cuando coinciden ausencias sobre el umbral", async () => {
  // Martes 10 y miércoles 11: Ana (vacaciones) y Luis (licencia) = 2 de 2 programados.
  const { dias, resumen } = await servicio.consultar({ id_sucursal: SUC, desde: "2026-11-09", hasta: "2026-11-13" }, rrhh);

  assert.deepEqual(dias.map((d) => d.baja_cobertura), [true, true, true, true, true]);
  assert.equal(dias[1].alertas[0].ausentes, 2);
  assert.equal(resumen.dias_con_baja_cobertura, 5);
});

test("los umbrales configurados se aplican a la consulta", async () => {
  modelo.listarUmbrales.mock.mockImplementation(async () => [
    { id_sucursal: null, id_departamento: PAN, max_ausentes_porcentaje: 100, min_presentes: 0 },
  ]);

  const { dias } = await servicio.consultar({ id_sucursal: SUC, desde: "2026-11-09", hasta: "2026-11-13" }, rrhh);

  assert.ok(dias.every((d) => !d.baja_cobertura));
});

test("un rango inválido responde 400", async () => {
  await assert.rejects(servicio.consultar({ id_sucursal: SUC, desde: "2026-11-30", hasta: "2026-11-01" }, rrhh), (e) => e.estado === 400);
});

test("el alcance de RRHH lista todas las sucursales y permite configurar; el del supervisor, solo la suya", async () => {
  const deRrhh = await servicio.alcance(rrhh);
  assert.equal(deRrhh.sucursales.length, 2);
  assert.equal(deRrhh.puede_configurar, true);
  assert.equal(deRrhh.sucursal_fija, null);
  assert.ok(deRrhh.tipos.some((t) => t.codigo === "VACACIONES"));

  const deSupervisor = await servicio.alcance(supervisor);
  assert.deepEqual(deSupervisor.sucursales, [{ id_sucursal: SUC, nombre: "Central" }]);
  assert.equal(deSupervisor.puede_configurar, false);
  assert.equal(deSupervisor.sucursal_fija, SUC);
});

test("solo RRHH guarda o elimina umbrales; el supervisor puede consultarlos", async () => {
  const guardar = mock.method(modelo, "guardarUmbral", async (datos) => ({ id_umbral: ID_UMBRAL, ...datos }));
  const eliminar = mock.method(modelo, "eliminarUmbral", async () => true);

  await assert.rejects(servicio.guardarUmbral({ max_ausentes_porcentaje: 30 }, supervisor), (e) => e.estado === 403);
  await assert.rejects(servicio.eliminarUmbral(ID_UMBRAL, supervisor), (e) => e.estado === 403);
  assert.equal(guardar.mock.callCount() + eliminar.mock.callCount(), 0);

  await servicio.guardarUmbral({ id_departamento: PAN, max_ausentes_porcentaje: 25, min_presentes: 2 }, rrhh);
  assert.deepEqual(guardar.mock.calls[0].arguments[0], {
    idSucursal: null,
    idDepartamento: PAN,
    maxAusentesPorcentaje: 25,
    minPresentes: 2,
    idEmpleado: RRHH,
  });
  assert.deepEqual(await servicio.eliminarUmbral(ID_UMBRAL, rrhh), { eliminado: true });

  const lectura = await servicio.listarUmbrales(supervisor);
  assert.equal(lectura.predeterminado.max_ausentes_porcentaje, 30);
});

test("eliminar un umbral inexistente o con identificador inválido responde 404", async () => {
  mock.method(modelo, "eliminarUmbral", async () => false);
  await assert.rejects(servicio.eliminarUmbral(ID_UMBRAL, rrhh), (e) => e.estado === 404);
  await assert.rejects(servicio.eliminarUmbral("abc", rrhh), (e) => e.estado === 404);
});

// --- Contrato HTTP ---
let servidor;
let base;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(rutas);
  app.use(manejadorErrores);
  await new Promise((listo) => {
    servidor = app.listen(0, "127.0.0.1", listo);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

const pedir = (ruta, { metodo = "GET", rol, empleado, cuerpo } = {}) =>
  fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(rol && { "X-Rol": rol }), ...(empleado && { "X-Empleado-Id": empleado }) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

test("HTTP: la consulta responde el calendario sin caché compartida y rechaza a un empleado común", async () => {
  const bien = await pedir(`/calendario/ausencias?id_sucursal=${SUC}&desde=2026-11-09&hasta=2026-11-15`, { rol: "Gerente" });
  assert.equal(bien.status, 200);
  assert.equal(bien.headers.get("cache-control"), "private, no-store");
  const cuerpo = await bien.json();
  assert.equal(cuerpo.ausencias.length, 2);
  assert.equal(cuerpo.dias.length, 7);

  const mal = await pedir(`/calendario/ausencias?id_sucursal=${SUC}`, { rol: "empleado", empleado: ANA });
  assert.equal(mal.status, 403);
});

test("HTTP: guardar un umbral exige RRHH y valida el cuerpo", async () => {
  mock.method(modelo, "guardarUmbral", async (datos) => ({ id_umbral: ID_UMBRAL, ...datos }));

  const prohibido = await pedir("/calendario/umbrales", { metodo: "PUT", rol: "supervisor", empleado: SUPERVISOR, cuerpo: { max_ausentes_porcentaje: 30 } });
  assert.equal(prohibido.status, 403);

  const invalido = await pedir("/calendario/umbrales", { metodo: "PUT", rol: "admin", empleado: RRHH, cuerpo: { max_ausentes_porcentaje: 500 } });
  assert.equal(invalido.status, 400);

  const bien = await pedir("/calendario/umbrales", { metodo: "PUT", rol: "admin", empleado: RRHH, cuerpo: { max_ausentes_porcentaje: 40, id_departamento: PAN } });
  assert.equal(bien.status, 200);
  assert.equal((await bien.json()).id_umbral, ID_UMBRAL);
});

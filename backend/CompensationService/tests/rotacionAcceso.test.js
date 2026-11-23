// Acceso al dashboard de rotación por HTTP: quién consulta y su rol salen del JWT firmado por AuthService,
// nunca de las cabeceras X-Empleado-Id / X-Rol.
const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "secreto-de-prueba";
const modelo = require("../src/models/rotacion.model");
const empleadosCliente = require("../src/clients/empleados.cliente");

const SOP = "aaaaaaaa-0000-4000-8000-000000000001";
const MIR = "aaaaaaaa-0000-4000-8000-000000000002";
const SUPERVISOR = "cccccccc-0000-4000-8000-000000000001";
const GERENTE = "cccccccc-0000-4000-8000-000000000002";
const EMPLEADO = "cccccccc-0000-4000-8000-000000000003";

const persona = (id, idSucursal) => ({
  id_empleado: id,
  fecha_ingreso: "2020-01-15",
  id_sucursal: idSucursal,
  id_departamento: "bbbbbbbb-0000-4000-8000-000000000001",
  estado_codigo: "ACTIVO",
  activo: true,
});

const app = express();
app.use(require("../src/routes/rotacion.routes"));
app.use(require("../src/middlewares/manejadorErrores"));

let servidor;
let base;
before(async () => {
  servidor = app.listen(0);
  await new Promise((listo) => servidor.once("listening", listo));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

beforeEach(() => {
  mock.method(empleadosCliente, "listarEmpleados", async () => [
    persona(SUPERVISOR, MIR),
    persona(GERENTE, SOP),
    persona(EMPLEADO, SOP),
    persona("dddddddd-0000-4000-8000-000000000001", SOP),
    persona("dddddddd-0000-4000-8000-000000000002", MIR),
  ]);
  mock.method(modelo, "listarBajas", async () => []);
  mock.method(modelo, "listarCausales", async () => [{ codigo: "RENUNCIA", nombre: "Renuncia voluntaria" }]);
});
afterEach(() => mock.restoreAll());

const token = (sub, rol, secreto = "secreto-de-prueba", opciones = {}) =>
  jwt.sign({ rol }, secreto, { subject: sub, expiresIn: 60, ...opciones });
const pedir = (consulta = "", cabeceras = {}) => fetch(`${base}/indicadores/rotacion${consulta}`, { headers: cabeceras });
const conCookie = (t, extra = {}) => ({ Cookie: `otra=1; rrhh_sesion=${t}`, ...extra });

test("sin sesión responde 401 aunque se envíen X-Empleado-Id y X-Rol", async () => {
  const r = await pedir("", { "X-Empleado-Id": GERENTE, "X-Rol": "gerente" });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).codigo, "SIN_SESION");
  assert.equal(empleadosCliente.listarEmpleados.mock.callCount(), 0);
});

test("un token alterado, firmado con otro secreto o vencido responde 401", async () => {
  const valido = token(EMPLEADO, "empleado");
  const [cabecera, , firma] = valido.split(".");
  const carga = Buffer.from(JSON.stringify({ sub: EMPLEADO, rol: "gerente", exp: 9999999999 })).toString("base64url");
  for (const t of [`${cabecera}.${carga}.${firma}`, token(EMPLEADO, "gerente", "otro-secreto"), token(GERENTE, "gerente", undefined, { expiresIn: -10 })]) {
    assert.equal((await pedir("", conCookie(t))).status, 401);
  }
});

test("un empleado no entra aunque se ponga X-Rol gerente", async () => {
  const r = await pedir("", conCookie(token(EMPLEADO, "empleado"), { "X-Rol": "gerente", "X-Empleado-Id": GERENTE }));
  assert.equal(r.status, 403);
});

test("el supervisor ve solo su sucursal (la del token), aunque cambie las cabeceras o pida otra", async () => {
  const supervisor = token(SUPERVISOR, "supervisor");
  const propia = await pedir("", conCookie(supervisor, { "X-Rol": "admin" }));
  assert.equal(propia.status, 200);
  const datos = await propia.json();
  assert.deepEqual(datos.filtros, { id_sucursal: MIR, id_departamento: null });
  assert.deepEqual(datos.alcance, { rol: "supervisor", sucursal_fija: true });
  assert.equal(propia.headers.get("cache-control"), "private, no-store");

  assert.equal((await pedir(`?id_sucursal=${SOP}`, conCookie(supervisor))).status, 403);
  // Con el id de otro colaborador en la cabecera sigue siendo él mismo: Miraflores.
  const otra = await pedir("", { Authorization: `Bearer ${supervisor}`, "X-Empleado-Id": GERENTE });
  assert.equal((await otra.json()).filtros.id_sucursal, MIR);
});

test("el gerente (rol del token) ve toda la cadena y puede filtrar por sucursal", async () => {
  const gerente = token(GERENTE, "gerente");
  const todo = await pedir("", conCookie(gerente));
  assert.equal(todo.status, 200);
  assert.deepEqual((await todo.json()).alcance, { rol: "gerente", sucursal_fija: false });
  const filtrado = await pedir(`?id_sucursal=${MIR}`, conCookie(gerente));
  assert.equal((await filtrado.json()).filtros.id_sucursal, MIR);
});

// KAN-53 (RF-33): control de acceso y contrato HTTP de las rutas de aprobaciones.
const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const servicio = require("../src/services/aprobaciones.service");
const rutas = require("../src/routes/aprobaciones.routes");
const manejadorErrores = require("../src/middlewares/manejadorErrores");

const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const ID = "9f1c2d3e-0000-4000-8000-000000000002";

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
beforeEach(() => mock.restoreAll());

const pedir = (ruta, { metodo = "GET", rol, empleado, cuerpo } = {}) =>
  fetch(`${base}${ruta}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(rol && { "X-Rol": rol }),
      ...(empleado && { "X-Empleado-Id": empleado }),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

test("un empleado común no entra a la bandeja ni al detalle ni a resolver", async () => {
  const listar = mock.method(servicio, "listarBandeja", async () => ({}));
  for (const [ruta, metodo] of [
    ["/aprobaciones/solicitudes?id_sucursal=x", "GET"],
    [`/aprobaciones/solicitudes/VACACIONES/${ID}`, "GET"],
    [`/aprobaciones/solicitudes/VACACIONES/${ID}/resolucion`, "POST"],
  ]) {
    const respuesta = await pedir(ruta, { metodo, rol: "empleado", empleado: LUIS, cuerpo: metodo === "POST" ? {} : undefined });
    assert.equal(respuesta.status, 403, ruta);
  }
  assert.equal((await pedir("/aprobaciones/solicitudes")).status, 403);
  assert.equal(listar.mock.callCount(), 0);
});

test("un supervisor lista la bandeja con sus filtros", async () => {
  const listar = mock.method(servicio, "listarBandeja", async () => ({ resumen: {}, solicitudes: [] }));

  const respuesta = await pedir("/aprobaciones/solicitudes?id_sucursal=abc&estado=PENDIENTE", { rol: "supervisor" });

  assert.equal(respuesta.status, 200);
  assert.equal(listar.mock.calls[0].arguments[0].id_sucursal, "abc");
  assert.equal(listar.mock.calls[0].arguments[0].estado, "PENDIENTE");
});

test("resolver exige identificar al empleado y entrega el rol y la decisión al servicio", async () => {
  const resolver = mock.method(servicio, "resolver", async () => ({ ok: true }));

  const sinEmpleado = await pedir(`/aprobaciones/solicitudes/VACACIONES/${ID}/resolucion`, {
    metodo: "POST",
    rol: "supervisor",
    cuerpo: { decision: "APROBADA" },
  });
  assert.equal(sinEmpleado.status, 401);

  const respuesta = await pedir(`/aprobaciones/solicitudes/LICENCIA/${ID}/resolucion`, {
    metodo: "POST",
    rol: "Gerente",
    empleado: LUIS,
    cuerpo: { decision: "RECHAZADA", motivo: "Sin cobertura" },
  });

  assert.equal(respuesta.status, 200);
  assert.deepEqual(resolver.mock.calls[0].arguments, [
    "LICENCIA",
    LUIS,
    ID,
    { decision: "RECHAZADA", motivo: "Sin cobertura" },
    { rol: "gerente" },
  ]);
});

test("los errores del servicio llegan con su estado y detalle", async () => {
  mock.method(servicio, "obtenerDetalle", async () => {
    const { ErrorApp } = require("../src/utils/errores");
    throw new ErrorApp(404, "Solicitud no encontrada");
  });

  const respuesta = await pedir(`/aprobaciones/solicitudes/VACACIONES/${ID}`, { rol: "admin" });

  assert.equal(respuesta.status, 404);
  assert.match((await respuesta.json()).error, /no encontrada/);
});

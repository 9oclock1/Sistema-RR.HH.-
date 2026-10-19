// KAN-54 (RF-34): alertas del resultado de una solicitud de ausencia.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/notificaciones.model");
const empleados = require("../src/services/empleados.service");
const correo = require("../src/services/correo.service");
const servicio = require("../src/services/notificaciones.service");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const ID_SOLICITUD = "9f1c2d3e-0000-4000-8000-000000000001";
const ID_NOTIFICACION = "7a1c2d3e-0000-4000-8000-000000000009";

const resolucion = (cambios = {}) => ({
  id_solicitud: ID_SOLICITUD,
  id_empleado: ANA,
  estado: "APROBADA",
  tipo_solicitud: "Licencia médica",
  fecha_inicio: "2026-11-02",
  fecha_fin: "2026-11-04",
  resuelto_por_nombre: "Luis Rojas",
  ...cambios,
});

let crear;
let registrarCorreo;
let enviarCorreo;

beforeEach(() => {
  mock.restoreAll();
  delete process.env.PORTAL_URL;
  crear = mock.method(modelo, "crear", async (datos) => ({
    notificacion: { id_notificacion: ID_NOTIFICACION, ...datos, titulo: datos.titulo, correo_estado: "NO_APLICA" },
    creada: true,
  }));
  registrarCorreo = mock.method(modelo, "registrarCorreo", async () => {});
  mock.method(empleados, "obtenerEmpleado", async () => ({ id_empleado: ANA, correo: "ana.quispe@ejemplo.com", activo: true }));
  enviarCorreo = mock.method(correo, "enviarCorreo", async () => ({ enviado: true, motivo: null }));
});

test("criterio 1: genera la alerta del portal para el colaborador con el resultado", async () => {
  const { creada } = await servicio.notificarResolucionSolicitud(resolucion());

  const datos = crear.mock.calls[0].arguments[0];
  assert.equal(creada, true);
  assert.equal(datos.idEmpleado, ANA);
  assert.equal(datos.tipo, "SOLICITUD_APROBADA");
  assert.equal(datos.titulo, "Solicitud aprobada: Licencia médica");
  assert.match(datos.mensaje, /fue aprobada por Luis Rojas/);
  assert.match(datos.mensaje, /02\/11\/2026 al 04\/11\/2026/);
});

test("criterio 2: el rechazo incluye la justificación formal del supervisor", async () => {
  await servicio.notificarResolucionSolicitud(
    resolucion({ estado: "rechazada", motivo_resolucion: "  Falta cobertura en el área.  " })
  );

  const datos = crear.mock.calls[0].arguments[0];
  assert.equal(datos.tipo, "SOLICITUD_RECHAZADA");
  assert.match(datos.mensaje, /fue rechazada/);
  assert.match(datos.mensaje, /Justificación: Falta cobertura en el área\.$/);
});

test("criterio 2: rechaza un rechazo sin justificación", async () => {
  await assert.rejects(servicio.notificarResolucionSolicitud(resolucion({ estado: "RECHAZADA", motivo_resolucion: "  " })), (error) => {
    assert.equal(error.estado, 400);
    assert.equal(error.detalles[0].campo, "motivo_resolucion");
    return true;
  });
  assert.equal(crear.mock.callCount(), 0);
});

test("criterio 3: envía el correo resumen cuando el colaborador tiene correo", async () => {
  process.env.PORTAL_URL = "https://rrhh.empresa.com/";

  const { correo: resultado, notificacion } = await servicio.notificarResolucionSolicitud(resolucion());

  const { para, asunto, texto } = enviarCorreo.mock.calls[0].arguments[0];
  assert.equal(para, "ana.quispe@ejemplo.com");
  assert.equal(asunto, "Solicitud aprobada: Licencia médica");
  assert.match(texto, /Su solicitud de «Licencia médica»/);
  assert.match(texto, new RegExp(`https://rrhh\\.empresa\\.com/asistencia/licencias\\?solicitud=${ID_SOLICITUD}`));
  assert.deepEqual(registrarCorreo.mock.calls[0].arguments.slice(1), ["ENVIADO", null]);
  assert.equal(resultado.enviado, true);
  assert.equal(notificacion.correo_estado, "ENVIADO");
});

test("criterio 3: sin correo registrado la alerta queda y el correo no aplica", async () => {
  empleados.obtenerEmpleado.mock.mockImplementation(async () => ({ id_empleado: ANA, correo: null }));
  enviarCorreo.mock.mockImplementation(async ({ para }) => ({ enviado: false, motivo: para ? "x" : "Sin correo." }));

  const { notificacion } = await servicio.notificarResolucionSolicitud(resolucion());

  assert.equal(notificacion.correo_estado, "NO_APLICA");
});

test("si el correo falla, la alerta igual queda y se registra el fallo", async () => {
  enviarCorreo.mock.mockImplementation(async () => ({ enviado: false, motivo: "SMTP caído" }));

  const { notificacion, correo: resultado } = await servicio.notificarResolucionSolicitud(resolucion());

  assert.equal(resultado.enviado, false);
  assert.equal(notificacion.correo_estado, "FALLIDO");
  assert.deepEqual(registrarCorreo.mock.calls[0].arguments.slice(1), ["FALLIDO", "SMTP caído"]);
});

test("si EmployeeService no responde, la alerta se crea y solo se omite el correo", async () => {
  empleados.obtenerEmpleado.mock.mockImplementation(async () => {
    throw new Error("sin conexión");
  });
  enviarCorreo.mock.mockImplementation(async () => ({ enviado: false, motivo: "Sin correo." }));

  const { creada, notificacion } = await servicio.notificarResolucionSolicitud(resolucion());

  assert.equal(creada, true);
  assert.equal(notificacion.correo_estado, "NO_APLICA");
});

test("un reintento del mismo evento no duplica la alerta ni reenvía el correo", async () => {
  crear.mock.mockImplementation(async () => ({
    notificacion: { id_notificacion: ID_NOTIFICACION, correo_estado: "ENVIADO", correo_detalle: null },
    creada: false,
  }));

  const resultado = await servicio.notificarResolucionSolicitud(resolucion());

  assert.equal(resultado.creada, false);
  assert.equal(enviarCorreo.mock.callCount(), 0);
});

test("valida los campos de la resolución", async () => {
  await assert.rejects(
    servicio.notificarResolucionSolicitud({ id_solicitud: "x", estado: "PENDIENTE", fecha_inicio: "02-11-2026" }),
    (error) => {
      assert.equal(error.estado, 400);
      const campos = error.detalles.map((d) => d.campo);
      assert.deepEqual(campos, ["estado", "id_solicitud", "id_empleado", "tipo_solicitud", "fecha_inicio", "fecha_fin"]);
      return true;
    }
  );
});

test("lista las alertas con el total de no leídas y acota la página", async () => {
  const listar = mock.method(modelo, "listar", async () => [{ id_notificacion: ID_NOTIFICACION }]);
  mock.method(modelo, "contarNoLeidas", async () => 3);

  const resultado = await servicio.listarMisNotificaciones(ANA, { estado: "no_leidas", limite: "500", desplazamiento: "-4" });

  assert.deepEqual(listar.mock.calls[0].arguments, [ANA, { soloNoLeidas: true, limite: 50, desplazamiento: 0 }]);
  assert.equal(resultado.no_leidas, 3);
  assert.equal(resultado.notificaciones.length, 1);
});

test("marcar como leída una alerta ajena responde como inexistente", async () => {
  mock.method(modelo, "marcarLeida", async () => undefined);

  await assert.rejects(servicio.marcarLeida(ANA, ID_NOTIFICACION), (error) => error.estado === 404);
});

test("marcar como leída rechaza un identificador que no es UUID", async () => {
  await assert.rejects(servicio.marcarLeida(ANA, "abc"), (error) => error.estado === 400);
});

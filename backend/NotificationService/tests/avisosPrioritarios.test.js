// RF-39 (KAN-59): mensajes directos de alta prioridad con aviso por correo.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/comunicaciones.model");
const empleados = require("../src/services/empleados.service");
const correo = require("../src/services/correo.service");
const servicio = require("../src/services/comunicaciones.service");

const RRHH = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const ana = { id_empleado: ANA, nombres: "Ana", apellidos: "Quispe", correo: "ana.quispe@ejemplo.com", activo: true };

const aviso = (cambios = {}) => ({
  idUsuarioRemitente: RRHH,
  idEmpleadoDestinatario: ANA,
  remitenteNombre: "Recursos Humanos (memorándums)",
  asunto: "Memorándum MEM-2026-0007: llamada de atención",
  contenido: "Se emitió a su nombre el memorándum MEM-2026-0007.",
  prioridad: "ALTA",
  enlace: "/comunicaciones/memorandums",
  notificarCorreo: true,
  ...cambios,
});

let crear;
let enviarCorreo;

beforeEach(() => {
  mock.restoreAll();
  delete process.env.PORTAL_URL;
  mock.method(empleados, "verificarEmpleadoActivo", async () => ana);
  crear = mock.method(modelo, "crearComunicacion", async (datos) => ({ id_comunicacion: "c1", ...datos }));
  enviarCorreo = mock.method(correo, "enviarCorreo", async () => ({ enviado: true, motivo: null }));
});

test("guarda el aviso con prioridad alta y el enlace al portal", async () => {
  await servicio.enviarComunicacionDirecta(aviso());

  const datos = crear.mock.calls[0].arguments[0];
  assert.equal(datos.prioridad, "ALTA");
  assert.equal(datos.enlace, "/comunicaciones/memorandums");
  assert.deepEqual(datos.idsEmpleadosDestinatarios, [ANA]);
});

test("envía el correo al destinatario con el asunto marcado y el acceso al portal", async () => {
  process.env.PORTAL_URL = "https://rrhh.empresa.com/";

  const resultado = await servicio.enviarComunicacionDirecta(aviso());

  const { para, asunto, texto } = enviarCorreo.mock.calls[0].arguments[0];
  assert.equal(para, "ana.quispe@ejemplo.com");
  assert.equal(asunto, "[Prioridad alta] Memorándum MEM-2026-0007: llamada de atención");
  assert.match(texto, /^Se emitió a su nombre el memorándum MEM-2026-0007\./);
  assert.match(texto, /https:\/\/rrhh\.empresa\.com\/comunicaciones\/memorandums/);
  assert.deepEqual(resultado.correo, { enviado: true, motivo: null });
});

test("si el correo falla, el mensaje igual queda entregado e informa el motivo", async () => {
  enviarCorreo.mock.mockImplementation(async () => ({ enviado: false, motivo: "SMTP caído" }));

  const resultado = await servicio.enviarComunicacionDirecta(aviso());

  assert.equal(crear.mock.callCount(), 1);
  assert.deepEqual(resultado.correo, { enviado: false, motivo: "SMTP caído" });
});

test("sin notificar_correo no envía correo y la prioridad por defecto es normal", async () => {
  const resultado = await servicio.enviarComunicacionDirecta(
    aviso({ prioridad: undefined, enlace: undefined, notificarCorreo: false })
  );

  assert.equal(enviarCorreo.mock.callCount(), 0);
  assert.equal(resultado.correo, null);
  assert.equal(crear.mock.calls[0].arguments[0].prioridad, "NORMAL");
  assert.equal(crear.mock.calls[0].arguments[0].enlace, null);
});

test("rechaza prioridades desconocidas", async () => {
  await assert.rejects(servicio.enviarComunicacionDirecta(aviso({ prioridad: "URGENTE" })), { estado: 400 });
  assert.equal(crear.mock.callCount(), 0);
});

test("rechaza enlaces que no son rutas internas del portal", async () => {
  for (const enlace of ["https://otro-sitio.com", "//otro-sitio.com", "javascript:alert(1)"]) {
    await assert.rejects(servicio.enviarComunicacionDirecta(aviso({ enlace })), { estado: 400 }, enlace);
  }
  assert.equal(crear.mock.callCount(), 0);
});

test("la bandeja cuenta los avisos de alta prioridad sin abrir", async () => {
  mock.method(modelo, "listarBandejaEmpleado", async () => [
    { estado_codigo: "NO_LEIDO", prioridad: "ALTA" },
    { estado_codigo: "NO_LEIDO", prioridad: "NORMAL" },
    { estado_codigo: "LEIDO", prioridad: "ALTA" },
  ]);

  const bandeja = await servicio.consultarBandeja(ANA);

  assert.equal(bandeja.no_leidos, 2);
  assert.equal(bandeja.alta_prioridad_no_leidos, 1);
});

test("sin SMTP configurado el correo no sale y lo informa", async () => {
  mock.restoreAll();
  delete process.env.SMTP_HOST;
  mock.method(console, "info", () => {});

  assert.deepEqual(await correo.enviarCorreo({ para: "ana.quispe@ejemplo.com", asunto: "a", texto: "b" }), {
    enviado: false,
    motivo: "El envío de correos no está configurado (SMTP_HOST).",
  });
  assert.deepEqual(await correo.enviarCorreo({ para: null, asunto: "a", texto: "b" }), {
    enviado: false,
    motivo: "El destinatario no tiene un correo registrado.",
  });
});

const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/licencias.model");
const empleados = require("../src/services/empleados.service");
const almacenamiento = require("../src/utils/almacenamiento");
const servicio = require("../src/services/licencias.service");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const ID_SOLICITUD = "9f1c2d3e-0000-4000-8000-000000000001";

const TIPOS = {
  1: { id_tipo_licencia: 1, nombre: "Licencia médica", es_con_goce_haberes: true, dias_maximos_continuos: null, requiere_adjunto: true },
  3: { id_tipo_licencia: 3, nombre: "Duelo", es_con_goce_haberes: true, dias_maximos_continuos: 3, requiere_adjunto: true },
  5: { id_tipo_licencia: 5, nombre: "Personal", es_con_goce_haberes: false, dias_maximos_continuos: 2, requiere_adjunto: false },
};
const PDF = { originalname: "certificado.pdf", mimetype: "application/pdf", size: 1200, buffer: Buffer.from("x") };
const datos = (extra = {}) => ({ id_tipo_licencia: "3", fecha_inicio: "2026-11-02", fecha_fin: "2026-11-04", ...extra });

let crear;

beforeEach(() => {
  mock.restoreAll();
  mock.method(empleados, "obtener", async (id) => (id === ANA ? { nombres: "Ana", activo: true } : null));
  mock.method(modelo, "obtenerTipo", async (id) => TIPOS[id]);
  crear = mock.method(modelo, "crear", async () => ID_SOLICITUD);
  mock.method(modelo, "obtener", async () => ({
    id_solicitud: ID_SOLICITUD,
    es_con_goce_haberes: crear.mock.calls[0].arguments[0].esConGoceHaberes,
    excede_limite_dias: crear.mock.calls[0].arguments[0].excedeLimiteDias,
  }));
  mock.method(almacenamiento, "guardar", async () => "clave-1.pdf");
  mock.method(almacenamiento, "eliminar", async () => {});
});

test("radica la solicitud como pendiente con su respaldo", async () => {
  const resultado = await servicio.radicar(ANA, datos(), [PDF]);
  const [solicitud, adjuntos] = crear.mock.calls[0].arguments;
  assert.equal(solicitud.idEstado, 1);
  assert.equal(solicitud.idTipo, 3);
  assert.deepEqual(adjuntos, [{ clave: "clave-1.pdf", nombreOriginal: "certificado.pdf", mimetype: "application/pdf", tamano: 1200 }]);
  assert.equal(resultado.requiere_autorizacion_rrhh, false);
  assert.deepEqual(resultado.advertencias, []);
});

test("criterio 2: clasifica con goce según el catálogo", async () => {
  const resultado = await servicio.radicar(ANA, datos(), [PDF]);
  assert.equal(crear.mock.calls[0].arguments[0].esConGoceHaberes, true);
  assert.equal(resultado.clasificacion_nomina, "CON_GOCE");
});

test("criterio 2: clasifica sin goce según el catálogo", async () => {
  const resultado = await servicio.radicar(ANA, datos({ id_tipo_licencia: "5", fecha_fin: "2026-11-02" }));
  assert.equal(crear.mock.calls[0].arguments[0].esConGoceHaberes, false);
  assert.equal(resultado.clasificacion_nomina, "SIN_GOCE");
});

test("criterio 3: detiene el envío si falta el respaldo obligatorio", async () => {
  await assert.rejects(servicio.radicar(ANA, datos(), []), (error) => {
    assert.equal(error.estado, 400);
    assert.equal(error.detalles[0].campo, "archivos");
    return true;
  });
  assert.equal(crear.mock.callCount(), 0);
  assert.equal(almacenamiento.guardar.mock.callCount(), 0);
});

test("criterio 3: no exige adjunto a los tipos que no lo requieren", async () => {
  await servicio.radicar(ANA, datos({ id_tipo_licencia: "5", fecha_fin: "2026-11-02" }));
  assert.equal(crear.mock.callCount(), 1);
});

test("criterio 4: dentro del tope no advierte", async () => {
  const resultado = await servicio.radicar(ANA, datos({ fecha_fin: "2026-11-04" }), [PDF]);
  assert.equal(crear.mock.calls[0].arguments[0].excedeLimiteDias, false);
  assert.equal(resultado.requiere_autorizacion_rrhh, false);
});

test("criterio 4: al pasar el tope registra la solicitud y exige autorización de RRHH", async () => {
  const resultado = await servicio.radicar(ANA, datos({ fecha_fin: "2026-11-05" }), [PDF]);
  assert.equal(crear.mock.calls[0].arguments[0].excedeLimiteDias, true);
  assert.equal(resultado.requiere_autorizacion_rrhh, true);
  assert.match(resultado.advertencias[0], /hasta 3 día\(s\).*4.*autorización especial de RRHH/s);
});

test("un tipo sin tope nunca exige autorización especial", async () => {
  const resultado = await servicio.radicar(ANA, datos({ id_tipo_licencia: "1", fecha_fin: "2027-02-01" }), [PDF]);
  assert.equal(resultado.requiere_autorizacion_rrhh, false);
});

test("rechaza un tipo de licencia inexistente o inactivo", async () => {
  await assert.rejects(servicio.radicar(ANA, datos({ id_tipo_licencia: "99" }), [PDF]), (error) => {
    assert.equal(error.estado, 400);
    assert.equal(error.detalles[0].campo, "id_tipo_licencia");
    return true;
  });
  assert.equal(crear.mock.callCount(), 0);
});

test("traduce el solape de fechas a un conflicto y borra los archivos subidos", async () => {
  crear.mock.mockImplementation(async () => {
    throw Object.assign(new Error("exclusion"), { code: "23P01" });
  });
  await assert.rejects(servicio.radicar(ANA, datos(), [PDF]), { estado: 409 });
  assert.deepEqual(almacenamiento.eliminar.mock.calls.map((c) => c.arguments[0]), ["clave-1.pdf"]);
});

test("borra los archivos si falla el guardado en la base de datos", async () => {
  crear.mock.mockImplementation(async () => {
    throw new Error("caída");
  });
  await assert.rejects(servicio.radicar(ANA, datos(), [PDF]), /caída/);
  assert.equal(almacenamiento.eliminar.mock.callCount(), 1);
});

test("no procesa nada si el empleado no es válido o está inactivo", async () => {
  await assert.rejects(servicio.radicar("abc", datos(), [PDF]), { estado: 403 });
  empleados.obtener.mock.mockImplementation(async () => ({ activo: false }));
  await assert.rejects(servicio.radicar(ANA, datos(), [PDF]), { estado: 403 });
  assert.equal(crear.mock.callCount(), 0);
});

test("un empleado no descarga el comprobante de otro", async () => {
  mock.method(modelo, "obtenerAdjunto", async () => ({
    id_empleado: "cb7995a6-4b23-4738-ab8b-37d0b203d73b",
    archivo_url: "clave-1.pdf",
    nombre_original: "a.pdf",
    formato_mimetype: "application/pdf",
  }));
  await assert.rejects(servicio.obtenerAdjunto(ANA, ID_SOLICITUD, ID_SOLICITUD), { estado: 404 });
});

test("entrega el comprobante al empleado dueño de la solicitud", async () => {
  mock.method(modelo, "obtenerAdjunto", async () => ({
    id_empleado: ANA,
    archivo_url: "clave-1.pdf",
    nombre_original: "certificado.pdf",
    formato_mimetype: "application/pdf",
  }));
  const adjunto = await servicio.obtenerAdjunto(ANA, ID_SOLICITUD, ID_SOLICITUD);
  assert.equal(adjunto.nombre, "certificado.pdf");
  assert.equal(adjunto.mimetype, "application/pdf");
});

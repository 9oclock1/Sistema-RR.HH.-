// KAN-53 (RF-33): bandeja y detalle de aprobaciones.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/aprobaciones.model");
const licenciasModelo = require("../src/models/licencias.model");
const vacacionesModelo = require("../src/models/solicitudesVacacion.model");
const empleados = require("../src/services/empleados.service");
const licencias = require("../src/services/licencias.service");
const solicitudesVacacion = require("../src/services/solicitudesVacacion.service");
const vacaciones = require("../src/services/vacaciones.service");
const servicio = require("../src/services/aprobaciones.service");

const SUCURSAL = "11111111-1111-4111-8111-111111111111";
const AREA = "22222222-2222-4222-8222-222222222222";
const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const CARLA = "d97320a7-c29b-4405-a33b-a48dc65c6090";
const ID_VAC = "9f1c2d3e-0000-4000-8000-000000000002";
const ID_LIC = "9f1c2d3e-0000-4000-8000-000000000003";
const ID_ADJUNTO = "9f1c2d3e-0000-4000-8000-000000000004";

const EQUIPO = [
  { id_empleado: ANA, nombre_completo: "Ana Quispe", cargo: "Panadera", area: "Panadería", activo: true },
  { id_empleado: LUIS, nombre_completo: "Luis Rojas", cargo: "Panadero", area: "Panadería", activo: true },
  { id_empleado: CARLA, nombre_completo: "Carla Flores", cargo: "Panadera", area: "Panadería", activo: true },
];

const fila = (cambios) => ({
  categoria: "VACACIONES",
  id_solicitud: ID_VAC,
  id_empleado: ANA,
  tipo_nombre: "Vacaciones",
  fecha_inicio: "2026-12-07",
  fecha_fin: "2026-12-11",
  dias: 5,
  es_con_goce_haberes: null,
  excede_limite_dias: false,
  creado_en: new Date("2026-11-01T10:00:00Z"),
  resuelto_en: null,
  motivo_resolucion: null,
  estado_codigo: "PENDIENTE",
  estado_nombre: "Pendiente",
  ...cambios,
});

beforeEach(() => {
  mock.restoreAll();
  mock.method(empleados, "listarPorArea", async () => EQUIPO);
  mock.method(modelo, "contarPorEstado", async () => ({ PENDIENTE: 3, APROBADA: 2 }));
});

test("la bandeja exige una sucursal válida y rechaza filtros desconocidos", async () => {
  await assert.rejects(servicio.listarBandeja({}), (error) => {
    assert.equal(error.estado, 400);
    assert.equal(error.detalles[0].campo, "id_sucursal");
    return true;
  });
  await assert.rejects(
    servicio.listarBandeja({ id_sucursal: SUCURSAL, estado: "X", categoria: "Y", prioridad: "Z", id_departamento: "no" }),
    (error) => error.detalles.map((d) => d.campo).join() === "id_departamento,estado,categoria,prioridad"
  );
});

test("lista las solicitudes del personal de la sucursal, con prioridad y contadores", async () => {
  const listar = mock.method(modelo, "listar", async () => [
    fila({ id_solicitud: "a", fecha_inicio: "2027-03-01", fecha_fin: "2027-03-05" }),
    fila({ id_solicitud: "b", categoria: "LICENCIA", id_empleado: LUIS, tipo_nombre: "Licencia médica", es_con_goce_haberes: true, excede_limite_dias: true }),
  ]);

  const { resumen, solicitudes } = await servicio.listarBandeja({ id_sucursal: SUCURSAL, id_departamento: AREA });

  assert.deepEqual(empleados.listarPorArea.mock.calls[0].arguments, [SUCURSAL, AREA]);
  assert.deepEqual(listar.mock.calls[0].arguments[0], [ANA, LUIS, CARLA]);
  assert.equal(listar.mock.calls[0].arguments[1], "PENDIENTE");
  assert.deepEqual(resumen, { pendientes: 3, aprobadas: 2, rechazadas: 0 });
  // La licencia que excede su tope pasa primero aunque la otra empiece antes.
  assert.deepEqual(solicitudes.map((s) => [s.id_solicitud, s.prioridad]), [["b", "ALTA"], ["a", "BAJA"]]);
  assert.equal(solicitudes[0].requiere_rrhh, true);
  assert.equal(solicitudes[0].dias_tipo, "calendario");
  assert.equal(solicitudes[1].dias_tipo, "habiles");
  assert.equal(solicitudes[1].empleado.nombre_completo, "Ana Quispe");
});

test("filtra por categoría y prioridad", async () => {
  mock.method(modelo, "listar", async () => [
    fila({ id_solicitud: "a", fecha_inicio: "2027-03-01" }),
    fila({ id_solicitud: "b", categoria: "LICENCIA", fecha_inicio: "2027-03-01" }),
  ]);

  const licenciasBajas = await servicio.listarBandeja({ id_sucursal: SUCURSAL, categoria: "licencia", prioridad: "baja" });
  assert.deepEqual(licenciasBajas.solicitudes.map((s) => s.id_solicitud), ["b"]);

  const altas = await servicio.listarBandeja({ id_sucursal: SUCURSAL, prioridad: "ALTA" });
  assert.deepEqual(altas.solicitudes, []);
});

test("la pestaña «todas» no filtra por estado y las resueltas no llevan prioridad", async () => {
  const listar = mock.method(modelo, "listar", async () => [fila({ estado_codigo: "APROBADA", estado_nombre: "Aprobada" })]);

  const { solicitudes } = await servicio.listarBandeja({ id_sucursal: SUCURSAL, estado: "todas" });

  assert.equal(listar.mock.calls[0].arguments[1], null);
  assert.equal(solicitudes[0].prioridad, null);
});

test("sin personal en la sucursal responde vacío sin consultar solicitudes", async () => {
  empleados.listarPorArea.mock.mockImplementation(async () => []);
  const listar = mock.method(modelo, "listar", async () => []);

  const resultado = await servicio.listarBandeja({ id_sucursal: SUCURSAL });

  assert.deepEqual(resultado, { resumen: { pendientes: 0, aprobadas: 0, rechazadas: 0 }, solicitudes: [] });
  assert.equal(listar.mock.callCount(), 0);
});

const vacacion = {
  id_solicitud: ID_VAC,
  id_empleado: ANA,
  fecha_inicio: "2026-12-07",
  fecha_fin: "2026-12-11",
  dias_habiles: 5,
  estado_codigo: "PENDIENTE",
  estado_nombre: "Pendiente",
  creado_en: new Date("2026-11-01T10:00:00Z"),
  id_empleado_resolutor: null,
  resuelto_en: null,
};
const UBICACION = {
  id_sucursal: SUCURSAL,
  id_departamento: AREA,
  cargo: "Panadera",
  area: "Panadería",
  area_codigo: "PAN",
  sucursal: "Central",
};

test("criterio 1: el detalle de vacaciones muestra fechas, días hábiles, saldo y cobertura del equipo", async () => {
  mock.method(vacacionesModelo, "obtener", async () => vacacion);
  mock.method(empleados, "obtenerNombre", async () => "Ana Quispe");
  mock.method(empleados, "obtenerUbicacionConArea", async () => UBICACION);
  mock.method(vacaciones, "consultarSaldo", async () => ({ saldo: { acumulados: 20, gozados: 3, en_proceso: 5, disponibles: 12 } }));
  const solapadas = mock.method(modelo, "listarAusenciasSolapadas", async () => [
    { categoria: "LICENCIA", id_solicitud: ID_LIC, id_empleado: LUIS, tipo_nombre: "Licencia médica", fecha_inicio: "2026-12-08", fecha_fin: "2026-12-09", estado_codigo: "APROBADA" },
  ]);

  const detalle = await servicio.obtenerDetalle("vacaciones", ID_VAC);

  assert.equal(detalle.tipo, "Vacaciones");
  assert.equal(detalle.dias, 5);
  assert.equal(detalle.dias_tipo, "habiles");
  assert.equal(detalle.empleado.nombre_completo, "Ana Quispe");
  assert.equal(detalle.empleado.area, "Panadería");
  assert.deepEqual(detalle.saldo, { acumulados: 20, gozados: 3, en_proceso: 5, disponibles: 12 });
  // El equipo son los tres activos; se consultan las ausencias de los dos compañeros, no las del solicitante.
  assert.deepEqual(solapadas.mock.calls[0].arguments, [[LUIS, CARLA], "2026-12-07", "2026-12-11", ID_VAC]);
  assert.equal(detalle.cobertura.equipo_total, 3);
  assert.equal(detalle.cobertura.maximo_ausentes_simultaneos, 2);
  assert.equal(detalle.cobertura.nivel_impacto, "ALTO");
  assert.equal(detalle.cobertura.ausencias[0].empleado.nombre_completo, "Luis Rojas");
  assert.equal(detalle.resolucion, null);
});

test("criterio 1: el detalle de una licencia muestra causal, goce, tope y comprobantes", async () => {
  mock.method(licenciasModelo, "obtener", async () => ({
    id_solicitud: ID_LIC,
    id_empleado: ANA,
    tipo_nombre: "Licencia médica",
    fecha_inicio: "2026-12-07",
    fecha_fin: "2026-12-09",
    dias_solicitados: 3,
    es_con_goce_haberes: true,
    excede_limite_dias: true,
    motivo: "Cirugía",
    estado_codigo: "PENDIENTE",
    estado_nombre: "Pendiente",
    adjuntos: [{ id_adjunto: ID_ADJUNTO, nombre_original: "baja.pdf", formato_mimetype: "application/pdf", tamano_bytes: 2048 }],
    id_empleado_resolutor: null,
    resuelto_en: null,
  }));
  mock.method(empleados, "obtenerNombre", async () => "Ana Quispe");
  mock.method(empleados, "obtenerUbicacionConArea", async () => UBICACION);
  mock.method(modelo, "listarAusenciasSolapadas", async () => []);

  const detalle = await servicio.obtenerDetalle("LICENCIA", ID_LIC);

  assert.equal(detalle.tipo, "Licencia médica");
  assert.equal(detalle.dias_tipo, "calendario");
  assert.equal(detalle.con_goce_haberes, true);
  assert.equal(detalle.requiere_rrhh, true);
  assert.equal(detalle.motivo, "Cirugía");
  assert.deepEqual(detalle.adjuntos, [{ id_adjunto: ID_ADJUNTO, nombre: "baja.pdf", tipo_mime: "application/pdf", tamano_bytes: 2048 }]);
  assert.equal(detalle.saldo, null);
});

test("si no se puede consultar el área, el detalle se muestra igual y avisa que falta la cobertura", async () => {
  mock.method(vacacionesModelo, "obtener", async () => vacacion);
  mock.method(empleados, "obtenerNombre", async () => "Ana Quispe");
  mock.method(empleados, "obtenerUbicacionConArea", async () => {
    throw new Error("No se pudieron obtener los datos del personal.");
  });
  mock.method(vacaciones, "consultarSaldo", async () => {
    throw new Error("sin saldo");
  });

  const detalle = await servicio.obtenerDetalle("VACACIONES", ID_VAC);

  assert.equal(detalle.cobertura, null);
  assert.equal(detalle.saldo, null);
  assert.match(detalle.aviso_cobertura, /personal/);
  assert.equal(detalle.empleado.nombre_completo, "Ana Quispe");
});

test("una solicitud resuelta muestra quién la resolvió y con qué justificación", async () => {
  mock.method(vacacionesModelo, "obtener", async () => ({
    ...vacacion,
    estado_codigo: "RECHAZADA",
    estado_nombre: "Rechazada",
    id_empleado_resolutor: LUIS,
    resuelto_en: new Date("2026-11-02T12:00:00Z"),
    motivo_resolucion: "Sin cobertura",
  }));
  mock.method(empleados, "obtenerNombre", async (id) => (id === LUIS ? "Luis Rojas" : "Ana Quispe"));
  mock.method(empleados, "obtenerUbicacionConArea", async () => UBICACION);
  mock.method(vacaciones, "consultarSaldo", async () => ({ saldo: { acumulados: 20, gozados: 0, en_proceso: 0, disponibles: 20 } }));
  mock.method(modelo, "listarAusenciasSolapadas", async () => []);

  const detalle = await servicio.obtenerDetalle("VACACIONES", ID_VAC);

  assert.equal(detalle.resolucion.resuelto_por, "Luis Rojas");
  assert.equal(detalle.resolucion.motivo, "Sin cobertura");
});

test("responde 404 si el tipo, el identificador o la solicitud no existen", async () => {
  mock.method(vacacionesModelo, "obtener", async () => undefined);

  await assert.rejects(servicio.obtenerDetalle("OTRO", ID_VAC), (error) => error.estado === 404);
  await assert.rejects(servicio.obtenerDetalle("VACACIONES", "abc"), (error) => error.estado === 404);
  await assert.rejects(servicio.obtenerDetalle("VACACIONES", ID_VAC), (error) => error.estado === 404);
});

test("resolver delega según la categoría y entrega el rol del resolutor a las licencias", async () => {
  const deVacacion = mock.method(solicitudesVacacion, "resolverSolicitud", async () => ({ categoria: "v" }));
  const deLicencia = mock.method(licencias, "resolver", async () => ({ categoria: "l" }));

  await servicio.resolver("vacaciones", LUIS, ID_VAC, { decision: "APROBADA" }, { rol: "gerente" });
  await servicio.resolver("LICENCIA", LUIS, ID_LIC, { decision: "APROBADA" }, { rol: "gerente" });

  assert.deepEqual(deVacacion.mock.calls[0].arguments, [LUIS, ID_VAC, { decision: "APROBADA" }]);
  assert.deepEqual(deLicencia.mock.calls[0].arguments, [LUIS, ID_LIC, { decision: "APROBADA" }, { rol: "gerente" }]);
  await assert.rejects(servicio.resolver("otra", LUIS, ID_VAC, {}, {}), (error) => error.estado === 404);
});

test("el resolutor descarga el comprobante aunque no sea suyo; uno inexistente es 404", async () => {
  mock.method(licenciasModelo, "obtenerAdjunto", async () => ({
    nombre_original: "baja.pdf",
    archivo_url: "baja.pdf",
    formato_mimetype: "application/pdf",
    id_empleado: ANA,
  }));

  const adjunto = await servicio.obtenerAdjunto(ID_LIC, ID_ADJUNTO);
  assert.equal(adjunto.nombre, "baja.pdf");
  assert.equal(adjunto.mimetype, "application/pdf");

  licenciasModelo.obtenerAdjunto.mock.mockImplementation(async () => undefined);
  await assert.rejects(servicio.obtenerAdjunto(ID_LIC, ID_ADJUNTO), (error) => error.estado === 404);
  await assert.rejects(servicio.obtenerAdjunto("abc", ID_ADJUNTO), (error) => error.estado === 404);
});

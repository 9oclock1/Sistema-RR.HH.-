const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../src/config/db");
const modelo = require("../src/models/justificaciones.model");
const novedadesModelo = require("../src/models/novedades.model");
const empleados = require("../src/services/empleados.service");
const eventos = require("../src/services/eventos.service");
const almacen = require("../src/utils/adjuntosJustificacion");
const servicio = require("../src/services/justificaciones.service");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const ROSA = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const NOVEDAD = "5b0f7f43-2a59-4c47-9a49-6a3e7b0e1c11";
const SOLICITUD = "6c1e8a54-3b6a-4d58-8b5a-7b4f8c1f2d22";
const AHORA = new Date("2026-10-13T12:00:00Z");
const PDF = Buffer.from("%PDF-1.7\n%prueba");
const MOTIVOS = [{ id_motivo_justificacion: 1, codigo: "SALUD", nombre: "Salud" }];

const novedad = (extra = {}) => ({
  id_novedad: NOVEDAD,
  id_empleado: ANA,
  fecha_jornada: "2026-10-12",
  nombre_turno: "Mañana",
  inicio_programado: new Date("2026-10-12T12:00:00Z"),
  fin_programado: new Date("2026-10-12T20:00:00Z"),
  minutos_tolerancia: 10,
  minutos: 25,
  minutos_penalizacion: 25,
  minutos_programados: 420,
  consolidada_en: null,
  id_marcaje: "m-1",
  fecha_hora_marcaje: new Date("2026-10-12T12:25:00Z"),
  tipo_codigo: "ATRASO",
  tipo_nombre: "Atraso",
  es_justificable: true,
  estado_codigo: "REGISTRADA",
  estado_nombre: "Registrada",
  ...extra,
});
const solicitud = (extra = {}) => ({
  id_solicitud: SOLICITUD,
  id_novedad: NOVEDAD,
  id_empleado: ANA,
  descripcion: null,
  id_revisor: null,
  nombre_revisor: null,
  comentario_revision: null,
  revisada_en: null,
  creado_en: AHORA,
  id_motivo_justificacion: 1,
  motivo_codigo: "SALUD",
  motivo_nombre: "Salud",
  estado_codigo: "PENDIENTE",
  estado_nombre: "Pendiente de revisión",
  ...extra,
});
const archivo = { originalname: "certificado.pdf", mimetype: "application/pdf", buffer: PDF, size: PDF.length };

let consultas;
beforeEach(() => {
  mock.restoreAll();
  consultas = [];
  mock.method(pool, "connect", async () => ({ query: async (texto) => consultas.push(texto), release: () => {} }));
  mock.method(novedadesModelo, "momentoActual", async () => ({ ahora: AHORA, hoy: "2026-10-13" }));
  mock.method(modelo, "listarMotivos", async () => MOTIVOS);
  mock.method(modelo, "obtener", async () => solicitud());
  mock.method(modelo, "obtenerNovedad", async () => novedad());
  mock.method(modelo, "listarAdjuntos", async () => []);
  mock.method(modelo, "listarNovedadesDeJornada", async () => [novedad({ estado_codigo: "JUSTIFICADA" })]);
  mock.method(empleados, "obtener", async (id) => ({ id_empleado: id, nombres: "Rosa", apellidos: "Revisa", activo: true }));
});

const errorDe = async (promesa) => {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  assert.fail("se esperaba un error");
};

test("registrar guarda la solicitud y un archivo por comprobante dentro de la transacción", async () => {
  mock.method(modelo, "bloquearNovedadDelEmpleado", async () => novedad());
  mock.method(modelo, "obtenerVigente", async () => null);
  const crear = mock.method(modelo, "crear", async () => SOLICITUD);
  const agregar = mock.method(modelo, "agregarAdjuntos", async () => {});
  mock.method(almacen, "guardar", async () => "clave-1.pdf");

  const resultado = await servicio.registrar(ANA, { id_novedad: NOVEDAD, id_motivo: "1" }, [archivo]);

  assert.equal(crear.mock.calls[0].arguments[1].idEmpleado, ANA);
  assert.deepEqual(agregar.mock.calls[0].arguments[2], [
    { nombre_original: "certificado.pdf", tipo_mime: "application/pdf", tamano_bytes: PDF.length, clave_almacenamiento: "clave-1.pdf" },
  ]);
  assert.deepEqual([consultas[0], consultas.at(-1)], ["BEGIN", "COMMIT"]);
  assert.equal(resultado.id_solicitud, SOLICITUD);
});

test("si la BD falla después de guardar los archivos, se borran del disco", async () => {
  mock.method(modelo, "bloquearNovedadDelEmpleado", async () => novedad());
  mock.method(modelo, "obtenerVigente", async () => null);
  mock.method(modelo, "crear", async () => SOLICITUD);
  mock.method(modelo, "agregarAdjuntos", async () => {
    throw new Error("sin conexión");
  });
  mock.method(almacen, "guardar", async () => "clave-1.pdf");
  const eliminar = mock.method(almacen, "eliminar", async () => {});

  const error = await errorDe(servicio.registrar(ANA, { id_novedad: NOVEDAD, id_motivo: "1" }, [archivo]));

  assert.equal(error.message, "sin conexión");
  assert.deepEqual(eliminar.mock.calls.map((c) => c.arguments[0]), ["clave-1.pdf"]);
  assert.equal(consultas.at(-1), "ROLLBACK");
});

test("plazo vencido: 409 y no se guarda ningún archivo", async () => {
  mock.method(modelo, "bloquearNovedadDelEmpleado", async () => novedad());
  mock.method(modelo, "obtenerVigente", async () => null);
  mock.method(novedadesModelo, "momentoActual", async () => ({ ahora: new Date("2026-10-20T00:00:00Z"), hoy: "2026-10-19" }));
  const guardar = mock.method(almacen, "guardar", async () => "x");

  const error = await errorDe(servicio.registrar(ANA, { id_novedad: NOVEDAD, id_motivo: "1" }, [archivo]));

  assert.equal(error.estado, 409);
  assert.match(error.message, /venció/);
  assert.equal(guardar.mock.callCount(), 0);
});

test("una solicitud simultánea que choca con el índice único responde 409 y limpia sus archivos", async () => {
  mock.method(modelo, "bloquearNovedadDelEmpleado", async () => novedad());
  mock.method(modelo, "obtenerVigente", async () => null);
  mock.method(modelo, "crear", async () => {
    throw Object.assign(new Error("duplicada"), { code: "23505" });
  });
  const error = await errorDe(servicio.registrar(ANA, { id_novedad: NOVEDAD, id_motivo: "1" }, [archivo]));
  assert.equal(error.estado, 409);
  assert.match(error.message, /pendiente de revisión/);
});

test("novedad de otro empleado o inexistente: 404", async () => {
  mock.method(modelo, "bloquearNovedadDelEmpleado", async () => null);
  const error = await errorDe(servicio.registrar(ANA, { id_novedad: NOVEDAD, id_motivo: "1" }, [archivo]));
  assert.equal(error.estado, 404);
});

test("identificación que no es un UUID: 401", async () => {
  assert.equal((await errorDe(servicio.misNovedades("abc", {}))).estado, 401);
  assert.equal((await errorDe(servicio.registrar("abc", {}, []))).estado, 401);
});

test("aprobar una jornada abierta: la novedad queda justificada sin evento de recálculo", async () => {
  mock.method(modelo, "bloquearSolicitud", async () => solicitud());
  const revisar = mock.method(modelo, "registrarRevision", async () => {});
  const justificar = mock.method(modelo, "marcarJustificada", async () => ({ id_empleado: ANA, fecha_jornada: "2026-10-12", consolidada_en: null }));
  const evento = mock.method(eventos, "registrarConsolidacion", async () => {});

  const resultado = await servicio.revisar(SOLICITUD, ROSA, { decision: "aprobada", comentario: " Válido " });

  assert.deepEqual(revisar.mock.calls[0].arguments.slice(2), [
    { decision: "APROBADA", idEstado: 2, comentario: "Válido", idRevisor: ROSA, nombreRevisor: "Rosa Revisa" },
  ]);
  assert.equal(justificar.mock.calls[0].arguments[1], NOVEDAD);
  assert.equal(evento.mock.callCount(), 0);
  assert.deepEqual(resultado.jornada, {
    minutos_programados: 420,
    minutos_penalizacion: 0,
    minutos_justificados: 25,
    minutos_efectivos: 420,
    recalculo_enviado: false,
  });
});

test("aprobar una jornada ya consolidada envía JORNADA_RECALCULADA con todas sus novedades", async () => {
  mock.method(modelo, "bloquearSolicitud", async () => solicitud());
  mock.method(modelo, "registrarRevision", async () => {});
  mock.method(modelo, "marcarJustificada", async () => ({ id_empleado: ANA, fecha_jornada: "2026-10-12", consolidada_en: AHORA }));
  mock.method(modelo, "listarNovedadesDeJornada", async () => [
    novedad({ estado_codigo: "JUSTIFICADA" }),
    novedad({ id_novedad: "otra", tipo_codigo: "SALIDA_ANTICIPADA", minutos: 30, minutos_penalizacion: 30 }),
  ]);
  const evento = mock.method(eventos, "registrarConsolidacion", async () => {});

  const resultado = await servicio.revisar(SOLICITUD, ROSA, { decision: "APROBADA" });

  const carga = evento.mock.calls[0].arguments[1];
  assert.equal(carga.evento, "JORNADA_RECALCULADA");
  assert.equal(carga.id_solicitud, SOLICITUD);
  assert.deepEqual(
    [carga.minutos_programados, carga.minutos_penalizacion, carga.minutos_justificados, carga.minutos_efectivos],
    [420, 30, 25, 390]
  );
  assert.deepEqual(carga.novedades.map((n) => n.estado), ["JUSTIFICADA", "REGISTRADA"]);
  assert.equal(resultado.jornada.recalculo_enviado, true);
});

test("rechazar guarda el comentario y no toca la novedad", async () => {
  mock.method(modelo, "bloquearSolicitud", async () => solicitud());
  const revisar = mock.method(modelo, "registrarRevision", async () => {});
  const justificar = mock.method(modelo, "marcarJustificada", async () => ({}));
  await servicio.revisar(SOLICITUD, ROSA, { decision: "RECHAZADA", comentario: "Sin firma" });
  assert.equal(revisar.mock.calls[0].arguments[2].idEstado, 3);
  assert.equal(revisar.mock.calls[0].arguments[2].comentario, "Sin firma");
  assert.equal(justificar.mock.callCount(), 0);
});

test("rechazar sin comentario: 400 antes de abrir la transacción", async () => {
  const error = await errorDe(servicio.revisar(SOLICITUD, ROSA, { decision: "RECHAZADA", comentario: "" }));
  assert.equal(error.estado, 400);
  assert.deepEqual(error.detalles, [{ campo: "comentario", mensaje: "Explique el motivo del rechazo." }]);
  assert.equal(consultas.length, 0);
});

test("la colaboradora no puede revisar su propia solicitud", async () => {
  mock.method(modelo, "bloquearSolicitud", async () => solicitud());
  const error = await errorDe(servicio.revisar(SOLICITUD, ANA, { decision: "APROBADA" }));
  assert.equal(error.estado, 403);
  assert.equal(consultas.at(-1), "ROLLBACK");
});

test("una solicitud ya revisada no se vuelve a decidir", async () => {
  mock.method(modelo, "bloquearSolicitud", async () => solicitud({ estado_codigo: "APROBADA", estado_nombre: "Aprobada" }));
  const error = await errorDe(servicio.revisar(SOLICITUD, ROSA, { decision: "RECHAZADA", comentario: "x" }));
  assert.equal(error.estado, 409);
  assert.equal(error.message, "La solicitud ya fue aprobada.");
});

test("el revisor debe ser un empleado activo", async () => {
  mock.method(empleados, "obtener", async () => null);
  assert.equal((await errorDe(servicio.revisar(SOLICITUD, ROSA, { decision: "APROBADA" }))).estado, 403);
  mock.method(empleados, "obtener", async () => ({ nombres: "Rosa", apellidos: "Revisa", activo: false }));
  assert.match((await errorDe(servicio.revisar(SOLICITUD, ROSA, { decision: "APROBADA" }))).message, /no está activo/);
});

test("solicitud inexistente o id inválido: 404", async () => {
  mock.method(modelo, "bloquearSolicitud", async () => null);
  assert.equal((await errorDe(servicio.revisar(SOLICITUD, ROSA, { decision: "APROBADA" }))).estado, 404);
  assert.equal((await errorDe(servicio.revisar("abc", ROSA, { decision: "APROBADA" }))).estado, 404);
  assert.equal((await errorDe(servicio.obtener("abc"))).estado, 404);
  assert.equal((await errorDe(servicio.adjunto(SOLICITUD, "abc"))).estado, 404);
});

test("la bandeja exige la sucursal y un estado válido", async () => {
  const sinSucursal = await errorDe(servicio.bandeja({}));
  assert.deepEqual(sinSucursal.detalles.map((d) => d.campo), ["id_sucursal"]);
  const estado = await errorDe(servicio.bandeja({ id_sucursal: ANA, estado: "OTRO" }));
  assert.deepEqual(estado.detalles.map((d) => d.campo), ["estado"]);
});

test("la bandeja filtra por el personal de la sucursal y cuenta por estado", async () => {
  mock.method(empleados, "listarPorArea", async () => [{ id_empleado: ANA, nombre_completo: "Ana Quispe", cargo: "Cajera", area: "Cajas" }]);
  const listar = mock.method(modelo, "listarBandeja", async () => [solicitud()]);
  mock.method(modelo, "contarPorEstado", async () => [{ codigo: "PENDIENTE", cantidad: 1 }, { codigo: "RECHAZADA", cantidad: 2 }]);
  mock.method(modelo, "listarNovedades", async () => [novedad()]);

  const resultado = await servicio.bandeja({ id_sucursal: ROSA.toUpperCase() });

  assert.deepEqual(listar.mock.calls[0].arguments, [[ANA], 1]);
  assert.deepEqual(resultado.resumen, { pendientes: 1, aprobadas: 0, rechazadas: 2 });
  assert.equal(resultado.solicitudes[0].empleado.nombre_completo, "Ana Quispe");
  assert.equal(resultado.solicitudes[0].novedad.tipo.codigo, "ATRASO");
});

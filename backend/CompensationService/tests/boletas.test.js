const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { armarContenido, calcularHash, validarIdentidad, puedeVer } = require("../src/utils/boletas");
const { aPdf } = require("../src/services/boletaPdf");

// Modelo en memoria: el servicio se prueba sin base de datos.
const memoria = { pendientes: [], emitidas: [], boletas: new Map(), descargas: [] };
const rutaModelo = require.resolve("../src/models/boletas.model");
require.cache[rutaModelo] = {
  id: rutaModelo,
  filename: rutaModelo,
  loaded: true,
  exports: {
    pendientesDeEmitir: async (idEmpleado) => memoria.pendientes.filter((f) => f.id_empleado === idEmpleado && f.estado === "CERRADA"),
    emitir: async (fila, hash) => memoria.emitidas.push({ fila, hash }),
    listar: async () => [],
    obtener: async (id) => memoria.boletas.get(id),
    registrarDescarga: async (id) => memoria.descargas.push(id),
  },
};
const servicio = require("../src/services/boletas.service");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const BOLETA = "0d3f5a4e-6a59-4a39-9a43-1f1e7e1c2b11";

const renglon = (orden, tipo, codigo, resultado, extra = {}) => ({
  orden,
  tipo,
  codigo,
  nombre: codigo,
  forma_calculo: "PORCENTAJE",
  base: "3500.00",
  cantidad: null,
  valor: 10,
  resultado,
  detalle: null,
  ...extra,
});

// Detalle de Ana en la planilla cerrada de agosto, como lo devuelve la base (montos numeric como texto).
const filaAna = (cambios = {}) => ({
  id_planilla: "a1b2c3d4-0000-4000-8000-000000000001",
  id_planilla_empleado: "a1b2c3d4-0000-4000-8000-000000000002",
  periodo: "2026-08",
  estado: "CERRADA",
  cerrada_en: "2026-09-05T15:00:00.000Z",
  id_empleado: ANA,
  nombre_empleado: "Ana Torrez Villca",
  numero_documento: "7104795",
  cargo: "Cajera",
  area: "Atención al cliente",
  sucursal: "Miraflores",
  numero_contrato: "CT-35",
  haber_mensual: "3500.00",
  dias_contrato: 30,
  dias_pagados: 30,
  faltas_injustificadas: 0,
  dias_licencia_sin_goce: 0,
  total_ganado: "3500.00",
  total_descuentos: "385.00",
  liquido_pagable: "3115.00",
  total_aportes: "350.00",
  renglones: [
    renglon(3, "APORTE", "CNS-SALUD", 350),
    renglon(1, "INGRESO", "HABER-BASICO", 3500, { valor: 100, cantidad: 30, detalle: "30 de 30 días" }),
    renglon(2, "DESCUENTO", "SIP-VEJEZ", 350),
    renglon(4, "DESCUENTO", "SIP-RIESGO", 35, { valor: 1 }),
  ],
  ...cambios,
});

const emitida = (fila = filaAna()) => ({
  id_boleta: BOLETA,
  hash_contenido: calcularHash(armarContenido(fila)),
  emitida_en: "2026-11-21T14:00:00.000Z",
  descargas: 0,
  ultima_descarga_en: null,
  ...fila,
});

const rechazo = (estado) => (error) => error.estado === estado;

beforeEach(() => {
  memoria.pendientes = [];
  memoria.emitidas = [];
  memoria.boletas = new Map();
  memoria.descargas = [];
});

test("armarContenido separa haberes, descuentos y aportes en el orden del cálculo", () => {
  const c = armarContenido(filaAna());
  assert.deepEqual(c.ingresos.map((r) => r.codigo), ["HABER-BASICO"]);
  assert.deepEqual(c.descuentos.map((r) => r.codigo), ["SIP-VEJEZ", "SIP-RIESGO"]);
  assert.deepEqual(c.aportes.map((r) => r.codigo), ["CNS-SALUD"]);
  assert.equal(c.ingresos[0].resultado, "3500.00");
  assert.equal(c.ingresos[0].cantidad, "30.00");
  assert.equal(c.descuentos[1].valor, "1.0000");
});

test("armarContenido toma los totales tal como quedaron en la planilla cerrada", () => {
  const { totales, contrato, dias } = armarContenido(filaAna());
  assert.deepEqual(totales, { total_ganado: "3500.00", total_descuentos: "385.00", liquido_pagable: "3115.00", total_aportes: "350.00" });
  assert.equal(contrato.haber_mensual, "3500.00");
  assert.equal(dias.pagados, 30);
});

test("el hash es el mismo si los montos llegan como número o como texto", () => {
  const comoTexto = filaAna();
  const comoNumero = filaAna({
    haber_mensual: 3500,
    total_ganado: 3500,
    total_descuentos: 385,
    liquido_pagable: 3115,
    total_aportes: 350,
    renglones: comoTexto.renglones.map((r) => ({ ...r, base: 3500, resultado: Number(r.resultado) })),
  });
  const hash = calcularHash(armarContenido(comoTexto));
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(calcularHash(armarContenido(comoNumero)), hash);
});

test("el hash cambia si cambia cualquier monto o dato de la boleta", () => {
  const hash = calcularHash(armarContenido(filaAna()));
  assert.notEqual(calcularHash(armarContenido(filaAna({ liquido_pagable: "3115.01" }))), hash);
  assert.notEqual(calcularHash(armarContenido(filaAna({ cargo: "Supervisora" }))), hash);
  const otroRenglon = filaAna();
  otroRenglon.renglones[1] = { ...otroRenglon.renglones[1], resultado: 3400 };
  assert.notEqual(calcularHash(armarContenido(otroRenglon)), hash);
});

test("validarIdentidad exige un colaborador con UUID válido", () => {
  assert.throws(() => validarIdentidad({}), rechazo(401));
  assert.throws(() => validarIdentidad({ idEmpleado: "123" }), rechazo(401));
  assert.deepEqual(validarIdentidad({ idEmpleado: ANA.toUpperCase(), rol: " Empleado " }), { idEmpleado: ANA, rol: "empleado" });
});

test("puedeVer: el dueño y RRHH ven la boleta; otro colaborador no", () => {
  const boleta = { id_empleado: ANA };
  assert.equal(puedeVer({ idEmpleado: ANA, rol: "empleado" }, boleta), true);
  assert.equal(puedeVer({ idEmpleado: LUIS, rol: "empleado" }, boleta), false);
  assert.equal(puedeVer({ idEmpleado: LUIS, rol: "supervisor" }, boleta), false);
  assert.equal(puedeVer({ idEmpleado: LUIS, rol: "admin" }, boleta), true);
});

test("criterio 1 y 4: al listar se emiten solo las boletas de planillas cerradas, con su hash", async () => {
  memoria.pendientes = [filaAna(), filaAna({ periodo: "2026-09", estado: "APROBADA" }), filaAna({ id_empleado: LUIS })];
  await servicio.listar({ idEmpleado: ANA });
  assert.equal(memoria.emitidas.length, 1);
  assert.equal(memoria.emitidas[0].fila.periodo, "2026-08");
  assert.equal(memoria.emitidas[0].hash, calcularHash(armarContenido(filaAna())));
});

test("listar sin colaborador identificado responde 401", async () => {
  await assert.rejects(servicio.listar({}), rechazo(401));
});

test("criterio 2: el detalle trae el contenido verificado y el código de verificación", async () => {
  memoria.boletas.set(BOLETA, emitida());
  const boleta = await servicio.obtener(BOLETA, { idEmpleado: ANA, rol: "empleado" });
  assert.equal(boleta.codigo_verificacion, emitida().hash_contenido);
  assert.equal(boleta.totales.liquido_pagable, "3115.00");
  assert.equal(boleta.empleado.nombre_completo, "Ana Torrez Villca");
});

test("criterio 3: la boleta de otro colaborador se rechaza con 403", async () => {
  memoria.boletas.set(BOLETA, emitida());
  await assert.rejects(servicio.obtener(BOLETA, { idEmpleado: LUIS, rol: "empleado" }), rechazo(403));
  await assert.rejects(servicio.descargarPdf(BOLETA, { idEmpleado: LUIS, rol: "empleado" }), rechazo(403));
  assert.equal(memoria.descargas.length, 0);
});

test("RRHH puede abrir la boleta de cualquier colaborador", async () => {
  memoria.boletas.set(BOLETA, emitida());
  const boleta = await servicio.obtener(BOLETA, { idEmpleado: LUIS, rol: "admin" });
  assert.equal(boleta.id_boleta, BOLETA);
});

test("una boleta inexistente o un id inválido responde 404", async () => {
  await assert.rejects(servicio.obtener(BOLETA, { idEmpleado: ANA }), rechazo(404));
  await assert.rejects(servicio.obtener("no-es-uuid", { idEmpleado: ANA }), rechazo(404));
});

test("criterio 4: si la planilla no está cerrada, la boleta no está disponible", async () => {
  memoria.boletas.set(BOLETA, emitida(filaAna({ estado: "APROBADA" })));
  await assert.rejects(servicio.obtener(BOLETA, { idEmpleado: ANA }), rechazo(404));
});

test("si el detalle ya no coincide con el hash de emisión, la boleta no se entrega (409)", async () => {
  const alterada = { ...emitida(), liquido_pagable: "9999.00" };
  memoria.boletas.set(BOLETA, alterada);
  const original = console.error;
  console.error = () => {};
  try {
    await assert.rejects(servicio.descargarPdf(BOLETA, { idEmpleado: ANA }), rechazo(409));
  } finally {
    console.error = original;
  }
  assert.equal(memoria.descargas.length, 0);
});

test("criterio 2: la descarga devuelve un PDF y queda registrada", async () => {
  memoria.boletas.set(BOLETA, emitida());
  const { nombre, contenido } = await servicio.descargarPdf(BOLETA, { idEmpleado: ANA });
  assert.equal(nombre, "boleta-de-pago_2026-08.pdf");
  assert.equal(contenido.subarray(0, 5).toString(), "%PDF-");
  assert.deepEqual(memoria.descargas, [BOLETA]);
});

test("el PDF de una boleta con muchos conceptos continúa en otra página", async () => {
  const renglones = Array.from({ length: 30 }, (_, i) => renglon(i + 1, i < 12 ? "INGRESO" : i < 24 ? "DESCUENTO" : "APORTE", `C-${i}`, 10));
  const contenido = armarContenido(filaAna({ renglones }));
  const { contenido: pdf } = await aPdf({ ...contenido, codigo_verificacion: calcularHash(contenido), emitida_en: new Date(), cerrada_en: new Date() });
  const paginas = pdf.toString("latin1").match(/\/Type \/Page\b/g).length;
  assert.ok(paginas >= 2);
});

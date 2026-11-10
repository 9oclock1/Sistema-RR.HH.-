const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validarRegla,
  validarEdicionRegla,
  esEventoVentas,
  leerEventoVentas,
  montoDeRegla,
  cumpleUmbral,
  TIPO_SOLICITUD_CIERRE,
  armarSolicitudCierre,
} = require("../src/utils/ventasProductividad");
const { atributosDe } = require("../src/utils/integraciones");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";

const campos = (fn) => {
  try {
    fn();
    return [];
  } catch (error) {
    return error.detalles.map((d) => d.campo);
  }
};

const regla = (extra) => ({
  periodo: "2026-11",
  tipo_meta: "VENTAS",
  umbral_cumplimiento: 100,
  forma_calculo: "MONTO_FIJO",
  valor: 500,
  ...extra,
});

const mensaje = (datos, extra = {}) => ({
  encabezado: {
    id_mensaje: "evt-1",
    origen: { grupo: "E", modulo: "Ventas y Marketing" },
    destino: { grupo: "F", modulo: "RRHH" },
    tipo: "CIERRE_VENTAS_PERIODO",
    fecha: "2026-11-01T00:00:00.000Z",
    version_esquema: 1,
    ...extra.encabezado,
  },
  datos,
});

// ---- validarRegla ----

test("validarRegla acepta una regla válida", () => {
  const resultado = validarRegla(regla());
  assert.equal(resultado.periodo, "2026-11-01");
  assert.equal(resultado.tipo_meta, "VENTAS");
  assert.equal(resultado.umbral_cumplimiento, 100);
  assert.equal(resultado.valor, 500);
});

test("validarRegla rechaza un periodo con formato inválido", () => {
  assert.deepEqual(campos(() => validarRegla(regla({ periodo: "2026-13" }))), ["periodo"]);
  assert.deepEqual(campos(() => validarRegla(regla({ periodo: "noviembre-2026" }))), ["periodo"]);
});

test("validarRegla rechaza un tipo de meta desconocido", () => {
  assert.deepEqual(campos(() => validarRegla(regla({ tipo_meta: "VENTAS_RETAIL" }))), ["tipo_meta"]);
});

test("validarRegla rechaza un umbral o un valor fuera de rango", () => {
  assert.deepEqual(campos(() => validarRegla(regla({ umbral_cumplimiento: 0 }))), ["umbral_cumplimiento"]);
  assert.deepEqual(campos(() => validarRegla(regla({ umbral_cumplimiento: 1500 }))), ["umbral_cumplimiento"]);
  assert.deepEqual(campos(() => validarRegla(regla({ valor: 0 }))), ["valor"]);
  assert.deepEqual(campos(() => validarRegla(regla({ valor: -10 }))), ["valor"]);
});

test("validarRegla rechaza una forma de cálculo inválida", () => {
  assert.deepEqual(campos(() => validarRegla(regla({ forma_calculo: "ESCALONADO" }))), ["forma_calculo"]);
});

// ---- validarEdicionRegla ----

test("validarEdicionRegla permite cambiar el umbral y el valor", () => {
  const actual = validarRegla(regla());
  const cambios = validarEdicionRegla({ umbral_cumplimiento: 120, valor: 600, forma_calculo: "MONTO_FIJO" }, actual);
  assert.equal(cambios.umbral_cumplimiento, 120);
  assert.equal(cambios.valor, 600);
});

test("validarEdicionRegla rechaza cambiar el periodo o el tipo de meta", () => {
  const actual = validarRegla(regla());
  assert.deepEqual(campos(() => validarEdicionRegla({ periodo: "2026-12" }, actual)), ["periodo"]);
  assert.deepEqual(campos(() => validarEdicionRegla({ tipo_meta: "PUNTUALIDAD" }, actual)), ["tipo_meta"]);
});

// ---- esEventoVentas / leerEventoVentas ----

test("esEventoVentas ignora mensajes de otro tipo o para otro módulo", () => {
  assert.equal(esEventoVentas(mensaje({})), true);
  assert.equal(esEventoVentas(mensaje({}, { encabezado: { tipo: "OTRO_TIPO" } })), false);
  assert.equal(esEventoVentas(mensaje({}, { encabezado: { destino: { grupo: "D", modulo: "Contabilidad" } } })), false);
  assert.equal(esEventoVentas({}), false);
});

test("leerEventoVentas acepta un cierre de periodo válido y calcula el cumplimiento", () => {
  const cuerpo = mensaje({
    periodo: "2026-11",
    metricas: [
      { id_empleado: ANA, rol: "VENDEDOR", monto_ventas: 15000, cuota_asignada: 12000 },
      { id_empleado: LUIS, rol: "CAJERO", monto_ventas: 6000, cuota_asignada: 10000 },
    ],
  });
  const lectura = leerEventoVentas(cuerpo);
  assert.equal(lectura.errores, undefined);
  assert.equal(lectura.periodo, "2026-11-01");
  assert.equal(lectura.metricas.length, 2);
  assert.equal(lectura.metricas[0].porcentaje_cumplimiento, 125);
  assert.equal(lectura.metricas[1].porcentaje_cumplimiento, 60);
});

test("leerEventoVentas rechaza un mensaje que no viene de Ventas y Marketing", () => {
  const cuerpo = mensaje(
    { periodo: "2026-11", metricas: [{ id_empleado: ANA, rol: "VENDEDOR", monto_ventas: 1, cuota_asignada: 1 }] },
    { encabezado: { origen: { grupo: "D", modulo: "Contabilidad" } } }
  );
  const lectura = leerEventoVentas(cuerpo);
  assert.ok(lectura.errores.some((e) => e.includes("grupo E")));
});

test("leerEventoVentas rechaza un periodo o métricas inválidas", () => {
  assert.ok(leerEventoVentas(mensaje({ periodo: "2026-13", metricas: [] })).errores.length > 0);
  assert.ok(leerEventoVentas(mensaje({ periodo: "2026-11", metricas: [] })).errores.length > 0);
  assert.ok(
    leerEventoVentas(mensaje({ periodo: "2026-11", metricas: [{ id_empleado: "no-es-uuid", rol: "VENDEDOR", monto_ventas: 1, cuota_asignada: 1 }] }))
      .errores.length > 0
  );
  assert.ok(
    leerEventoVentas(mensaje({ periodo: "2026-11", metricas: [{ id_empleado: ANA, rol: "GERENTE", monto_ventas: 1, cuota_asignada: 1 }] }))
      .errores.length > 0
  );
  assert.ok(
    leerEventoVentas(mensaje({ periodo: "2026-11", metricas: [{ id_empleado: ANA, rol: "VENDEDOR", monto_ventas: 1, cuota_asignada: 0 }] }))
      .errores.length > 0
  );
});

test("leerEventoVentas omite al colaborador repetido pero procesa su primera aparición y al resto", () => {
  const cuerpo = mensaje({
    periodo: "2026-11",
    metricas: [
      { id_empleado: ANA, rol: "VENDEDOR", monto_ventas: 1000, cuota_asignada: 1000 },
      { id_empleado: ANA, rol: "VENDEDOR", monto_ventas: 2000, cuota_asignada: 1000 },
      { id_empleado: LUIS, rol: "CAJERO", monto_ventas: 500, cuota_asignada: 1000 },
    ],
  });
  const lectura = leerEventoVentas(cuerpo);
  assert.equal(lectura.errores, undefined);
  assert.equal(lectura.metricas.length, 2);
  assert.equal(lectura.metricas[0].monto_ventas, 1000);
  assert.equal(lectura.omitidos.length, 1);
  assert.equal(lectura.omitidos[0].id_empleado, ANA);
});

test("leerEventoVentas rechaza el mensaje solo cuando NINGÚN colaborador queda válido", () => {
  const cuerpo = mensaje({
    periodo: "2026-11",
    metricas: [
      { id_empleado: "no-es-uuid", rol: "VENDEDOR", monto_ventas: 1000, cuota_asignada: 1000 },
      { id_empleado: ANA, rol: "GERENTE", monto_ventas: 1000, cuota_asignada: 1000 },
    ],
  });
  const lectura = leerEventoVentas(cuerpo);
  assert.equal(lectura.metricas, undefined);
  assert.equal(lectura.errores.length, 2);
});

test("leerEventoVentas procesa a los colaboradores válidos y omite solo al que tiene datos inválidos", () => {
  const cuerpo = mensaje({
    periodo: "2026-11",
    metricas: [
      { id_empleado: ANA, rol: "VENDEDOR", monto_ventas: 15000, cuota_asignada: 12000 },
      { id_empleado: LUIS, rol: "GERENTE", monto_ventas: 1000, cuota_asignada: 1000 },
    ],
  });
  const lectura = leerEventoVentas(cuerpo);
  assert.equal(lectura.errores, undefined);
  assert.equal(lectura.metricas.length, 1);
  assert.equal(lectura.metricas[0].id_empleado, ANA);
  assert.equal(lectura.omitidos.length, 1);
  assert.equal(lectura.omitidos[0].id_empleado, LUIS);
  assert.match(lectura.omitidos[0].motivo, /rol/);
});

// ---- motor: montoDeRegla / cumpleUmbral ----

test("cumpleUmbral asigna el bono solo a quien alcanza el umbral de su regla", () => {
  const r = regla({ umbral_cumplimiento: 100 });
  assert.equal(cumpleUmbral(r, { porcentaje_cumplimiento: 100 }), true);
  assert.equal(cumpleUmbral(r, { porcentaje_cumplimiento: 125 }), true);
  assert.equal(cumpleUmbral(r, { porcentaje_cumplimiento: 99.99 }), false);
});

test("montoDeRegla calcula el monto fijo y deja el porcentaje para la planilla", () => {
  assert.equal(montoDeRegla(regla({ forma_calculo: "MONTO_FIJO", valor: 500 })), 500);
  assert.equal(montoDeRegla(regla({ forma_calculo: "PORCENTAJE", valor: 5 })), null);
});

const solicitud = (extra = {}) =>
  armarSolicitudCierre({
    idMensaje: "6f1c2a3b-0000-4000-8000-000000000001",
    fecha: "2026-11-09T14:00:00.000Z",
    periodo: "2026-10",
    solicitante: { id_empleado: ANA, nombre_completo: "Ana Pérez" },
    personal: [
      { id_empleado: LUIS, nombre_completo: "Luis Mamani", numero_documento: "222", cargo: "Cajero", sucursal: "Sopocachi", activo: true },
      { id_empleado: ANA, nombre_completo: "Ana Pérez", numero_documento: "111", cargo: "Vendedora", sucursal: "Centro" },
      { id_empleado: "e0000000-0000-4000-8000-000000000004", nombre_completo: "Pedro Condori", activo: false },
    ],
    topicoRespuesta: "ucb-sis323-sub-e",
    ...extra,
  });

test("la solicitud del cierre de ventas va de RRHH (F) a Ventas y Marketing (E) con el sobre común", () => {
  const { encabezado } = solicitud();
  assert.deepEqual(encabezado, {
    id_mensaje: "6f1c2a3b-0000-4000-8000-000000000001",
    origen: { grupo: "F", modulo: "RRHH" },
    destino: { grupo: "E", modulo: "Ventas y Marketing" },
    tipo: TIPO_SOLICITUD_CIERRE,
    fecha: "2026-11-09T14:00:00.000Z",
    version_esquema: 1,
  });
});

test("los atributos de Pub/Sub de la solicitud permiten a Ventas filtrarla sin leer el cuerpo", () => {
  assert.deepEqual(atributosDe(solicitud()), {
    id_mensaje: "6f1c2a3b-0000-4000-8000-000000000001",
    origen: "F",
    origen_modulo: "RRHH",
    destino: "E",
    destino_modulo: "Ventas y Marketing",
    tipo: "SOLICITUD_CIERRE_VENTAS_PERIODO",
    version_esquema: "1",
  });
});

test("la solicitud indica el rango del mes, quién la pidió y qué respuesta espera", () => {
  const { datos } = solicitud();
  assert.equal(datos.periodo, "2026-10");
  assert.equal(datos.fecha_inicio, "2026-10-01");
  assert.equal(datos.fecha_fin, "2026-10-31");
  assert.deepEqual(datos.solicitada, { por: { id_empleado: ANA, nombre_completo: "Ana Pérez" }, en: "2026-11-09T14:00:00.000Z" });
  assert.deepEqual(datos.respuesta_esperada, { tipo: "CIERRE_VENTAS_PERIODO", topico: "ucb-sis323-sub-e" });
});

test("el último día del mes contempla febrero en años bisiestos", () => {
  assert.equal(solicitud({ periodo: "2028-02" }).datos.fecha_fin, "2028-02-29");
  assert.equal(solicitud({ periodo: "2026-02" }).datos.fecha_fin, "2026-02-28");
});

test("la solicitud lleva solo el personal activo, ordenado por nombre", () => {
  const { datos } = solicitud();
  assert.equal(datos.cantidad_colaboradores, 2);
  assert.deepEqual(
    datos.colaboradores.map((c) => c.nombre_completo),
    ["Ana Pérez", "Luis Mamani"]
  );
  assert.deepEqual(datos.colaboradores[0], {
    id_empleado: ANA,
    nombre_completo: "Ana Pérez",
    numero_documento: "111",
    cargo: "Vendedora",
    sucursal: "Centro",
  });
});

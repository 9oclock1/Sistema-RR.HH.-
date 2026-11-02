const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/plantillas.model");
const transaccion = require("../src/config/transaccion");
const servicio = require("../src/services/plantillas.service");

const ID = "9f1c2d3e-0000-4000-8000-000000000001";
const ID_NUEVA = "9f1c2d3e-0000-4000-8000-000000000002";
const FAMILIA = ID;

const LIKERT = [1, 2, 3, 4, 5].map((valor) => ({ valor, etiqueta: `Nivel ${valor}` }));
const pregunta = (peso) => ({ enunciado: "Pregunta", peso, tipo_escala: "LIKERT", valor_minimo: 1, valor_maximo: 5, niveles: LIKERT });

let plantilla;
let contenido;

beforeEach(() => {
  mock.restoreAll();
  plantilla = { id_plantilla: ID, id_familia: FAMILIA, version: 1, nombre: "Cajeros", estado: "BORRADOR" };
  contenido = [{ id_criterio: "c1", nombre: "Productividad", preguntas: [pregunta(60), pregunta(40)] }];
  mock.method(transaccion, "enTransaccion", async (trabajo) => trabajo({}));
  mock.method(modelo, "obtener", async () => plantilla);
  mock.method(modelo, "obtenerContenido", async () => contenido);
  mock.method(modelo, "actualizarDatos", async () => {});
  mock.method(modelo, "reemplazarContenido", async () => {});
});

const fallaCon = async (promesa, estado, patron) =>
  assert.rejects(promesa, (error) => error.estado === estado && patron.test(error.message));

test("criterio 1: guarda los criterios y preguntas ponderadas de un borrador", async () => {
  const datos = { nombre: "Cajeros", criterios: [{ nombre: "Productividad", preguntas: [pregunta(70)] }] };
  const resultado = await servicio.actualizar(ID, datos);
  const [, id, criterios] = modelo.reemplazarContenido.mock.calls[0].arguments;
  assert.equal(id, ID);
  assert.equal(criterios[0].preguntas[0].peso, 70);
  assert.equal(resultado.criterios[0].peso, 100);
  assert.equal(resultado.balance.balanceado, true);
});

test("criterio 2: impide publicar si los pesos no suman 100 y muestra el desbalance", async () => {
  contenido[0].preguntas = [pregunta(60), pregunta(25)];
  const publicar = mock.method(modelo, "publicar", async () => {});
  await assert.rejects(servicio.publicar(ID), (error) => {
    assert.equal(error.estado, 422);
    const [detalle] = error.detalles;
    assert.equal(detalle.campo, "pesos");
    assert.equal(detalle.suma, 85);
    assert.equal(detalle.diferencia, 15);
    assert.match(detalle.mensaje, /faltan 15 %/);
    return true;
  });
  assert.equal(publicar.mock.callCount(), 0);
});

test("criterio 2: impide publicar si los pesos superan 100", async () => {
  contenido[0].preguntas = [pregunta(60), pregunta(50)];
  await assert.rejects(servicio.publicar(ID), (error) => error.estado === 422 && /sobran 10 %/.test(error.detalles[0].mensaje));
});

test("criterio 2: publica cuando la suma es exactamente 100", async () => {
  const publicar = mock.method(modelo, "publicar", async () => {
    plantilla = { ...plantilla, estado: "PUBLICADA" };
  });
  const resultado = await servicio.publicar(ID);
  assert.deepEqual(publicar.mock.calls[0].arguments.slice(1), [ID, FAMILIA]);
  assert.equal(resultado.estado, "PUBLICADA");
});

test("impide publicar una plantilla sin preguntas o con un criterio vacío", async () => {
  contenido = [];
  await fallaCon(servicio.publicar(ID), 422, /no tiene preguntas/);
  contenido = [
    { nombre: "Productividad", preguntas: [pregunta(100)] },
    { nombre: "Actitud", preguntas: [] },
  ];
  await fallaCon(servicio.publicar(ID), 422, /«Actitud» no tiene preguntas/);
});

test("criterio 4: una plantilla publicada no admite cambios en preguntas ni pesos", async () => {
  plantilla.estado = "PUBLICADA";
  const datos = { nombre: "Cajeros", criterios: [{ nombre: "Productividad", preguntas: [pregunta(100)] }] };
  await fallaCon(servicio.actualizar(ID, datos), 409, /Cree una nueva versión/);
  assert.equal(modelo.reemplazarContenido.mock.callCount(), 0);
  assert.equal(modelo.actualizarDatos.mock.callCount(), 0);
});

test("criterio 4: una plantilla publicada no se puede eliminar ni volver a publicar", async () => {
  plantilla.estado = "PUBLICADA";
  await fallaCon(servicio.eliminar(ID), 409, /Solo se pueden eliminar plantillas en borrador/);
  await fallaCon(servicio.publicar(ID), 409, /ya fue publicada/);
});

test("criterio 4: crea una nueva versión en borrador con el contenido de la publicada", async () => {
  plantilla.estado = "PUBLICADA";
  mock.method(modelo, "obtenerBorradorFamilia", async () => undefined);
  mock.method(modelo, "siguienteVersion", async () => 2);
  const crear = mock.method(modelo, "crear", async () => ID_NUEVA);

  const { creada } = await servicio.crearVersion(ID);

  assert.equal(creada, true);
  assert.deepEqual(crear.mock.calls[0].arguments[2], { idFamilia: FAMILIA, version: 2 });
  const [, id, criterios] = modelo.reemplazarContenido.mock.calls[0].arguments;
  assert.equal(id, ID_NUEVA);
  assert.equal(criterios, contenido);
});

test("criterio 4: si ya hay un borrador de la familia, lo reutiliza", async () => {
  plantilla.estado = "PUBLICADA";
  mock.method(modelo, "obtenerBorradorFamilia", async () => ({ id_plantilla: ID_NUEVA }));
  const crear = mock.method(modelo, "crear", async () => ID_NUEVA);

  const { creada } = await servicio.crearVersion(ID);

  assert.equal(creada, false);
  assert.equal(crear.mock.callCount(), 0);
});

test("no crea versiones a partir de un borrador", async () => {
  await fallaCon(servicio.crearVersion(ID), 409, /todavía es un borrador/);
});

test("responde 404 ante identificadores inválidos o inexistentes", async () => {
  await fallaCon(servicio.obtener("no-es-uuid"), 404, /no encontrada/);
  plantilla = undefined;
  await fallaCon(servicio.publicar(ID), 404, /no encontrada/);
});

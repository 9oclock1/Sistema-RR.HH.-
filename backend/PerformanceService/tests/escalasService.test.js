const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/escalasModel");
const transaccion = require("../src/config/transaccion");
const servicio = require("../src/services/escalasService");

const ID = "00000000-0000-4000-8000-000000000001";
const NIVELES = [
  { valor: 1, etiqueta: "Muy deficiente" },
  { valor: 2, etiqueta: "Deficiente" },
  { valor: 3, etiqueta: "Aceptable" },
  { valor: 4, etiqueta: "Bueno" },
  { valor: 5, etiqueta: "Excelente" },
];
const datos = (extra = {}) => ({ nombre: "Likert de 1 a 5", tipo: "CUANTITATIVA", niveles: NIVELES, ...extra });

let escala;

beforeEach(() => {
  mock.restoreAll();
  escala = { id_escala: ID, nombre: "Likert de 1 a 5", id_tipo_escala: 1, niveles: NIVELES, en_uso: true, en_uso_publicado: true };
  mock.method(transaccion, "enTransaccion", async (trabajo) => trabajo({}));
  mock.method(modelo, "obtenerEscala", async () => escala);
  mock.method(modelo, "actualizarEscala", async () => {});
  mock.method(modelo, "eliminarEscala", async () => {});
});

test("criterio 3: una escala usada en una plantilla publicada conserva sus niveles", async () => {
  const cambiados = NIVELES.map((n) => (n.valor === 3 ? { ...n, etiqueta: "Regular" } : n));
  await assert.rejects(servicio.actualizarEscala(ID, datos({ niveles: cambiados })), (error) => error.estado === 409);
  await assert.rejects(servicio.actualizarEscala(ID, datos({ tipo: "CUALITATIVA" })), (error) => error.estado === 409);
  assert.equal(modelo.actualizarEscala.mock.callCount(), 0);
});

test("criterio 3: en uso, solo cambia nombre y descripción", async () => {
  await servicio.actualizarEscala(ID, datos({ nombre: "Likert 1-5", descripcion: "Cinco niveles" }));
  const [, , cambios, niveles] = modelo.actualizarEscala.mock.calls[0].arguments;
  assert.equal(cambios.nombre, "Likert 1-5");
  assert.equal(niveles, null);
});

test("criterio 3: sin uso publicado se pueden reemplazar los niveles", async () => {
  escala.en_uso_publicado = false;
  const nuevos = [{ valor: 0, etiqueta: "No" }, { valor: 1, etiqueta: "Sí" }];
  await servicio.actualizarEscala(ID, datos({ tipo: "CUALITATIVA", niveles: nuevos }));
  assert.deepEqual(modelo.actualizarEscala.mock.calls[0].arguments[3], nuevos);
});

test("no elimina escalas asignadas a preguntas", async () => {
  await assert.rejects(servicio.eliminarEscala(ID), (error) => error.estado === 409);
  escala.en_uso = false;
  await servicio.eliminarEscala(ID);
  assert.equal(modelo.eliminarEscala.mock.callCount(), 1);
});

test("informa nombres repetidos", async () => {
  mock.method(modelo, "crearEscala", async () => {
    throw Object.assign(new Error("duplicado"), { code: "23505" });
  });
  await assert.rejects(servicio.crearEscala(datos()), (error) => error.estado === 409 && /Ya existe una escala/.test(error.message));
});

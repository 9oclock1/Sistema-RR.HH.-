const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const subirJustificativo = require("../src/middlewares/subirJustificativo");
const manejadorErrores = require("../src/middlewares/manejadorErrores");

const PDF = Buffer.from("%PDF-1.7\n%prueba");
const MB = 1024 * 1024;
let servidor;
let url;

before(async () => {
  const app = express();
  app.post("/subir", subirJustificativo, (req, res) =>
    res.json({ campos: req.body, archivos: req.files.map((a) => ({ nombre: a.originalname, tipo: a.mimetype, tamano: a.size })) })
  );
  app.use(manejadorErrores);
  await new Promise((listo) => {
    servidor = app.listen(0, "127.0.0.1", listo);
  });
  url = `http://127.0.0.1:${servidor.address().port}/subir`;
});

after(() => servidor.close());

async function enviar(archivos, { campo = "archivos", campos = { id_motivo: "1" } } = {}) {
  const formulario = new FormData();
  for (const [k, v] of Object.entries(campos)) formulario.append(k, v);
  for (const { nombre, tipo, datos } of archivos) formulario.append(campo, new Blob([datos], { type: tipo }), nombre);
  const respuesta = await fetch(url, { method: "POST", body: formulario });
  return { estado: respuesta.status, cuerpo: await respuesta.json() };
}
const pdf = (nombre = "certificado.pdf", datos = PDF) => ({ nombre, tipo: "application/pdf", datos });

test("acepta PDF, JPG y PNG con los campos del formulario", async () => {
  const { estado, cuerpo } = await enviar([
    pdf(),
    { nombre: "foto.jpg", tipo: "image/jpeg", datos: Buffer.from([0xff, 0xd8, 0xff]) },
    { nombre: "receta.png", tipo: "image/png", datos: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  ]);
  assert.equal(estado, 200);
  assert.equal(cuerpo.campos.id_motivo, "1");
  assert.deepEqual(cuerpo.archivos.map((a) => a.tipo), ["application/pdf", "image/jpeg", "image/png"]);
});

test("conserva tildes y eñes en el nombre del archivo", async () => {
  const { cuerpo } = await enviar([pdf("certificado médico de Íñigo.pdf")]);
  assert.equal(cuerpo.archivos[0].nombre, "certificado médico de Íñigo.pdf");
});

test("rechaza formatos distintos de PDF, JPG o PNG", async () => {
  for (const [nombre, tipo] of [
    ["foto.gif", "image/gif"],
    ["carta.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["programa.exe", "application/octet-stream"],
  ]) {
    const { estado, cuerpo } = await enviar([{ nombre, tipo, datos: Buffer.from("x") }]);
    assert.equal(estado, 400, nombre);
    assert.equal(cuerpo.detalles[0].campo, "archivos");
    assert.match(cuerpo.error, /Solo se aceptan PDF, JPG o PNG/);
  }
});

test("un archivo de 5 MB exactos pasa; uno de 5 MB y un byte, 413", async () => {
  assert.equal((await enviar([pdf("justo.pdf", Buffer.alloc(5 * MB))])).estado, 200);
  const { estado, cuerpo } = await enviar([pdf("grande.pdf", Buffer.alloc(5 * MB + 1))]);
  assert.equal(estado, 413);
  assert.deepEqual(cuerpo.detalles, [{ campo: "archivos", mensaje: "Cada archivo puede pesar hasta 5 MB." }]);
});

test("hasta 3 archivos", async () => {
  assert.equal((await enviar([pdf("1.pdf"), pdf("2.pdf"), pdf("3.pdf")])).estado, 200);
  const { estado, cuerpo } = await enviar([pdf("1.pdf"), pdf("2.pdf"), pdf("3.pdf"), pdf("4.pdf")]);
  assert.equal(estado, 400);
  assert.match(cuerpo.error, /hasta 3 archivos/);
});

test("archivos en otro campo o cuerpo que no es multipart: 400", async () => {
  assert.equal((await enviar([pdf()], { campo: "documento" })).estado, 400);
  const json = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(json.status, 400);
  assert.match((await json.json()).error, /multipart\/form-data/);
});

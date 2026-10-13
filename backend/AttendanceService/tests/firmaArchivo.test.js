const { test } = require("node:test");
const assert = require("node:assert/strict");
const { coincideFirma } = require("../src/utils/firmaArchivo");

test("reconoce las firmas de PDF, JPG y PNG", () => {
  assert.equal(coincideFirma(Buffer.from("%PDF-1.7"), "application/pdf"), true);
  assert.equal(coincideFirma(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"), true);
  assert.equal(coincideFirma(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), "image/png"), true);
});

test("rechaza contenido que no coincide con el tipo declarado", () => {
  assert.equal(coincideFirma(Buffer.from("MZ ejecutable"), "application/pdf"), false);
  assert.equal(coincideFirma(Buffer.from("%PDF-1.7"), "image/png"), false);
  assert.equal(coincideFirma(Buffer.alloc(0), "application/pdf"), false);
  assert.equal(coincideFirma(Buffer.from("%PDF-"), "text/plain"), false);
});

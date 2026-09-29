const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");

describe("RF-10: Carga digital y almacenamiento de CV", () => {
  const ID_POSTULACION_EXISTENTE = "01a0e556-71fb-75e0-b7d8-3fee1cbe069b";

  // formatos invalidos
  it("Debe rechazar archivos con formato no permitido (.txt)", async () => {
    const bufferTxt = Buffer.from("Contenido de prueba en texto plano");

    const res = await request(app)
      .patch(`/postulaciones/${ID_POSTULACION_EXISTENTE}/cv`)
      .attach("cv", bufferTxt, {
        filename: "cv_invalido.txt",
        contentType: "text/plain",
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, "INVALID_FILE_TYPE");
    assert.match(res.body.message, /Solo se aceptan archivos PDF o DOCX/);
  });
  // tamaños invalidos
  it("Debe rechazar archivos que excedan el tamaño máximo permitido", async () => {
    // Generar buffer en memoria de 6MB
    const bufferGrande = Buffer.alloc(6 * 1024 * 1024);

    const res = await request(app)
      .patch(`/postulaciones/${ID_POSTULACION_EXISTENTE}/cv`)
      .attach("cv", bufferGrande, {
        filename: "cv_pesado.pdf",
        contentType: "application/pdf",
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, "LIMIT_FILE_SIZE");
    assert.match(res.body.message, /supera el tamaño máximo/);
  });
  // visualizar o descargar archivo existente
  it("Debe entregar el archivo original (Content-Disposition inline o attachment)", async () => {
    const res = await request(app)
      .get(`/postulaciones/${ID_POSTULACION_EXISTENTE}/cv`)
      .query({ download: "true" });
    if (res.status === 200) {
      assert.match(res.headers["content-disposition"], /attachment/);
    } else {
      assert.equal(res.status, 404);
    }
  });

  // postulación sin archivo adjunto
  it("Debe rechazar peticiones que no adjunten ningún archivo", async () => {
    const res = await request(app).patch(
      `/postulaciones/${ID_POSTULACION_EXISTENTE}/cv`,
    );

    assert.equal(res.status, 400);
    assert.match(res.body.message, /obligatorio adjuntar el archivo/);
  });
});

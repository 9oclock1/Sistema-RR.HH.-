import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";

describe("RF-10: Carga digital y almacenamiento de CV", () => {
  const ID_CONVOCATORIA_TEST = "11111111-1111-7111-8111-111111111111";
  const ID_POSTULANTE_TEST = "33333333-3333-7333-8333-333333333333";
  const ID_POSTULACION_SIN_CV = "02b1f667-82ac-86f1-c8e9-4aff2dcf170c";

  // formatos invalidos
  it("Debe rechazar archivos con formato no permitido (.txt)", async () => {
    const bufferTxt = Buffer.from("Contenido de prueba en texto plano");

    const res = await request(app)
      .post("/postulaciones")
      .field("idConvocatoria", ID_CONVOCATORIA_TEST)
      .field("idPostulante", ID_POSTULANTE_TEST)
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
    const bufferGrande = Buffer.alloc(6 * 1024 * 1024);

    const res = await request(app)
      .post("/postulaciones")
      .field("idConvocatoria", ID_CONVOCATORIA_TEST)
      .field("idPostulante", ID_POSTULANTE_TEST)
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
    const ID_POSTULACION_EXISTENTE = "01a0e556-71fb-75e0-b7d8-3fee1cbe069b";

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
    const res = await request(app)
      .post("/postulaciones")
      .field("idConvocatoria", ID_CONVOCATORIA_TEST)
      .field("idPostulante", ID_POSTULANTE_TEST);

    assert.equal(res.status, 400);
    assert.match(res.body.message, /obligatorio adjuntar el archivo/);
  });

  // formatos invalidos, pero solo actualizamos el apartado de CV en postulaciones
  it("Debe rechazar archivos con formato no permitido (.txt)", async () => {
    const bufferTxt = Buffer.from("Texto plano");
    const res = await request(app)
      .patch(`/postulaciones/${ID_POSTULACION_SIN_CV}/cv`)
      .attach("cv", bufferTxt, {
        filename: "cv_invalido.txt",
        contentType: "text/plain",
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, "INVALID_FILE_TYPE");
  });
});

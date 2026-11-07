const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { PDFDocument, PDFName } = require("pdf-lib");
const { limpiarAdjunto } = require("../utils/limpiarAdjunto");
const {
  IDENTIDAD,
  jpegConExif,
  pngConExif,
  pdfConMetadatos,
  leerMetadatos,
  camposIdentificadores,
  escribirTemporales,
} = require("./ayudas/archivosQueja");

const limpiar = (buffer, mimetype, originalname = "archivo") => limpiarAdjunto({ buffer, mimetype, originalname });

describe("RF-68: limpieza de metadatos de los adjuntos", () => {
  const originales = {};
  const limpios = {};

  before(async () => {
    originales.jpg = await jpegConExif();
    originales.png = await pngConExif();
    originales.pdf = await pdfConMetadatos();
    limpios.jpg = await limpiar(originales.jpg, "image/jpeg");
    limpios.png = await limpiar(originales.png, "image/png");
    limpios.pdf = await limpiar(originales.pdf, "application/pdf");
  });

  it("los archivos de prueba sí traen la identidad en sus metadatos", async () => {
    assert.ok((await sharp(originales.jpg).metadata()).exif);
    assert.ok(originales.pdf.includes(Buffer.from(IDENTIDAD)));
  });

  it("JPG: se re-codifica sin EXIF, GPS, ICC ni XMP y sigue siendo una imagen válida", async () => {
    const meta = await sharp(limpios.jpg).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.exif, undefined);
    assert.equal(meta.xmp, undefined);
    assert.equal(meta.icc, undefined);
    assert.ok(!limpios.jpg.includes(Buffer.from("Juan")));
  });

  it("PNG: se re-codifica sin EXIF ni bloques de texto", async () => {
    const meta = await sharp(limpios.png).metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.exif, undefined);
    assert.ok(!limpios.png.includes(Buffer.from("Juan")));
    assert.ok(!limpios.png.includes(Buffer.from("eXIf")));
  });

  it("PDF: quita el diccionario Info, el XMP y el identificador del archivo, y conserva las páginas", async () => {
    const documento = await PDFDocument.load(limpios.pdf, { updateMetadata: false });
    assert.equal(documento.getPageCount(), 1);
    assert.equal(documento.getAuthor(), undefined);
    assert.equal(documento.getTitle(), undefined);
    assert.equal(documento.getCreator(), undefined);
    assert.equal(documento.catalog.get(PDFName.of("Metadata")), undefined);
    assert.equal(documento.context.trailerInfo.ID, undefined);
    for (const texto of ["Juan", "LaptopDeJuan", "Word de Juan", "xmpmeta", "A1B2C3D4E5F6"]) {
      assert.ok(!limpios.pdf.includes(Buffer.from(texto)), `el PDF limpio todavía contiene «${texto}»`);
    }
  });

  for (const [caso, buffer, tipo, mensaje] of [
    ["texto con extensión .pdf", Buffer.from("esto no es un pdf"), "application/pdf", "«archivo» no es un PDF válido."],
    ["un PDF declarado como PNG", null, "image/png", "«archivo» no es una imagen PNG válida."],
    ["un JPG declarado como PNG", "jpg", "image/png", "«archivo» no es una imagen PNG válida."],
    ["bytes al azar declarados como JPG", Buffer.from([1, 2, 3, 4, 5]), "image/jpeg", "«archivo» no es una imagen JPG válida."],
  ]) {
    it(`rechaza ${caso} con 400`, async () => {
      const contenido = buffer === null ? originales.pdf : buffer === "jpg" ? originales.jpg : buffer;
      await assert.rejects(limpiar(contenido, tipo), (error) => {
        assert.equal(error.estado, 400);
        assert.equal(error.message, mensaje);
        assert.equal(error.detalles[0].campo, "archivos");
        return true;
      });
    });
  }

  describe("verificación con exiftool sobre los adjuntos", () => {
    const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "quejas-exif-"));
    let metadatos;

    before(() => {
      const rutas = escribirTemporales(carpeta, {
        "original.jpg": originales.jpg,
        "original.png": originales.png,
        "original.pdf": originales.pdf,
        "limpio.jpg": limpios.jpg,
        "limpio.png": limpios.png,
        "limpio.pdf": limpios.pdf,
      });
      metadatos = leerMetadatos(rutas);
    });

    after(() => fs.rmSync(carpeta, { recursive: true, force: true }));

    it("exiftool encuentra la identidad en los originales", (t) => {
      if (!metadatos) return t.skip("exiftool no disponible (instálelo, defina EXIFTOOL_BIN o habilite Docker)");
      for (const nombre of ["original.jpg", "original.png", "original.pdf"]) {
        assert.ok(JSON.stringify(metadatos[nombre]).includes("Juan"), `${nombre} debía traer metadatos`);
      }
    });

    for (const nombre of ["limpio.jpg", "limpio.png", "limpio.pdf"]) {
      it(`exiftool no encuentra metadatos identificadores en ${nombre}`, (t) => {
        if (!metadatos) return t.skip("exiftool no disponible (instálelo, defina EXIFTOOL_BIN o habilite Docker)");
        assert.deepEqual(camposIdentificadores(metadatos[nombre]), []);
        assert.ok(!JSON.stringify(metadatos[nombre]).includes("Juan"));
      });
    }
  });
});

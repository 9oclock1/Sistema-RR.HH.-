const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { PDFDocument, PDFName, PDFHexString } = require("pdf-lib");

const IDENTIDAD = "Juan Perez Mamani";

const EXIF = {
  IFD0: { Artist: IDENTIDAD, Copyright: IDENTIDAD, Make: "CelularDeJuan", Model: "Modelo-Juan" },
  IFD3: { GPSLatitudeRef: "S", GPSLatitude: "16/1 30/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "68/1 9/1 0/1" },
};

const lienzo = { create: { width: 64, height: 32, channels: 3, background: "#c33" } };

const jpegConExif = () => sharp(lienzo).jpeg().withExif(EXIF).toBuffer();
const pngConExif = () => sharp(lienzo).png().withExif(EXIF).toBuffer();

const XMP = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><dc:creator><rdf:Seq><rdf:li>${IDENTIDAD}</rdf:li></rdf:Seq></dc:creator><xmp:CreatorTool>LaptopDeJuan</xmp:CreatorTool></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

async function pdfConMetadatos() {
  const documento = await PDFDocument.create();
  documento.addPage().drawText("Queja de prueba");
  documento.setAuthor(IDENTIDAD);
  documento.setTitle(`Queja de ${IDENTIDAD}`);
  documento.setCreator("Word de Juan");
  const xmp = documento.context.stream(XMP, { Type: "Metadata", Subtype: "XML" });
  documento.catalog.set(PDFName.of("Metadata"), documento.context.register(xmp));
  const id = PDFHexString.of("A1B2C3D4E5F60718293A4B5C6D7E8F90");
  documento.context.trailerInfo.ID = documento.context.obj([id, id]);
  return Buffer.from(await documento.save());
}

function ejecutarExiftool(archivos) {
  const argumentos = ["-j", "-a", "-G1", ...archivos.map((a) => path.basename(a))];
  const carpeta = path.dirname(archivos[0]);
  const candidatos = [process.env.EXIFTOOL_BIN, "exiftool"].filter(Boolean);
  for (const comando of candidatos) {
    try {
      return execFileSync(comando, argumentos, { cwd: carpeta, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch (error) {
      if (error.code !== "ENOENT" && error.status !== 1) throw error;
      if (error.status === 1 && error.stdout) return error.stdout;
    }
  }
  if (process.env.EXIFTOOL_DOCKER === "0") return null;
  try {
    return execFileSync(
      "docker",
      [
        "run",
        "--rm",
        "-v",
        `${carpeta}:/adjuntos:ro`,
        "-w",
        "/adjuntos",
        "alpine:3.20",
        "sh",
        "-c",
        `apk add -q --no-cache exiftool >/dev/null && exiftool ${argumentos.join(" ")}`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
    );
  } catch {
    return null;
  }
}

function leerMetadatos(archivos) {
  const salida = ejecutarExiftool(archivos);
  if (salida === null) return null;
  const porArchivo = JSON.parse(salida);
  return Object.fromEntries(porArchivo.map((datos) => [path.basename(datos.SourceFile), datos]));
}

const GRUPOS_IDENTIFICADORES = /^(IFD0|IFD1|ExifIFD|GPS|XMP-[\w-]+|PNG|PDF):/;
const CAMPOS_PDF_PERMITIDOS = new Set(["PDF:PDFVersion", "PDF:Linearized", "PDF:PageCount"]);

function camposIdentificadores(metadatos) {
  return Object.entries(metadatos)
    .filter(([clave]) => GRUPOS_IDENTIFICADORES.test(clave) && !CAMPOS_PDF_PERMITIDOS.has(clave))
    .filter(([clave]) => !/^PNG:(ImageWidth|ImageHeight|BitDepth|ColorType|Compression|Filter|Interlace)$/.test(clave))
    .map(([clave, valor]) => `${clave}=${valor}`);
}

function escribirTemporales(carpeta, archivos) {
  fs.mkdirSync(carpeta, { recursive: true });
  return Object.entries(archivos).map(([nombre, contenido]) => {
    const ruta = path.join(carpeta, nombre);
    fs.writeFileSync(ruta, contenido);
    return ruta;
  });
}

module.exports = {
  IDENTIDAD,
  jpegConExif,
  pngConExif,
  pdfConMetadatos,
  leerMetadatos,
  camposIdentificadores,
  escribirTemporales,
};

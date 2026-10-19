const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const DIRECTORIO = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads/licencias");

// La extensión sale del tipo validado, nunca del nombre que envía el cliente.
const EXTENSIONES = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

const rutaDe = (clave) => path.join(DIRECTORIO, path.basename(clave));

// Guarda el archivo y devuelve la clave con la que se registra en la BD.
async function guardar(archivo) {
  const clave = `${randomUUID()}${EXTENSIONES[archivo.mimetype] ?? ""}`;
  await fs.mkdir(DIRECTORIO, { recursive: true });
  await fs.writeFile(rutaDe(clave), archivo.buffer);
  return clave;
}

const eliminar = (clave) => fs.rm(rutaDe(clave), { force: true });

module.exports = { EXTENSIONES, guardar, eliminar, rutaDe };

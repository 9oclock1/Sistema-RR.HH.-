const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { TIPOS_ADJUNTO } = require("./justificaciones");

const DIRECTORIO = path.resolve(process.cwd(), process.env.DIR_JUSTIFICACIONES || "uploads/justificaciones");

const rutaDe = (clave) => path.join(DIRECTORIO, path.basename(clave));

// La extensión sale del tipo validado, nunca del nombre que envía el cliente.
async function guardar(archivo) {
  const clave = `${randomUUID()}${TIPOS_ADJUNTO[archivo.mimetype]}`;
  await fs.mkdir(DIRECTORIO, { recursive: true });
  await fs.writeFile(rutaDe(clave), archivo.buffer);
  return clave;
}

const eliminar = (clave) => fs.rm(rutaDe(clave), { force: true });

module.exports = { guardar, eliminar, rutaDe };

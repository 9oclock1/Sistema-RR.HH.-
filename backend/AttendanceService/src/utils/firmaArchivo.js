// Verifica que el contenido corresponda al tipo declarado: el MIME lo envía el cliente y no es confiable.
const FIRMAS = {
  "application/pdf": [Buffer.from("%PDF-")],
  "image/jpeg": [Buffer.from([0xff, 0xd8, 0xff])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
};

const coincideFirma = (buffer, mimetype) =>
  (FIRMAS[mimetype] ?? []).some((firma) => buffer.length >= firma.length && buffer.subarray(0, firma.length).equals(firma));

module.exports = { coincideFirma };

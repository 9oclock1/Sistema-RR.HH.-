const servicio = require("../services/justificaciones.service");

async function motivos(req, res) {
  res.json(await servicio.listarMotivos());
}

async function misNovedades(req, res) {
  res.json(await servicio.misNovedades(req.idEmpleado, req.query));
}

async function registrar(req, res) {
  res.status(201).json(await servicio.registrar(req.idEmpleado, req.body, req.files));
}

async function bandeja(req, res) {
  res.json(await servicio.bandeja(req.query));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.idSolicitud));
}

// Se muestra en el navegador (vista previa); con ?descargar=1 se descarga.
async function adjunto(req, res) {
  const { ruta, tipo, nombre } = await servicio.adjunto(req.params.idSolicitud, req.params.idAdjunto);
  const disposicion = req.query.descargar ? "attachment" : "inline";
  const ascii = nombre.replace(/[^\x20-\x7e]/g, "_");
  res.set({
    "Content-Type": tipo,
    "Content-Disposition": `${disposicion}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  });
  res.sendFile(ruta, (error) => {
    if (error && !res.headersSent) res.status(404).json({ error: "El archivo del comprobante ya no está disponible." });
  });
}

async function revisar(req, res) {
  res.json(await servicio.revisar(req.params.idSolicitud, req.idEmpleado, req.body));
}

module.exports = { motivos, misNovedades, registrar, bandeja, obtener, adjunto, revisar };

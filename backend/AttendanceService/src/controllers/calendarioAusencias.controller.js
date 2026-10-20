const servicio = require("../services/calendarioAusencias.service");

// Temporal: el portal envía quién consulta (X-Empleado-Id) y su rol (X-Rol) hasta contar con autenticación.
const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim().toLowerCase() || null,
  rol: req.get("X-Rol")?.trim().toLowerCase() || null,
});

async function alcance(req, res) {
  res.json(await servicio.alcance(identidad(req)));
}

async function consultar(req, res) {
  // La vista cambia con cada consulta y depende de quién la pide: no se guarda en cachés compartidos.
  res.set("Cache-Control", "private, no-store");
  res.json(await servicio.consultar(req.query, identidad(req)));
}

async function listarUmbrales(req, res) {
  res.json(await servicio.listarUmbrales(identidad(req)));
}

async function guardarUmbral(req, res) {
  res.json(await servicio.guardarUmbral(req.body, identidad(req)));
}

async function eliminarUmbral(req, res) {
  res.json(await servicio.eliminarUmbral(req.params.idUmbral, identidad(req)));
}

module.exports = { alcance, consultar, listarUmbrales, guardarUmbral, eliminarUmbral };

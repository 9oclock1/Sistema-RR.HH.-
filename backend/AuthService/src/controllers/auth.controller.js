const servicio = require("../services/auth.service");
const { COOKIE, DURACION_S, leerCookie, opcionesCookie } = require("../utils/token");

async function iniciarSesion(req, res) {
  const { token, usuario } = await servicio.iniciarSesion(req.body);
  res.cookie(COOKIE, token, { ...opcionesCookie, maxAge: DURACION_S * 1000 });
  res.json({ usuario });
}

function cerrarSesion(req, res) {
  res.clearCookie(COOKIE, opcionesCookie);
  res.status(204).end();
}

async function obtenerSesion(req, res) {
  res.json({ usuario: await servicio.obtenerSesion(leerCookie(req.headers.cookie)) });
}

module.exports = { iniciarSesion, cerrarSesion, obtenerSesion };

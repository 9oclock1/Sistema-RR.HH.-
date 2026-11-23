const servicio = require("../services/rotacion.service");

// req.identidad (colaborador y rol) viene del JWT verificado por el middleware autenticar; las cabeceras
// X-Empleado-Id y X-Rol se ignoran: el alcance del supervisor no se puede falsear desde el cliente.
async function obtenerTablero(req, res) {
  res.set("Cache-Control", "private, no-store");
  res.json(await servicio.obtenerTablero(req.query, req.identidad));
}

module.exports = { obtenerTablero };

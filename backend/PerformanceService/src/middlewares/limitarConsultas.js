const { createHmac, randomBytes } = require("node:crypto");
const { ErrorApp } = require("../utils/errores");

function crearLimitador({ maximo = 10, ventanaMs = 15 * 60 * 1000, ahora = Date.now } = {}) {
  const sal = randomBytes(16);
  const intentos = new Map();
  const huella = (ip) => createHmac("sha256", sal).update(String(ip)).digest("base64url");

  const limpiar = () => {
    const momento = ahora();
    for (const [clave, registro] of intentos) if (registro.reinicioEn <= momento) intentos.delete(clave);
  };
  setInterval(limpiar, ventanaMs).unref();

  return (req, res, next) => {
    const momento = ahora();
    const clave = huella(req.ip);
    let registro = intentos.get(clave);
    if (!registro || registro.reinicioEn <= momento) {
      registro = { conteo: 0, reinicioEn: momento + ventanaMs };
      intentos.set(clave, registro);
    }
    registro.conteo += 1;
    if (registro.conteo > maximo) {
      const segundos = Math.ceil((registro.reinicioEn - momento) / 1000);
      res.set("Retry-After", String(segundos));
      const minutos = Math.ceil(segundos / 60);
      return next(
        new ErrorApp(
          429,
          `Demasiados intentos de consulta. Espere ${minutos} ${minutos === 1 ? "minuto" : "minutos"} e intente nuevamente.`,
        ),
      );
    }
    next();
  };
}

module.exports = { crearLimitador };

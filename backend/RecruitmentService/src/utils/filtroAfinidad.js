const { ErrorApp } = require("./errores");

const leerLimite = (valor, nombre) => {
  if (valor === undefined || valor === null || valor === "") return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
    throw new ErrorApp(400, `El filtro '${nombre}' debe ser un número entre 0 y 100.`);
  }
  return numero;
};

// Lee ?minAfinidad y ?maxAfinidad (0-100) de la query de un listado de postulantes.
function leerFiltroAfinidad(query = {}) {
  const minAfinidad = leerLimite(query.minAfinidad, "minAfinidad");
  const maxAfinidad = leerLimite(query.maxAfinidad, "maxAfinidad");

  if (minAfinidad !== null && maxAfinidad !== null && minAfinidad > maxAfinidad) {
    throw new ErrorApp(400, "El filtro 'minAfinidad' no puede ser mayor que 'maxAfinidad'.");
  }
  return { minAfinidad, maxAfinidad };
}

module.exports = { leerFiltroAfinidad };

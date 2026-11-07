const modelo = require("../models/catalogos.model");
const transaccion = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { aCentesimas } = require("../utils/ponderacion");
const { validarEscala, validarCompetencia } = require("../utils/validarCatalogos");

const escalaNoEncontrada = () => new ErrorApp(404, "Escala de valoración no encontrada");

function traducirError(error, { nombre, catalogo }) {
  if (error.code === "23505") {
    return new ErrorApp(409, `Ya existe ${catalogo} con el nombre «${nombre}».`, [
      { campo: "nombre", mensaje: "Use otro nombre." },
    ]);
  }
  if (error.code === "23503") {
    return new ErrorApp(409, "La escala ya tiene respuestas registradas y no se puede modificar.");
  }
  return error;
}

const mismosNiveles = (actuales, nuevos) =>
  actuales.length === nuevos.length &&
  actuales.every(
    (nivel, i) => aCentesimas(nivel.valor) === aCentesimas(nuevos[i].valor) && nivel.etiqueta === nuevos[i].etiqueta
  );

async function bloquearEscala(db, idEscala) {
  const escala = UUID_RE.test(idEscala) ? await modelo.obtenerEscala(idEscala, db, { bloquear: true }) : undefined;
  if (!escala) throw escalaNoEncontrada();
  return escala;
}

const listarEscalas = () => modelo.listarEscalas();

async function obtenerEscala(idEscala) {
  const escala = UUID_RE.test(idEscala) ? await modelo.obtenerEscala(idEscala) : undefined;
  if (!escala) throw escalaNoEncontrada();
  return escala;
}

async function crearEscala(datos) {
  const escala = validarEscala(datos);
  const id = await transaccion.enTransaccion((db) => modelo.crearEscala(db, escala)).catch((error) => {
    throw traducirError(error, { nombre: escala.nombre, catalogo: "una escala" });
  });
  return obtenerEscala(id);
}

// El nombre y la descripción se pueden cambiar siempre. El tipo y los niveles no, si la escala ya se usa
// en una versión publicada: cambiaría el significado de las respuestas y de los puntajes ya calculados.
async function actualizarEscala(idEscala, datos) {
  const escala = validarEscala(datos);
  await transaccion
    .enTransaccion(async (db) => {
      const actual = await bloquearEscala(db, idEscala);
      const cambiaEstructura =
        actual.id_tipo_escala !== escala.id_tipo_escala || !mismosNiveles(actual.niveles, escala.niveles);
      if (cambiaEstructura && actual.en_uso_publicado) {
        throw new ErrorApp(
          409,
          `La escala «${actual.nombre}» se usa en una plantilla publicada: no se pueden cambiar su tipo ni sus niveles. Cree una escala nueva.`,
          [{ campo: "niveles", mensaje: "Solo puede cambiar el nombre y la descripción." }]
        );
      }
      await modelo.actualizarEscala(db, idEscala, escala, cambiaEstructura ? escala.niveles : null);
    })
    .catch((error) => {
      throw traducirError(error, { nombre: escala.nombre, catalogo: "una escala" });
    });
  return obtenerEscala(idEscala);
}

async function eliminarEscala(idEscala) {
  await transaccion.enTransaccion(async (db) => {
    const actual = await bloquearEscala(db, idEscala);
    if (actual.en_uso) {
      throw new ErrorApp(409, `La escala «${actual.nombre}» está asignada a preguntas de una plantilla y no se puede eliminar.`);
    }
    await modelo.eliminarEscala(db, idEscala);
  });
}

const listarCompetencias = () => modelo.listarCompetencias();

async function crearCompetencia(datos) {
  const competencia = validarCompetencia(datos);
  return modelo.crearCompetencia(competencia).catch((error) => {
    throw traducirError(error, { nombre: competencia.nombre, catalogo: "una competencia" });
  });
}

module.exports = {
  listarEscalas,
  obtenerEscala,
  crearEscala,
  actualizarEscala,
  eliminarEscala,
  listarCompetencias,
  crearCompetencia,
};

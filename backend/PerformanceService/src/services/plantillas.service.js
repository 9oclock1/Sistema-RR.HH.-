const modelo = require("../models/plantillas.model");
const transaccion = require("../config/transaccion");
const { ErrorApp, UUID_RE } = require("../utils/errores");
const { validarPlantilla } = require("../utils/validarPlantilla");
const { PESO_TOTAL, aCentesimas, balancePesos, pesoCriterio, describirDesbalance } = require("../utils/ponderacion");

const noEncontrada = () => new ErrorApp(404, "Plantilla no encontrada");

const requiereNuevaVersion = (plantilla) =>
  new ErrorApp(
    409,
    `La versión ${plantilla.version} de «${plantilla.nombre}» ya fue publicada. Cree una nueva versión para modificar sus preguntas o pesos sin alterar las evaluaciones en curso.`,
    [{ campo: "estado", mensaje: "Solo se pueden modificar plantillas en borrador." }]
  );

// Bloquea la fila de la plantilla hasta el fin de la transacción.
async function bloquear(db, id) {
  const plantilla = UUID_RE.test(id) ? await modelo.obtener(id, db, { bloquear: true }) : undefined;
  if (!plantilla) throw noEncontrada();
  return plantilla;
}

async function obtener(id) {
  const plantilla = UUID_RE.test(id) ? await modelo.obtener(id) : undefined;
  if (!plantilla) throw noEncontrada();
  const criterios = await modelo.obtenerContenido(id);
  return {
    ...plantilla,
    criterios: criterios.map((criterio) => ({ ...criterio, peso: pesoCriterio(criterio) })),
    balance: balancePesos(criterios),
  };
}

async function listar() {
  const plantillas = await modelo.listar();
  return plantillas.map((plantilla) => ({
    ...plantilla,
    balanceado: aCentesimas(plantilla.suma_pesos) === aCentesimas(PESO_TOTAL),
  }));
}

async function crear(datos) {
  const plantilla = validarPlantilla(datos);
  const id = await transaccion.enTransaccion(async (db) => {
    const nuevo = await modelo.crear(db, plantilla);
    await modelo.reemplazarContenido(db, nuevo, plantilla.criterios);
    return nuevo;
  });
  return obtener(id);
}

async function actualizar(id, datos) {
  const plantilla = validarPlantilla(datos);
  await transaccion.enTransaccion(async (db) => {
    const actual = await bloquear(db, id);
    if (actual.estado !== "BORRADOR") throw requiereNuevaVersion(actual);
    await modelo.actualizarDatos(db, id, plantilla);
    await modelo.reemplazarContenido(db, id, plantilla.criterios);
  });
  return obtener(id);
}

async function eliminar(id) {
  await transaccion.enTransaccion(async (db) => {
    const actual = await bloquear(db, id);
    if (actual.estado !== "BORRADOR") {
      throw new ErrorApp(409, "Solo se pueden eliminar plantillas en borrador; las publicadas se conservan como historial.");
    }
    await modelo.eliminar(db, id);
  });
}

async function publicar(id) {
  await transaccion.enTransaccion(async (db) => {
    const actual = await bloquear(db, id);
    if (actual.estado !== "BORRADOR") {
      throw new ErrorApp(409, `La versión ${actual.version} de «${actual.nombre}» ya fue publicada.`);
    }
    const criterios = await modelo.obtenerContenido(id, db);
    if (!criterios.some((criterio) => criterio.preguntas.length > 0)) {
      throw new ErrorApp(422, "La plantilla no tiene preguntas.", [
        { campo: "criterios", mensaje: "Agregue al menos un criterio con una pregunta antes de publicar." },
      ]);
    }
    const sinPreguntas = criterios.find((criterio) => criterio.preguntas.length === 0);
    if (sinPreguntas) {
      throw new ErrorApp(422, `El criterio «${sinPreguntas.nombre}» no tiene preguntas.`, [
        { campo: "criterios", mensaje: "Cada criterio necesita al menos una pregunta, o elimínelo." },
      ]);
    }
    const balance = balancePesos(criterios);
    if (!balance.balanceado) {
      throw new ErrorApp(422, "No se puede publicar: los pesos no suman 100 %.", [
        { campo: "pesos", mensaje: describirDesbalance(balance), ...balance },
      ]);
    }
    await modelo.publicar(db, id, actual.id_familia);
  });
  return obtener(id);
}

// Copia una versión publicada (o archivada) en un borrador nuevo. Si la familia ya tiene
// un borrador, lo devuelve en lugar de crear otro.
async function crearVersion(id) {
  const resultado = await transaccion.enTransaccion(async (db) => {
    const origen = await bloquear(db, id);
    if (origen.estado === "BORRADOR") {
      throw new ErrorApp(409, "La plantilla todavía es un borrador: puede editarla directamente.");
    }
    const borrador = await modelo.obtenerBorradorFamilia(db, origen.id_familia);
    if (borrador) return { id: borrador.id_plantilla, creada: false };

    const criterios = await modelo.obtenerContenido(id, db);
    const version = await modelo.siguienteVersion(db, origen.id_familia);
    const nuevo = await modelo.crear(db, origen, { idFamilia: origen.id_familia, version });
    await modelo.reemplazarContenido(db, nuevo, criterios);
    return { id: nuevo, creada: true };
  }).catch((error) => {
    // Otra solicitud creó el borrador de la familia al mismo tiempo.
    if (error.code === "23505") throw new ErrorApp(409, "Ya existe un borrador de esta plantilla. Recargue la lista.");
    throw error;
  });
  return { plantilla: await obtener(resultado.id), creada: resultado.creada };
}

module.exports = { listar, obtener, crear, actualizar, eliminar, publicar, crearVersion };

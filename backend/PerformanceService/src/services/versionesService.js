const plantillas = require("../models/plantillasModel");
const modelo = require("../models/versionesModel");
const empleados = require("./empleadosService");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { ESTADO_VERSION, validarId } = require("../utils/plantillas");
const { validarSecciones, validarPublicacion } = require("../utils/versiones");

const noEncontrada = () => new ErrorApp(404, "La plantilla de evaluación no existe.");
const versionNoEncontrada = () => new ErrorApp(404, "La versión de la plantilla no existe.");

const describirSeccion = (fila) => ({
  id_seccion: fila.id_seccion,
  orden: fila.orden,
  competencia: {
    id_competencia: fila.id_competencia,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    tipo_codigo: fila.tipo_codigo,
    tipo_nombre: fila.tipo_nombre,
    esta_activa: fila.esta_activa,
  },
});

async function describirVersion(version, db) {
  const secciones = await modelo.listarSecciones(version.id_version, db);
  return {
    id_version: version.id_version,
    id_plantilla: version.id_plantilla,
    numero_version: version.numero_version,
    estado_codigo: version.estado_codigo,
    estado_nombre: version.estado_nombre,
    editable: version.id_estado_version === ESTADO_VERSION.BORRADOR,
    publicada_en: version.publicada_en,
    publicador: version.publicador,
    secciones: secciones.map(describirSeccion),
  };
}

// Bloquea la plantilla y la versión para que dos solicitudes no cambien la estructura a la vez.
async function bloquear(idPlantilla, idVersion, db) {
  const plantilla = await plantillas.obtener(idPlantilla, { bloquear: true }, db);
  if (!plantilla) throw noEncontrada();
  if (idVersion === undefined) return { plantilla };
  const version = await modelo.obtener(idPlantilla, idVersion, { bloquear: true }, db);
  if (!version) throw versionNoEncontrada();
  return { plantilla, version };
}

async function obtener(idPlantilla, idVersion) {
  const plantilla = validarId(idPlantilla);
  const version = await modelo.obtener(plantilla, validarId(idVersion, "id_version"));
  if (!version) throw versionNoEncontrada();
  return describirVersion(version);
}

async function reemplazarSecciones(idPlantilla, idVersion, cuerpo) {
  const plantilla = validarId(idPlantilla);
  const idsCompetencia = validarSecciones(cuerpo);
  const idVersionValido = validarId(idVersion, "id_version");

  return enTransaccion(async (db) => {
    const { version } = await bloquear(plantilla, idVersionValido, db);
    if (version.id_estado_version !== ESTADO_VERSION.BORRADOR)
      throw new ErrorApp(409, "La versión ya fue publicada: su estructura no se puede modificar. Cree una nueva versión.");

    const competencias = new Map(
      (await modelo.listarCompetencias(idsCompetencia, db)).map((c) => [c.id_competencia, c]),
    );
    const yaEnLaVersion = new Set((await modelo.listarSecciones(idVersionValido, db)).map((s) => s.id_competencia));
    const errores = [];
    idsCompetencia.forEach((id, posicion) => {
      const competencia = competencias.get(id);
      const campo = `secciones[${posicion}].id_competencia`;
      if (!competencia) errores.push({ campo, mensaje: "La competencia no existe." });
      else if (!competencia.esta_activa && !yaEnLaVersion.has(id))
        errores.push({ campo, mensaje: `La competencia "${competencia.nombre}" está desactivada.` });
    });
    if (errores.length > 0) throw new ErrorApp(422, "Datos inválidos", errores);

    await modelo.reemplazarSecciones(idVersionValido, idsCompetencia, db);
    await modelo.tocarPlantilla(plantilla, db);
    return describirVersion(version, db);
  });
}

// Publica la versión: queda disponible para los ciclos y su estructura ya no se modifica.
async function publicar(idEmpleado, idPlantilla, idVersion) {
  const plantilla = validarId(idPlantilla);
  const idVersionValido = validarId(idVersion, "id_version");
  const publicador = await empleados.obtenerEmpleado(idEmpleado);
  if (!publicador) throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");

  return enTransaccion(async (db) => {
    const { plantilla: cabecera, version } = await bloquear(plantilla, idVersionValido, db);
    if (version.id_estado_version !== ESTADO_VERSION.BORRADOR)
      throw new ErrorApp(409, "La versión ya fue publicada.");

    const secciones = (await modelo.listarSecciones(idVersionValido, db)).map(describirSeccion);
    const problemas = validarPublicacion({ plantilla: cabecera, secciones, hoy: await modelo.hoy(db) });
    if (problemas.length > 0) throw new ErrorApp(422, "La plantilla no se puede publicar todavía.", problemas);

    await plantillas.asegurarEmpleado(publicador, db);
    await modelo.publicar(plantilla, idVersionValido, publicador.id_empleado, db);
    await modelo.tocarPlantilla(plantilla, db);
    return describirVersion(await modelo.obtener(plantilla, idVersionValido, {}, db), db);
  });
}

// Nuevo borrador con la estructura de la versión más reciente: es la forma de cambiar una plantilla ya publicada.
async function crearVersion(idPlantilla) {
  const plantilla = validarId(idPlantilla);

  return enTransaccion(async (db) => {
    const { plantilla: cabecera } = await bloquear(plantilla, undefined, db);
    if (cabecera.id_estado_version === ESTADO_VERSION.BORRADOR)
      throw new ErrorApp(409, "La plantilla ya tiene una versión en borrador: edítela o publíquela antes de crear otra.");

    const idNueva = await modelo.crearBorrador(plantilla, (await modelo.ultimoNumero(plantilla, db)) + 1, db);
    await modelo.copiarEstructura(cabecera.id_version, idNueva, db);
    await modelo.tocarPlantilla(plantilla, db);
    return describirVersion(await modelo.obtener(plantilla, idNueva, {}, db), db);
  });
}

module.exports = { obtener, reemplazarSecciones, publicar, crearVersion };

const plantillas = require("../models/plantillasModel");
const modelo = require("../models/versionesModel");
const empleados = require("./empleadosService");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { ESTADO_VERSION, validarId } = require("../utils/plantillas");
const { validarSecciones, validarEstructura, validarPublicacion } = require("../utils/versiones");
const { balancePesos } = require("../utils/ponderacion");

const noEncontrada = () => new ErrorApp(404, "La plantilla de evaluación no existe.");
const versionNoEncontrada = () => new ErrorApp(404, "La versión de la plantilla no existe.");

const describirPregunta = (fila) => ({
  id_pregunta: fila.id_pregunta,
  orden: fila.orden,
  texto: fila.texto,
  peso_porcentual: fila.peso_porcentual,
  es_obligatoria: fila.es_obligatoria,
  id_escala: fila.id_escala,
});

const describirCriterio = (fila, preguntas) => ({
  id_criterio: fila.id_criterio,
  orden: fila.orden,
  nombre: fila.nombre,
  descripcion: fila.descripcion,
  preguntas: preguntas.filter((p) => p.id_criterio === fila.id_criterio).map(describirPregunta),
});

const describirSeccion = (fila, criterios = [], preguntas = []) => ({
  id_seccion: fila.id_seccion,
  orden: fila.orden,
  criterios: criterios.filter((c) => c.id_seccion === fila.id_seccion).map((c) => describirCriterio(c, preguntas)),
  competencia: {
    id_competencia: fila.id_competencia,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    tipo_codigo: fila.tipo_codigo,
    tipo_nombre: fila.tipo_nombre,
    esta_activa: fila.esta_activa,
  },
});

// Secciones con sus criterios y preguntas. Las consultas van una tras otra: db puede ser el cliente de una transacción.
async function cargarEstructura(idVersion, db) {
  const secciones = await modelo.listarSecciones(idVersion, db);
  const criterios = await modelo.listarCriterios(idVersion, db);
  const preguntas = await modelo.listarPreguntas(idVersion, db);
  return secciones.map((seccion) => describirSeccion(seccion, criterios, preguntas));
}

async function describirVersion(version, db) {
  const secciones = await cargarEstructura(version.id_version, db);
  return {
    id_version: version.id_version,
    id_plantilla: version.id_plantilla,
    numero_version: version.numero_version,
    estado_codigo: version.estado_codigo,
    estado_nombre: version.estado_nombre,
    editable: version.id_estado_version === ESTADO_VERSION.BORRADOR,
    publicada_en: version.publicada_en,
    publicador: version.publicador,
    secciones,
    total_preguntas: secciones.reduce((n, s) => n + s.criterios.reduce((m, c) => m + c.preguntas.length, 0), 0),
    balance: balancePesos(secciones),
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

// Reemplaza secciones, criterios y preguntas del borrador en un solo paso.
async function guardarEstructura(idPlantilla, idVersion, cuerpo) {
  const plantilla = validarId(idPlantilla);
  const idVersionValido = validarId(idVersion, "id_version");
  const { secciones } = validarEstructura(cuerpo);

  return enTransaccion(async (db) => {
    const { version } = await bloquear(plantilla, idVersionValido, db);
    if (version.id_estado_version !== ESTADO_VERSION.BORRADOR)
      throw new ErrorApp(409, "La versión ya fue publicada: su estructura no se puede modificar. Cree una nueva versión.");

    const competencias = new Map(
      (await modelo.listarCompetencias(secciones.map((s) => s.id_competencia), db)).map((c) => [c.id_competencia, c]),
    );
    const yaEnLaVersion = new Set((await modelo.listarSecciones(idVersionValido, db)).map((s) => s.id_competencia));
    const idsEscala = [...new Set(secciones.flatMap((s) => s.criterios.flatMap((c) => c.preguntas.map((p) => p.id_escala))))];
    const escalas = await modelo.escalasExistentes(idsEscala, db);

    const errores = [];
    secciones.forEach((seccion, i) => {
      const competencia = competencias.get(seccion.id_competencia);
      const campo = `secciones[${i}].id_competencia`;
      if (!competencia) errores.push({ campo, mensaje: "La competencia no existe." });
      else if (!competencia.esta_activa && !yaEnLaVersion.has(seccion.id_competencia))
        errores.push({ campo, mensaje: `La competencia "${competencia.nombre}" está desactivada.` });
      seccion.criterios.forEach((criterio, j) =>
        criterio.preguntas.forEach((pregunta, k) => {
          if (!escalas.has(pregunta.id_escala))
            errores.push({
              campo: `secciones[${i}].criterios[${j}].preguntas[${k}].id_escala`,
              mensaje: "La escala de valoración no existe.",
            });
        }),
      );
    });
    if (errores.length > 0) throw new ErrorApp(422, "Datos inválidos", errores);

    await modelo.reemplazarEstructura(idVersionValido, secciones, db);
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

    const secciones = await cargarEstructura(idVersionValido, db);
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
    // Los datos base no se pueden cambiar tras publicar: con la vigencia terminada, la versión nueva nunca podría publicarse.
    if (cabecera.vigencia_hasta < (await modelo.hoy(db)))
      throw new ErrorApp(
        409,
        `La vigencia de la plantilla terminó el ${cabecera.vigencia_hasta}: cree una plantilla nueva en lugar de otra versión.`,
      );
    if (cabecera.id_estado_version === ESTADO_VERSION.BORRADOR)
      throw new ErrorApp(409, "La plantilla ya tiene una versión en borrador: edítela o publíquela antes de crear otra.");

    const idNueva = await modelo.crearBorrador(plantilla, (await modelo.ultimoNumero(plantilla, db)) + 1, db);
    await modelo.copiarEstructura(cabecera.id_version, idNueva, db);
    await modelo.tocarPlantilla(plantilla, db);
    return describirVersion(await modelo.obtener(plantilla, idNueva, {}, db), db);
  });
}

module.exports = { obtener, reemplazarSecciones, guardarEstructura, publicar, crearVersion };

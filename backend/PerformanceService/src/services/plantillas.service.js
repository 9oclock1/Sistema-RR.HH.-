const modelo = require("../models/plantillas.model");
const transaccion = require("../config/transaccion");
const empleados = require("./empleados.service");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { ESTADO_VERSION } = require("../utils/catalogos");
const { validarPlantilla } = require("../utils/validarPlantilla");
const {
  PESO_TOTAL,
  aCentesimas,
  balancePesos,
  pesoCriterio,
  pesoSeccion,
  describirDesbalance,
} = require("../utils/ponderacion");

const noEncontrada = () => new ErrorApp(404, "Versión de plantilla no encontrada");

const requiereNuevaVersion = (version) =>
  new ErrorApp(
    409,
    `La versión ${version.numero_version} de «${version.nombre}» ya fue publicada. Cree una nueva versión para modificar sus preguntas o pesos sin alterar las evaluaciones en curso.`,
    [{ campo: "estado", mensaje: "Solo se pueden modificar versiones en borrador." }]
  );

const empleadoNoRegistrado = () => new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");

const areaInvalida = () =>
  new ErrorApp(400, "Datos de plantilla inválidos", [
    { campo: "id_departamento_destino", mensaje: "El área no existe o fue dada de baja." },
  ]);

// Traduce las restricciones de PerformanceDB a errores para el usuario.
function traducirError(error, nombre) {
  if (error.code === "23P01") {
    return new ErrorApp(409, `Ya existe una plantilla «${nombre}» para esa área con una vigencia que se cruza.`, [
      { campo: "vigencia_desde", mensaje: "Elija otra vigencia, otro nombre u otra área." },
    ]);
  }
  if (error.code === "23503") {
    return new ErrorApp(409, "La plantilla está en uso por un ciclo de evaluación y no se puede modificar así.");
  }
  return error;
}

async function bloquear(db, idVersion) {
  const version = UUID_RE.test(idVersion) ? await modelo.obtenerVersion(idVersion, db, { bloquear: true }) : undefined;
  if (!version) throw noEncontrada();
  return version;
}

// Comprueba que las competencias estén activas y que las escalas existan.
async function verificarCatalogos(db, secciones) {
  const idsCompetencias = secciones.map((s) => s.id_competencia);
  const idsEscalas = [
    ...new Set(secciones.flatMap((s) => s.criterios).flatMap((c) => c.preguntas).map((p) => p.id_escala)),
  ];
  // En secuencia: db es el cliente de la transacción.
  const competencias = await modelo.competenciasActivas(db, idsCompetencias);
  const escalas = await modelo.escalasExistentes(db, idsEscalas);

  const errores = [];
  secciones.forEach((seccion, i) => {
    if (!competencias.has(seccion.id_competencia)) {
      errores.push({ campo: `secciones[${i}].id_competencia`, mensaje: "La competencia no existe o está inactiva." });
    }
    seccion.criterios.forEach((criterio, j) =>
      criterio.preguntas.forEach((pregunta, k) => {
        if (!escalas.has(pregunta.id_escala)) {
          errores.push({
            campo: `secciones[${i}].criterios[${j}].preguntas[${k}].id_escala`,
            mensaje: "La escala no existe.",
          });
        }
      })
    );
  });
  if (errores.length > 0) throw new ErrorApp(400, "Datos de plantilla inválidos", errores);
}

async function departamentoDestino(idDepartamento) {
  const departamento = await empleados.obtenerDepartamento(idDepartamento);
  if (!departamento) throw areaInvalida();
  return departamento;
}

async function obtener(idVersion) {
  const version = UUID_RE.test(idVersion) ? await modelo.obtenerVersion(idVersion) : undefined;
  if (!version) throw noEncontrada();
  const secciones = await modelo.obtenerEstructura(idVersion);
  const { id_estado_version, tiene_publicadas, ...datos } = version;
  return {
    ...datos,
    // Los datos base son de la plantilla y los comparten todas sus versiones: se fijan al publicar la primera.
    datos_editables: id_estado_version === ESTADO_VERSION.BORRADOR && !tiene_publicadas,
    secciones: secciones.map((seccion) => ({
      ...seccion,
      peso: pesoSeccion(seccion),
      criterios: seccion.criterios.map((criterio) => ({ ...criterio, peso: pesoCriterio(criterio) })),
    })),
    balance: balancePesos(secciones),
  };
}

async function listar() {
  const versiones = await modelo.listar();
  return versiones.map((version) => ({
    ...version,
    balanceado: aCentesimas(version.suma_pesos) === aCentesimas(PESO_TOTAL),
  }));
}

async function crear(idCreador, datos) {
  const plantilla = validarPlantilla(datos);
  const [creador, departamento] = await Promise.all([
    empleados.obtenerEmpleado(idCreador),
    departamentoDestino(plantilla.id_departamento_destino),
  ]);
  if (!creador) throw empleadoNoRegistrado();

  const idVersion = await transaccion
    .enTransaccion(async (db) => {
      await verificarCatalogos(db, plantilla.secciones);
      await modelo.replicarEmpleado(db, creador);
      await modelo.replicarDepartamento(db, departamento);
      const idPlantilla = await modelo.crearPlantilla(db, plantilla, creador.id_empleado);
      const nueva = await modelo.crearVersion(db, idPlantilla);
      await modelo.reemplazarEstructura(db, nueva, plantilla.secciones);
      return nueva;
    })
    .catch((error) => {
      throw traducirError(error, plantilla.nombre);
    });
  return obtener(idVersion);
}

async function actualizar(idVersion, datos) {
  const previa = UUID_RE.test(idVersion) ? await modelo.obtenerVersion(idVersion) : undefined;
  if (!previa) throw noEncontrada();
  const conDatosBase = !previa.tiene_publicadas;
  const plantilla = validarPlantilla(datos, { conDatosBase });
  const departamento = conDatosBase ? await departamentoDestino(plantilla.id_departamento_destino) : null;

  await transaccion
    .enTransaccion(async (db) => {
      const actual = await bloquear(db, idVersion);
      if (actual.id_estado_version !== ESTADO_VERSION.BORRADOR) throw requiereNuevaVersion(actual);
      await verificarCatalogos(db, plantilla.secciones);
      // Si entre tanto se publicó otra versión, los datos base ya quedaron fijos.
      if (conDatosBase && !actual.tiene_publicadas) {
        await modelo.replicarDepartamento(db, departamento);
        await modelo.actualizarPlantilla(db, actual.id_plantilla, plantilla);
      }
      await modelo.reemplazarEstructura(db, idVersion, plantilla.secciones);
    })
    .catch((error) => {
      throw traducirError(error, plantilla.nombre ?? previa.nombre);
    });
  return obtener(idVersion);
}

async function eliminar(idVersion) {
  await transaccion
    .enTransaccion(async (db) => {
      const actual = await bloquear(db, idVersion);
      if (actual.id_estado_version !== ESTADO_VERSION.BORRADOR) {
        throw new ErrorApp(409, "Solo se pueden eliminar versiones en borrador; las publicadas se conservan como historial.");
      }
      await modelo.eliminarVersion(db, idVersion, actual.id_plantilla);
    })
    .catch((error) => {
      throw traducirError(error);
    });
}

function verificarPublicable(secciones) {
  const preguntas = secciones.flatMap((s) => s.criterios).flatMap((c) => c.preguntas);
  if (preguntas.length === 0) {
    throw new ErrorApp(422, "La plantilla no tiene preguntas.", [
      { campo: "secciones", mensaje: "Agregue al menos una sección con un criterio y una pregunta antes de publicar." },
    ]);
  }
  const seccionVacia = secciones.find((s) => s.criterios.length === 0);
  if (seccionVacia) {
    throw new ErrorApp(422, `La sección «${seccionVacia.competencia}» no tiene criterios.`, [
      { campo: "secciones", mensaje: "Cada sección necesita al menos un criterio, o elimínela." },
    ]);
  }
  const criterioVacio = secciones.flatMap((s) => s.criterios).find((c) => c.preguntas.length === 0);
  if (criterioVacio) {
    throw new ErrorApp(422, `El criterio «${criterioVacio.nombre}» no tiene preguntas.`, [
      { campo: "secciones", mensaje: "Cada criterio necesita al menos una pregunta, o elimínelo." },
    ]);
  }
  const balance = balancePesos(secciones);
  if (!balance.balanceado) {
    throw new ErrorApp(422, "No se puede publicar: los pesos no suman 100 %.", [
      { campo: "pesos", mensaje: describirDesbalance(balance), ...balance },
    ]);
  }
}

async function publicar(idPublicador, idVersion) {
  const publicador = await empleados.obtenerEmpleado(idPublicador);
  if (!publicador) throw empleadoNoRegistrado();

  await transaccion.enTransaccion(async (db) => {
    const actual = await bloquear(db, idVersion);
    if (actual.id_estado_version !== ESTADO_VERSION.BORRADOR) {
      throw new ErrorApp(409, `La versión ${actual.numero_version} de «${actual.nombre}» ya fue publicada.`);
    }
    verificarPublicable(await modelo.obtenerEstructura(idVersion, db));
    await modelo.replicarEmpleado(db, publicador);
    await modelo.publicar(db, idVersion, actual.id_plantilla, publicador.id_empleado);
  });
  return obtener(idVersion);
}

// Copia una versión publicada (o archivada) en un borrador nuevo de la misma plantilla. Si la plantilla
// ya tiene un borrador, lo devuelve en lugar de crear otro. El bloqueo de la plantilla evita dos borradores.
async function crearVersion(idVersion) {
  const resultado = await transaccion.enTransaccion(async (db) => {
    const origen = await bloquear(db, idVersion);
    if (origen.id_estado_version === ESTADO_VERSION.BORRADOR) {
      throw new ErrorApp(409, "La versión todavía es un borrador: puede editarla directamente.");
    }
    const borrador = await modelo.obtenerBorrador(db, origen.id_plantilla);
    if (borrador) return { id: borrador.id_version, creada: false };

    const secciones = await modelo.obtenerEstructura(idVersion, db);
    const numero = await modelo.siguienteNumero(db, origen.id_plantilla);
    const nueva = await modelo.crearVersion(db, origen.id_plantilla, numero);
    await modelo.reemplazarEstructura(db, nueva, secciones);
    return { id: nueva, creada: true };
  });
  return { plantilla: await obtener(resultado.id), creada: resultado.creada };
}

module.exports = { listar, obtener, crear, actualizar, eliminar, publicar, crearVersion };

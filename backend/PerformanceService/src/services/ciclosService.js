const modelo = require("../models/ciclosModel");
const { hoy } = require("../models/evaluacionesModel");
const { enTransaccion } = require("../config/transaccion");
const empleados = require("./empleados.service");
const jerarquia = require("./jerarquiaExterna");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { ESTADO_VERSION } = require("../utils/catalogos");
const { nombreCompleto } = require("../utils/evaluaciones");
const { validarCiclo, validarVistaPrevia, verificarFechas } = require("../utils/ciclos");
const { resolverAsignaciones } = require("../utils/asignacionCiclo");

const CONSULTAS_SIMULTANEAS = 8;

// Ejecuta tarea(elemento) para todos los elementos sin pasar de `limite` consultas a la vez.
async function conLimite(elementos, limite, tarea) {
  const resultados = new Array(elementos.length);
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.min(limite, elementos.length) }, async () => {
    while (siguiente < elementos.length) {
      const posicion = siguiente++;
      resultados[posicion] = await tarea(elementos[posicion]);
    }
  });
  await Promise.all(trabajadores);
  return resultados;
}

// Traduce las restricciones de PerformanceDB a errores para el usuario.
function traducirError(error, nombre) {
  if (error.code === "23505" && error.constraint === "uq_ciclo_periodo_nombre") {
    return new ErrorApp(409, `Ya existe un ciclo «${nombre}» en ese periodo.`, [
      { campo: "nombre", mensaje: "Elija otro nombre o escoja otro periodo." },
    ]);
  }
  return error;
}

async function opciones() {
  const [versiones, periodos] = await Promise.all([modelo.listarVersionesPublicadas(), modelo.listarPeriodos()]);
  return { versiones, periodos };
}

async function resolver(alcance, idDepartamentoPlantilla) {
  const [colaboradores, cargos] = await Promise.all([jerarquia.listarColaboradores(), jerarquia.listarCargos()]);
  return resolverAsignaciones({ empleados: colaboradores, cargos, alcance, idDepartamentoPlantilla });
}

const resumir = ({ asignaciones, omitidos, advertencias }) => ({
  total: asignaciones.length,
  asignaciones,
  omitidos,
  advertencias,
});

// Calcula las asignaciones del alcance sin guardar nada: es lo que el asistente muestra antes de confirmar.
async function vistaPrevia(cuerpo) {
  const { idVersion, alcance } = validarVistaPrevia(cuerpo);
  const version = idVersion ? await modelo.obtenerVersion(idVersion) : null;
  return resumir(await resolver(alcance, version?.id_departamento_destino ?? null));
}

async function verificarProgramacion(datos) {
  const [version, periodo, dia] = await Promise.all([
    modelo.obtenerVersion(datos.idVersion),
    modelo.obtenerPeriodo(datos.idPeriodo),
    hoy(),
  ]);

  const errores = [];
  if (!version) errores.push({ campo: "id_version", mensaje: "La versión de plantilla no existe." });
  if (!periodo) errores.push({ campo: "id_periodo", mensaje: "El periodo de evaluación no existe." });
  if (errores.length > 0) throw new ErrorApp(400, "Datos de ciclo inválidos", errores);

  if (version.id_estado_version !== ESTADO_VERSION.PUBLICADA) {
    throw new ErrorApp(
      422,
      `La versión ${version.numero_version} de «${version.plantilla}» no está publicada. Publíquela antes de programar un ciclo.`,
      [{ campo: "id_version", mensaje: "Solo se pueden programar plantillas publicadas." }],
    );
  }
  const erroresFechas = verificarFechas(datos, periodo, dia);
  if (erroresFechas.length > 0) throw new ErrorApp(400, "Datos de ciclo inválidos", erroresFechas);
  return version;
}

// Nombres y apellidos de todos los que participan, que EmployeeService no entrega en el listado.
async function consultarPersonas(ids) {
  const personas = await conLimite(ids, CONSULTAS_SIMULTANEAS, (id) => empleados.obtenerEmpleado(id));
  if (personas.some((persona) => !persona)) {
    throw new ErrorApp(503, "No se pudieron consultar los datos de algunos colaboradores. Intente nuevamente.");
  }
  return personas;
}

// Crea el ciclo PROGRAMADO y, en la misma transacción, una evaluación PENDIENTE por cada asignación evaluador–evaluado.
async function crear(idCreador, cuerpo) {
  const datos = validarCiclo(cuerpo);
  const version = await verificarProgramacion(datos);

  const creador = await empleados.obtenerEmpleado(idCreador);
  if (!creador) throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");

  const resultado = await resolver(datos.alcance, version.id_departamento_destino);
  if (resultado.asignaciones.length === 0) {
    throw new ErrorApp(422, "El alcance elegido no genera ninguna asignación evaluador–evaluado.", resultado.omitidos);
  }

  const { asignaciones } = resultado;
  const idsPersonas = [
    ...new Set(asignaciones.flatMap(({ evaluado, evaluador }) => [evaluado.id_empleado, evaluador.id_empleado])),
  ];
  const personas = await consultarPersonas(idsPersonas);

  const areas = new Map(asignaciones.map(({ evaluado }) => [evaluado.id_departamento, evaluado.area]));
  const sucursales = new Map(asignaciones.map(({ evaluado }) => [evaluado.id_sucursal, evaluado.sucursal]));

  const idCiclo = await enTransaccion(async (db) => {
    await modelo.replicarEmpleado(db, creador);
    for (const persona of personas) await modelo.replicarEmpleado(db, persona);
    await modelo.replicarDepartamentos(
      db,
      [...areas].map(([id_departamento, nombre]) => ({ id_departamento, nombre })),
    );
    await modelo.replicarSucursales(
      db,
      [...sucursales].map(([id_sucursal, nombre]) => ({ id_sucursal, nombre })),
    );

    const id = await modelo.crearCiclo(db, datos, creador.id_empleado);
    await modelo.insertarEvaluaciones(
      db,
      id,
      asignaciones.map(({ evaluado, evaluador }) => ({
        idEvaluado: evaluado.id_empleado,
        idEvaluador: evaluador.id_empleado,
        idDepartamento: evaluado.id_departamento,
        idSucursal: evaluado.id_sucursal,
      })),
    );
    return id;
  }).catch((error) => {
    throw traducirError(error, datos.nombre);
  });

  const [ciclo] = await modelo.listarCiclos(idCiclo);
  return {
    ciclo,
    total_asignaciones: asignaciones.length,
    omitidos: resultado.omitidos,
    advertencias: resultado.advertencias,
  };
}

function listar() {
  return modelo.listarCiclos();
}

async function obtener(idCiclo) {
  const [ciclo] = UUID_RE.test(idCiclo) ? await modelo.listarCiclos(idCiclo.toLowerCase()) : [];
  if (!ciclo) throw new ErrorApp(404, "Ciclo de evaluación no encontrado");

  const filas = await modelo.listarAsignaciones(ciclo.id_ciclo);
  return {
    ...ciclo,
    asignaciones: filas.map((fila) => ({
      id_evaluacion: fila.id_evaluacion,
      evaluado: {
        id_empleado: fila.id_empleado_evaluado,
        nombre_completo: nombreCompleto({ nombres: fila.evaluado_nombres, apellidos: fila.evaluado_apellidos }),
      },
      evaluador: {
        id_empleado: fila.id_empleado_evaluador,
        nombre_completo: nombreCompleto({ nombres: fila.evaluador_nombres, apellidos: fila.evaluador_apellidos }),
      },
      area: fila.area,
      sucursal: fila.sucursal,
      estado_codigo: fila.estado_codigo,
      estado_nombre: fila.estado_nombre,
      recordatorio_enviado_en: fila.recordatorio_enviado_en,
      enviada_en: fila.enviada_en,
    })),
  };
}

module.exports = { opciones, vistaPrevia, crear, listar, obtener };

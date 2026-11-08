const modelo = require("../models/plantillasModel");
const empleados = require("./empleadosService");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { validarId, validarCabecera, validarFiltros } = require("../utils/plantillas");

const CODIGO_EXCLUSION = "23P01";

const noEncontrada = () => new ErrorApp(404, "La plantilla de evaluación no existe.");

const describirPlantilla = (fila) => ({
  id_plantilla: fila.id_plantilla,
  nombre: fila.nombre,
  objetivo: fila.objetivo,
  area: { id_departamento: fila.id_departamento, nombre: fila.departamento },
  vigencia_desde: fila.vigencia_desde,
  vigencia_hasta: fila.vigencia_hasta,
  creador: { id_empleado: fila.id_creador, nombre_completo: fila.creador },
  estado_codigo: fila.estado_codigo,
  estado_nombre: fila.estado_nombre,
  version_actual: { id_version: fila.id_version, numero_version: fila.numero_version },
  secciones_total: fila.secciones_total,
  fue_publicada: fila.fue_publicada,
  creado_en: fila.creado_en,
  actualizado_en: fila.actualizado_en,
});

const alertaDeDuplicidad = (duplicada) =>
  new ErrorApp(
    409,
    "Ya existe una plantilla con ese nombre para el área y el periodo indicados.",
    [
      {
        campo: "nombre",
        mensaje: duplicada
          ? `"${duplicada.nombre}" ya está vigente del ${duplicada.vigencia_desde} al ${duplicada.vigencia_hasta} en esta área.`
          : "Use otro nombre o una vigencia que no se cruce con la de la plantilla existente.",
      },
    ],
  );

// La base es la que garantiza la unicidad; aquí el choque se convierte en la alerta de duplicidad.
async function conAlertaDeDuplicidad(trabajo) {
  try {
    return await trabajo();
  } catch (error) {
    if (error.code === CODIGO_EXCLUSION) throw alertaDeDuplicidad(null);
    throw error;
  }
}

async function validarArea(idDepartamento) {
  const departamento = await empleados.obtenerDepartamento(idDepartamento);
  if (!departamento)
    throw new ErrorApp(422, "Datos inválidos", [
      { campo: "id_departamento", mensaje: "El área destino no existe o está dada de baja." },
    ]);
  return departamento;
}

async function listar(consulta) {
  const filas = await modelo.listar(validarFiltros(consulta));
  return filas.map(describirPlantilla);
}

async function obtener(idPlantilla) {
  const id = validarId(idPlantilla);
  const fila = await modelo.obtener(id);
  if (!fila) throw noEncontrada();
  return { ...describirPlantilla(fila), versiones: await modelo.listarVersiones(id) };
}

async function crear(idEmpleado, cuerpo) {
  const datos = validarCabecera(cuerpo);
  const departamento = await validarArea(datos.idDepartamento);
  const creador = await empleados.obtenerEmpleado(idEmpleado);
  if (!creador) throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");

  const idPlantilla = await conAlertaDeDuplicidad(() =>
    enTransaccion(async (db) => {
      const duplicada = await modelo.buscarDuplicada(datos, db);
      if (duplicada) throw alertaDeDuplicidad(duplicada);
      await modelo.asegurarDepartamento(departamento, db);
      await modelo.asegurarEmpleado(creador, db);
      return modelo.crear({ ...datos, idCreador: creador.id_empleado }, db);
    }),
  );
  return obtener(idPlantilla);
}

async function actualizar(idPlantilla, cuerpo) {
  const id = validarId(idPlantilla);
  const datos = validarCabecera(cuerpo);

  const actual = await modelo.obtener(id);
  if (!actual) throw noEncontrada();
  const departamento = await validarArea(datos.idDepartamento);

  await conAlertaDeDuplicidad(() =>
    enTransaccion(async (db) => {
      const bloqueada = await modelo.obtener(id, { bloquear: true }, db);
      if (!bloqueada) throw noEncontrada();
      if (bloqueada.fue_publicada)
        throw new ErrorApp(
          409,
          "La plantilla ya fue publicada: sus datos base no se pueden modificar. Cree una nueva versión para cambiar su estructura.",
        );
      const duplicada = await modelo.buscarDuplicada({ ...datos, excepto: id }, db);
      if (duplicada) throw alertaDeDuplicidad(duplicada);
      await modelo.asegurarDepartamento(departamento, db);
      await modelo.actualizar(id, datos, db);
    }),
  );
  return obtener(id);
}

async function eliminar(idPlantilla) {
  const id = validarId(idPlantilla);
  await enTransaccion(async (db) => {
    const fila = await modelo.obtener(id, { bloquear: true }, db);
    if (!fila) throw noEncontrada();
    if (fila.fue_publicada)
      throw new ErrorApp(409, "La plantilla ya fue publicada y no se puede eliminar.");
    await modelo.eliminar(id, db);
  });
  return { mensaje: "Plantilla eliminada correctamente." };
}

module.exports = { listar, obtener, crear, actualizar, eliminar };

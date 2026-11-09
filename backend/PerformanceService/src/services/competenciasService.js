const modelo = require("../models/competenciasModel");
const { ErrorApp } = require("../utils/errores");
const { validarCompetencia, validarFiltros } = require("../utils/competencias");

const CODIGO_UNICO_REPETIDO = "23505";

const describirCompetencia = (fila) => ({
  id_competencia: fila.id_competencia,
  nombre: fila.nombre,
  descripcion: fila.descripcion,
  tipo_codigo: fila.tipo_codigo,
  tipo_nombre: fila.tipo_nombre,
  esta_activa: fila.esta_activa,
});

const nombreRepetido = () =>
  new ErrorApp(409, "Ya existe una competencia o factor con ese nombre.", [
    { campo: "nombre", mensaje: "Ya existe una competencia o factor con ese nombre." },
  ]);

async function listar(consulta) {
  const filas = await modelo.listar(validarFiltros(consulta));
  return filas.map(describirCompetencia);
}

async function crear(cuerpo) {
  const datos = validarCompetencia(cuerpo);
  if (await modelo.buscarPorNombre(datos.nombre)) throw nombreRepetido();
  let idCompetencia;
  try {
    idCompetencia = await modelo.crear(datos);
  } catch (error) {
    if (error.code === CODIGO_UNICO_REPETIDO) throw nombreRepetido();
    throw error;
  }
  return describirCompetencia(await modelo.obtener(idCompetencia));
}

module.exports = { listar, crear };

const modelo = require("../models/marcajes.model");
const empleados = require("./empleados.service");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const {
  TIPO_MARCAJE,
  ORIGEN_MARCAJE,
  esEntrada,
  verificarEmpleadoActivo,
  entradaDuplicada,
} = require("../utils/marcajes");

async function verificarEmpleado(idEmpleado) {
  const empleado = UUID_RE.test(idEmpleado) ? await empleados.obtener(idEmpleado) : null;
  return verificarEmpleadoActivo(empleado);
}

const buscarEntradaDeHoy = async (idEmpleado) => (await modelo.listarDeHoy(idEmpleado)).find(esEntrada);

async function consultarJornada(idEmpleado) {
  const { nombres, apellidos } = await verificarEmpleado(idEmpleado);
  const [fecha_jornada, entrada] = await Promise.all([
    modelo.fechaJornadaActual(),
    buscarEntradaDeHoy(idEmpleado),
  ]);
  return {
    fecha_jornada,
    empleado: { id_empleado: idEmpleado, nombres, apellidos },
    entrada: entrada ?? null,
  };
}

async function registrarEntrada(idEmpleado, { idOrigen = ORIGEN_MARCAJE.PORTAL, codigoDispositivo } = {}) {
  await verificarEmpleado(idEmpleado);
  const existente = await buscarEntradaDeHoy(idEmpleado);
  if (existente) throw entradaDuplicada(existente);

  try {
    return await modelo.registrar({ idEmpleado, idTipo: TIPO_MARCAJE.ENTRADA, idOrigen, codigoDispositivo });
  } catch (error) {
    if (error.code !== "23505") throw error;
    throw entradaDuplicada(await buscarEntradaDeHoy(idEmpleado));
  }
}

async function registrarEntradaBiometrica({ id_empleado } = {}, codigoDispositivo) {
  if (typeof id_empleado !== "string" || !id_empleado.trim()) {
    throw new ErrorApp(400, "Datos de marcaje inválidos", [
      { campo: "id_empleado", mensaje: "Envíe el identificador del empleado reconocido." },
    ]);
  }
  return registrarEntrada(id_empleado.trim().toLowerCase(), {
    idOrigen: ORIGEN_MARCAJE.BIOMETRICO,
    codigoDispositivo,
  });
}

module.exports = { consultarJornada, registrarEntrada, registrarEntradaBiometrica };

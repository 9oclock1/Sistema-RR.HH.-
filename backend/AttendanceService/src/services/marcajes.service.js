const modelo = require("../models/marcajes.model");
const empleados = require("./empleados.service");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { minutosTrabajados } = require("../utils/jornada");
const {
  TIPO_MARCAJE,
  ORIGEN_MARCAJE,
  jornadaEnCurso,
  salidaRegistrada,
  verificarEmpleadoActivo,
  entradaDuplicada,
  salidaDuplicada,
  sinEntrada,
} = require("../utils/marcajes");

async function verificarEmpleado(idEmpleado) {
  const empleado = UUID_RE.test(idEmpleado) ? await empleados.obtener(idEmpleado) : null;
  return verificarEmpleadoActivo(empleado);
}

async function leerJornada(idEmpleado) {
  const { ahora, hoy } = await modelo.momentoActual();
  const marcajes = await modelo.listarRecientes(idEmpleado, hoy);
  return { ahora, marcajes, jornada: jornadaEnCurso(marcajes, { hoy, ahora }) };
}

const resumir = ({ fecha_jornada, entrada, salida }) => ({
  fecha_jornada,
  entrada,
  salida,
  minutos_trabajados: minutosTrabajados(entrada, salida),
});

async function consultarJornada(idEmpleado) {
  const { nombres, apellidos } = await verificarEmpleado(idEmpleado);
  const { jornada } = await leerJornada(idEmpleado);
  return { ...resumir(jornada), empleado: { id_empleado: idEmpleado, nombres, apellidos } };
}

async function registrarEntrada(idEmpleado, { idOrigen = ORIGEN_MARCAJE.PORTAL, codigoDispositivo } = {}) {
  await verificarEmpleado(idEmpleado);
  const { jornada } = await leerJornada(idEmpleado);
  if (jornada.entrada) throw entradaDuplicada(jornada.entrada);

  try {
    return await modelo.registrar({ idEmpleado, idTipo: TIPO_MARCAJE.ENTRADA, idOrigen, codigoDispositivo });
  } catch (error) {
    if (error.code !== "23505") throw error;
    throw entradaDuplicada((await leerJornada(idEmpleado)).jornada.entrada);
  }
}

async function registrarSalida(idEmpleado, { idOrigen = ORIGEN_MARCAJE.PORTAL, codigoDispositivo } = {}) {
  await verificarEmpleado(idEmpleado);
  const { ahora, marcajes, jornada } = await leerJornada(idEmpleado);
  const previa = salidaRegistrada(jornada, marcajes, ahora);
  if (previa) throw salidaDuplicada(previa);
  if (!jornada.entrada) throw sinEntrada();

  try {
    const salida = await modelo.registrar({
      idEmpleado,
      idTipo: TIPO_MARCAJE.SALIDA,
      idOrigen,
      codigoDispositivo,
      fechaJornada: jornada.fecha_jornada,
    });
    return resumir({ ...jornada, salida });
  } catch (error) {
    if (error.code !== "23505") throw error;
    const actual = await leerJornada(idEmpleado);
    throw salidaDuplicada(salidaRegistrada(actual.jornada, actual.marcajes, actual.ahora));
  }
}

function leerEmpleadoReconocido({ id_empleado } = {}) {
  if (typeof id_empleado !== "string" || !id_empleado.trim()) {
    throw new ErrorApp(400, "Datos de marcaje inválidos", [
      { campo: "id_empleado", mensaje: "Envíe el identificador del empleado reconocido." },
    ]);
  }
  return id_empleado.trim().toLowerCase();
}

const registrarEntradaBiometrica = async (cuerpo, codigoDispositivo) =>
  registrarEntrada(leerEmpleadoReconocido(cuerpo), { idOrigen: ORIGEN_MARCAJE.BIOMETRICO, codigoDispositivo });

const registrarSalidaBiometrica = async (cuerpo, codigoDispositivo) =>
  registrarSalida(leerEmpleadoReconocido(cuerpo), { idOrigen: ORIGEN_MARCAJE.BIOMETRICO, codigoDispositivo });

module.exports = {
  consultarJornada,
  registrarEntrada,
  registrarSalida,
  registrarEntradaBiometrica,
  registrarSalidaBiometrica,
};

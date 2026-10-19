const modelo = require("../models/marcajes.model");
const programacion = require("../models/novedades.model");
const empleados = require("./empleados.service");
const novedades = require("./novedades.service");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { minutosTrabajados } = require("../utils/jornada");
const { sumarDias } = require("../utils/periodos");
const {
  TIPO_MARCAJE,
  ORIGEN_MARCAJE,
  ESTADO_MARCAJE,
  jornadaDe,
  jornadaEnCurso,
  fechaJornadaEntrada,
  salidaRegistrada,
  verificarEmpleadoActivo,
  entradaDuplicada,
  salidaDuplicada,
  jornadaCerrada,
  describirInconsistencia,
} = require("../utils/marcajes");

async function verificarEmpleado(idEmpleado) {
  const empleado = UUID_RE.test(idEmpleado) ? await empleados.obtener(idEmpleado) : null;
  return verificarEmpleadoActivo(empleado);
}

async function leerJornada(idEmpleado) {
  const { ahora, hoy } = await modelo.momentoActual();
  const marcajes = await modelo.listarRecientes(idEmpleado, hoy);
  return { ahora, hoy, marcajes, jornada: jornadaEnCurso(marcajes, { hoy, ahora }) };
}

// Jornada en la que se guarda una entrada: la del turno programado que la contiene o, sin turno, la jornada en curso.
async function jornadaParaEntrada(idEmpleado, { ahora, hoy, marcajes, jornada }) {
  const turnos = await programacion.listarProgramacion(sumarDias(hoy, -1), sumarDias(hoy, 1), [idEmpleado]);
  const fecha = fechaJornadaEntrada(turnos, marcajes, { hoy, ahoraMs: ahora.getTime() });
  return fecha ? jornadaDe(marcajes, fecha) : jornada;
}

const resumir = ({ fecha_jornada, entrada, salida }) => ({
  fecha_jornada,
  entrada,
  salida,
  minutos_trabajados: minutosTrabajados(entrada, salida),
  inconsistencia: describirInconsistencia(salida),
});

// Atraso y salida anticipada de los marcajes de la jornada. Si el cálculo falla, el marcaje sigue siendo válido:
// el contraste programado registra las novedades después.
async function novedadesDeLaJornada(idEmpleado, { entrada, salida }) {
  try {
    const lista = await novedades.alMarcar(idEmpleado, [entrada?.id_marcaje, salida?.id_marcaje]);
    const deTipo = (codigo) => lista.find((n) => n.tipo.codigo === codigo) ?? null;
    return { atraso: deTipo("ATRASO"), salida_anticipada: deTipo("SALIDA_ANTICIPADA") };
  } catch (error) {
    console.error("No se pudieron calcular las novedades del marcaje:", error.message);
    return { atraso: null, salida_anticipada: null };
  }
}

async function consultarJornada(idEmpleado) {
  const { nombres, apellidos } = await verificarEmpleado(idEmpleado);
  const { jornada } = await leerJornada(idEmpleado);
  return {
    ...resumir(jornada),
    ...(await novedadesDeLaJornada(idEmpleado, jornada)),
    empleado: { id_empleado: idEmpleado, nombres, apellidos },
  };
}

async function registrarEntrada(idEmpleado, { idOrigen = ORIGEN_MARCAJE.PORTAL, codigoDispositivo } = {}) {
  await verificarEmpleado(idEmpleado);
  const jornada = await jornadaParaEntrada(idEmpleado, await leerJornada(idEmpleado));
  if (jornada.entrada) throw entradaDuplicada(jornada.entrada);
  if (jornada.salida) throw jornadaCerrada(jornada.salida);

  let entrada;
  try {
    entrada = await modelo.registrar({
      idEmpleado,
      idTipo: TIPO_MARCAJE.ENTRADA,
      idOrigen,
      idEstado: ESTADO_MARCAJE.REGISTRADO,
      codigoDispositivo,
      fechaJornada: jornada.fecha_jornada,
    });
  } catch (error) {
    if (error.code !== "23505") throw error;
    throw entradaDuplicada(jornadaDe((await leerJornada(idEmpleado)).marcajes, jornada.fecha_jornada).entrada);
  }
  const { atraso } = await novedadesDeLaJornada(idEmpleado, { entrada });
  return { ...entrada, atraso };
}

async function registrarSalida(idEmpleado, { idOrigen = ORIGEN_MARCAJE.PORTAL, codigoDispositivo } = {}) {
  await verificarEmpleado(idEmpleado);
  const { ahora, marcajes, jornada } = await leerJornada(idEmpleado);
  const previa = salidaRegistrada(jornada, marcajes, ahora);
  if (previa) throw salidaDuplicada(previa);

  try {
    const salida = await modelo.registrar({
      idEmpleado,
      idTipo: TIPO_MARCAJE.SALIDA,
      idOrigen,
      // Sin entrada en la jornada, la salida se guarda igual para dejar constancia, pendiente de justificación.
      idEstado: jornada.entrada ? ESTADO_MARCAJE.REGISTRADO : ESTADO_MARCAJE.PENDIENTE_JUSTIFICACION,
      codigoDispositivo,
      fechaJornada: jornada.fecha_jornada,
    });
    const cerrada = { ...jornada, salida };
    return { ...resumir(cerrada), ...(await novedadesDeLaJornada(idEmpleado, cerrada)) };
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

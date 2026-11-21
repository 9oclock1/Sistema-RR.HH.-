const desvinculacionesModel = require("../models/desvinculacionesModel");
const modelo = require("../models/promedioIndemnizableModel");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { validarAdmin, identidadRegistro, ESTADOS_ABIERTOS } = require("../utils/desvinculaciones");
const { MESES_PROMEDIO, periodoLimite, calcularPromedio } = require("../utils/promedioIndemnizable");

const noEncontrado = () => new ErrorApp(404, "Proceso de desvinculación no encontrado.");
const procesoNoAbierto = () =>
  new ErrorApp(
    409,
    "Solo se puede calcular el sueldo promedio de un proceso de liquidación abierto (iniciado o en curso).",
    undefined,
    "PROCESO_NO_ABIERTO"
  );

// AC1, AC2: calcula el sueldo promedio indemnizable con las últimas 3 planillas cerradas hasta el mes del retiro.
async function calcular(idProceso, identidad) {
  validarAdmin(identidad);
  if (!UUID_RE.test(idProceso ?? "")) throw noEncontrado();

  const idNormalizado = idProceso.toLowerCase();
  const proceso = await desvinculacionesModel.obtenerProceso(idNormalizado);
  if (!proceso) throw noEncontrado();
  if (!ESTADOS_ABIERTOS.includes(proceso.estado)) throw procesoNoAbierto();

  const limite = periodoLimite(proceso.fecha_retiro);
  const planillas = await modelo.listarUltimasPlanillasCerradas(proceso.id_empleado, limite, MESES_PROMEDIO);
  const resultado = calcularPromedio(planillas, limite);

  const registro = identidadRegistro(identidad);
  const calculadoPor = {
    calculado_por: registro.registrado_por,
    calculado_por_rol: registro.registrado_por_rol,
  };

  return enTransaccion(async (cliente) => {
    const bloqueado = await modelo.bloquearProceso(cliente, idNormalizado);
    if (!bloqueado || !ESTADOS_ABIERTOS.includes(bloqueado.estado)) {
      throw procesoNoAbierto();
    }

    await modelo.guardarPromedio(cliente, idNormalizado, resultado, calculadoPor);
    if (bloqueado.estado === "INICIADO") {
      await modelo.marcarEnCurso(cliente, idNormalizado);
    }

    return modelo.obtenerDesglose(idNormalizado, cliente);
  });
}

module.exports = { calcular };

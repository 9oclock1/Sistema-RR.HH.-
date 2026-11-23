const desvinculacionesModel = require("../models/desvinculacionesModel");
const promedioModelo = require("../models/promedioIndemnizableModel");
const modelo = require("../models/saldosProporcionalesModel");
const promedioServicio = require("./promedioIndemnizableService");
const externos = require("./externos.service");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { validarAdmin, validarConsulta, identidadRegistro, ESTADOS_ABIERTOS } = require("../utils/desvinculaciones");
const { calcularSaldos, gestionDe } = require("../utils/saldosProporcionales");

const noEncontrado = () => new ErrorApp(404, "Proceso de desvinculación no encontrado.");
const procesoNoAbierto = () =>
  new ErrorApp(
    409,
    "Solo se pueden calcular los saldos proporcionales de un proceso de liquidación abierto (iniciado o en curso).",
    undefined,
    "PROCESO_NO_ABIERTO"
  );

async function procesoDe(idProceso) {
  if (!UUID_RE.test(idProceso ?? "")) throw noEncontrado();
  const id = idProceso.toLowerCase();
  const proceso = await desvinculacionesModel.obtenerProceso(id);
  if (!proceso) throw noEncontrado();
  return { id, proceso };
}

// El sueldo promedio indemnizable del proceso (RF-55). Si todavía no se calculó, se calcula primero con su
// propia regla (y queda guardado como siempre): los saldos se valorizan con ese mismo promedio.
async function promedioDelProceso(id, identidad) {
  const guardado = await promedioModelo.obtenerDesglose(id);
  if (guardado) return Number(guardado.promedio);
  const calculado = await promedioServicio.calcular(id, identidad);
  return Number(calculado.promedio);
}

// KAN-77, criterios 1 a 3: duodécimas de aguinaldo y vacaciones truncas del proceso de liquidación.
async function calcular(idProceso, identidad) {
  validarAdmin(identidad);
  const { id, proceso } = await procesoDe(idProceso);
  if (!ESTADOS_ABIERTOS.includes(proceso.estado)) throw procesoNoAbierto();

  const promedio = await promedioDelProceso(id, identidad);
  const saldoVacaciones = await externos.saldoVacaciones(proceso.id_empleado, proceso.fecha_retiro);
  const fechaIngreso = saldoVacaciones.fecha_ingreso || proceso.fecha_ingreso;
  if (!fechaIngreso) {
    throw new ErrorApp(409, "El colaborador no tiene fecha de ingreso registrada: no se pueden calcular sus saldos.");
  }
  const liquidado = await modelo.aguinaldoLiquidado(proceso.id_empleado, gestionDe(proceso.fecha_retiro));
  const resultado = calcularSaldos({
    promedio,
    fechaIngreso,
    fechaRetiro: proceso.fecha_retiro,
    saldoVacaciones,
    aguinaldoLiquidado: liquidado ? { monto: Number(liquidado.monto) } : null,
  });

  const { registrado_por: calculadoPor } = identidadRegistro(identidad);
  return enTransaccion(async (cliente) => {
    const bloqueado = await promedioModelo.bloquearProceso(cliente, id);
    if (!bloqueado || !ESTADOS_ABIERTOS.includes(bloqueado.estado)) throw procesoNoAbierto();
    await modelo.guardar(cliente, id, resultado, calculadoPor);
    if (bloqueado.estado === "INICIADO") await promedioModelo.marcarEnCurso(cliente, id);
    return modelo.obtener(id, cliente);
  });
}

// El Contador consulta el cálculo en solo lectura; calcular y recalcular son del Administrador de RRHH.
async function obtener(idProceso, identidad) {
  validarConsulta(identidad);
  const { id } = await procesoDe(idProceso);
  const saldos = await modelo.obtener(id);
  if (!saldos) {
    throw new ErrorApp(404, "Aún no se calcularon los saldos proporcionales de este proceso.", undefined, "SALDOS_NO_CALCULADOS");
  }
  return saldos;
}

module.exports = { calcular, obtener };

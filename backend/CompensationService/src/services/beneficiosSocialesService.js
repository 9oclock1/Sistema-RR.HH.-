const desvinculacionesModel = require("../models/desvinculacionesModel");
const modelo = require("../models/beneficiosSocialesModel");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { validarConsulta, identidadRegistro, ESTADOS_ABIERTOS } = require("../utils/desvinculaciones");
const { calcularBeneficios } = require("../utils/beneficiosSociales");

// RF-56: calculan el Administrador de RRHH y el Contador / Encargado de planillas.
const ROLES_CALCULO = ["admin", "contador"];

const noEncontrado = () => new ErrorApp(404, "Proceso de desvinculación no encontrado.");
const procesoNoAbierto = () =>
  new ErrorApp(
    409,
    "Solo se pueden calcular los beneficios sociales de un proceso de liquidación abierto (iniciado o en curso).",
    undefined,
    "PROCESO_NO_ABIERTO"
  );

function validarCalculo({ rol } = {}) {
  const normalizado = (rol ?? "").trim().toLowerCase();
  if (!ROLES_CALCULO.includes(normalizado)) {
    throw new ErrorApp(403, "Solo el Administrador de RRHH o el Contador pueden calcular los beneficios sociales.");
  }
}

async function calcular(idProceso, identidad) {
  validarCalculo(identidad);
  if (!UUID_RE.test(idProceso ?? "")) throw noEncontrado();
  const id = idProceso.toLowerCase();

  const registro = identidadRegistro(identidad);
  const calculadoPor = {
    calculado_por: registro.registrado_por,
    calculado_por_rol: registro.registrado_por_rol,
  };

  return enTransaccion(async (cliente) => {
    const proceso = await modelo.bloquearProceso(cliente, id);
    if (!proceso) throw noEncontrado();
    if (!ESTADOS_ABIERTOS.includes(proceso.estado)) throw procesoNoAbierto();
    if (proceso.promedio === null || proceso.promedio === undefined) {
      throw new ErrorApp(
        409,
        "Primero calcule el sueldo promedio indemnizable del proceso: es la base de la indemnización y del desahucio.",
        undefined,
        "PROMEDIO_NO_CALCULADO"
      );
    }

    const resultado = calcularBeneficios(proceso, proceso.promedio);
    await modelo.guardar(cliente, id, resultado, calculadoPor);
    if (proceso.estado === "INICIADO") await modelo.marcarEnCurso(cliente, id);

    return modelo.obtenerDesglose(id, cliente);
  });
}

async function obtener(idProceso, identidad) {
  validarConsulta(identidad);
  if (!UUID_RE.test(idProceso ?? "")) throw noEncontrado();
  const id = idProceso.toLowerCase();

  const proceso = await desvinculacionesModel.obtenerProceso(id);
  if (!proceso) throw noEncontrado();

  const desglose = await modelo.obtenerDesglose(id);
  if (!desglose) {
    throw new ErrorApp(
      404,
      "Aún no se calcularon los beneficios sociales de este proceso.",
      undefined,
      "BENEFICIOS_NO_CALCULADOS"
    );
  }
  return desglose;
}

module.exports = { calcular, obtener };

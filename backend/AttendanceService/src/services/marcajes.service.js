const modelo = require("../models/marcajes.model");
const empleados = require("./empleados.service");
const { UUID_RE } = require("../utils/formatos");
const { TIPO_MARCAJE, ORIGEN_MARCAJE, verificarEmpleadoActivo } = require("../utils/marcajes");

async function verificarEmpleado(idEmpleado) {
  const empleado = UUID_RE.test(idEmpleado) ? await empleados.obtener(idEmpleado) : null;
  return verificarEmpleadoActivo(empleado);
}

async function consultarJornada(idEmpleado) {
  const { nombres, apellidos } = await verificarEmpleado(idEmpleado);
  const [fecha_jornada, marcajes] = await Promise.all([
    modelo.fechaJornadaActual(),
    modelo.listarDeHoy(idEmpleado),
  ]);
  return {
    fecha_jornada,
    empleado: { id_empleado: idEmpleado, nombres, apellidos },
    entrada: marcajes.find((marcaje) => marcaje.tipo_codigo === "ENTRADA") ?? null,
  };
}

async function registrarEntrada(idEmpleado) {
  await verificarEmpleado(idEmpleado);
  return modelo.registrar({ idEmpleado, idTipo: TIPO_MARCAJE.ENTRADA, idOrigen: ORIGEN_MARCAJE.PORTAL });
}

module.exports = { consultarJornada, registrarEntrada };

const { ErrorApp } = require("../utils/errores");
const { EMPLEADOS, DEPARTAMENTOS, SUCURSALES } = require("../config/datosSimulados");
const { ALCANCE } = require("../config/catalogos");

const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const TIEMPO_ESPERA_MS = 3000;

async function obtenerEmpleado(idEmpleado) {
  if (!idEmpleado) return null;

  if (process.env.EMPLEADOS_SIMULADOS === "true") {
    return EMPLEADOS.find((emp) => emp.id_empleado === idEmpleado) ?? null;
  }

  try {
    const respuesta = await fetch(`${URL_EMPLEADOS}/empleados/${idEmpleado}`, {
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (respuesta.status === 404) return null;
    if (respuesta.ok) return await respuesta.json();
  } catch {
    // Si EmployeeService no está disponible, usar datos simulados como fallback resiliente
  }

  return EMPLEADOS.find((emp) => emp.id_empleado === idEmpleado) ?? null;
}

async function verificarEmpleadoActivo(idEmpleado) {
  const empleado = await obtenerEmpleado(idEmpleado);

  if (!empleado) {
    throw new ErrorApp(404, "El empleado seleccionado no existe en los registros de la empresa.", [
      { campo: "id_empleado_destinatario", mensaje: "Empleado no encontrado." },
    ]);
  }

  // Criterio de aceptación 4 de RF-64:
  // "Dado que el destinatario no es un empleado activo, al intentar enviar el mensaje, el sistema lo rechaza e indica el motivo."
  if (!empleado.activo) {
    throw new ErrorApp(
      422,
      `No se puede enviar el mensaje: el destinatario «${empleado.nombres} ${empleado.apellidos}» no es un empleado activo.`,
      [{ campo: "id_empleado_destinatario", mensaje: "El empleado no se encuentra activo." }]
    );
  }

  return empleado;
}

async function listarTodosEmpleados() {
  if (process.env.EMPLEADOS_SIMULADOS === "true") {
    return EMPLEADOS;
  }

  try {
    const respuesta = await fetch(`${URL_EMPLEADOS}/empleados`, {
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (respuesta.ok) return await respuesta.json();
  } catch {
    // Fallback
  }

  return EMPLEADOS;
}

async function obtenerDestinatariosGrupo({ alcanceCodigo, idDepartamento, idSucursal }) {
  const todos = await listarTodosEmpleados();
  const activos = todos.filter((emp) => emp.activo);

  if (alcanceCodigo === ALCANCE.GENERAL) {
    return activos;
  }

  if (alcanceCodigo === ALCANCE.DEPARTAMENTO) {
    if (!idDepartamento) {
      throw new ErrorApp(400, "Debe especificar el departamento de destino.", [
        { campo: "id_departamento_destino", mensaje: "Seleccione un departamento válido." },
      ]);
    }
    return activos.filter((emp) => emp.id_departamento === idDepartamento);
  }

  if (alcanceCodigo === ALCANCE.SUCURSAL) {
    if (!idSucursal) {
      throw new ErrorApp(400, "Debe especificar la sucursal de destino.", [
        { campo: "id_sucursal_destino", mensaje: "Seleccione una sucursal válida." },
      ]);
    }
    return activos.filter((emp) => emp.id_sucursal === idSucursal);
  }

  return [];
}

async function listarDestinatariosDisponibles() {
  const empleados = await listarTodosEmpleados();
  return {
    empleados: empleados.map((e) => ({
      id_empleado: e.id_empleado,
      nombres: e.nombres,
      apellidos: e.apellidos,
      nombre_completo: `${e.nombres} ${e.apellidos}`,
      cargo: e.cargo,
      id_departamento: e.id_departamento,
      id_sucursal: e.id_sucursal,
      activo: Boolean(e.activo),
    })),
    departamentos: DEPARTAMENTOS,
    sucursales: SUCURSALES,
  };
}

module.exports = {
  obtenerEmpleado,
  verificarEmpleadoActivo,
  obtenerDestinatariosGrupo,
  listarDestinatariosDisponibles,
};

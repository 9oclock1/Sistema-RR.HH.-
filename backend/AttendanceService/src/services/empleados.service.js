const { ErrorApp } = require("../utils/errores");
const simulados = require("../config/empleadosSimulados");

const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const TIEMPO_ESPERA_MS = 3000;

const sinConexion = () => new ErrorApp(503, "No se pudo verificar al empleado. Intente nuevamente.");
const sinDatosDePersonal = () =>
  new ErrorApp(503, "No se pudieron obtener los datos del personal. Intente nuevamente.");

const usarSimulados = () => process.env.EMPLEADOS_SIMULADOS === "true";

async function consultar(ruta, error) {
  let respuesta;
  try {
    respuesta = await fetch(`${URL_EMPLEADOS}${ruta}`, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
  } catch {
    throw error();
  }
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw error();
  return respuesta.json().catch(() => {
    throw error();
  });
}

async function obtener(idEmpleado) {
  if (usarSimulados()) {
    return simulados.find((empleado) => empleado.id_empleado === idEmpleado) ?? null;
  }
  return consultar(`/empleados/${idEmpleado}`, sinConexion);
}

const nombreSimulado = ({ nombres, apellidos }) => `${nombres} ${apellidos}`;

// Datos del personal que devuelve GET /empleados; id_cargo, sucursal y área sirven para filtrar los reportes (RF-29).
const resumirPersonal = ({ id_empleado, nombre_completo, cargo, area, activo, id_cargo, id_sucursal, sucursal, id_departamento }) => ({
  id_empleado,
  nombre_completo,
  cargo,
  area,
  activo: activo === true,
  id_cargo: id_cargo ?? null,
  id_sucursal: id_sucursal ?? null,
  sucursal: sucursal ?? null,
  id_departamento: id_departamento ?? null,
});

// Personal actual de una sucursal (y de un área, si se indica): [{ id_empleado, nombre_completo, cargo, activo }].
async function listarPorArea(idSucursal, idDepartamento = null) {
  if (usarSimulados()) {
    return simulados.map((empleado) => ({
      id_empleado: empleado.id_empleado,
      nombre_completo: nombreSimulado(empleado),
      cargo: "Personal simulado",
      area: "Área simulada",
      activo: empleado.activo,
    }));
  }
  const parametros = new URLSearchParams({ id_sucursal: idSucursal });
  if (idDepartamento) parametros.set("id_departamento", idDepartamento);
  const lista = await consultar(`/empleados?${parametros}`, sinDatosDePersonal);
  if (!Array.isArray(lista)) throw sinDatosDePersonal();
  return lista.map(resumirPersonal);
}

// Empleados que pueden trabajar (con acceso habilitado), de todas las sucursales.
async function listarIdsActivos() {
  if (usarSimulados()) return new Set(simulados.filter((e) => e.activo).map((e) => e.id_empleado));
  const lista = await consultar("/empleados", sinDatosDePersonal);
  if (!Array.isArray(lista)) throw sinDatosDePersonal();
  return new Set(lista.filter((e) => e.activo === true).map((e) => e.id_empleado));
}

// Todo el personal, de todas las sucursales: [{ id_empleado, nombre_completo, cargo, area, activo }].
async function listarPersonal() {
  if (usarSimulados()) return listarPorArea(null);
  const lista = await consultar("/empleados", sinDatosDePersonal);
  if (!Array.isArray(lista)) throw sinDatosDePersonal();
  return lista.map(resumirPersonal);
}

// Nombre de un empleado que ya no está en el área (para mostrar sus celdas).
async function obtenerNombre(idEmpleado) {
  const empleado = await obtener(idEmpleado).catch(() => null);
  if (!empleado) return "Empleado no encontrado";
  return usarSimulados() ? nombreSimulado(empleado) : `${empleado.nombres} ${empleado.apellidos}`.trim();
}

async function obtenerSucursal(idSucursal) {
  if (usarSimulados()) return { id_sucursal: idSucursal, nombre: "Sucursal simulada" };
  const lista = await consultar("/sucursales", sinDatosDePersonal);
  const sucursal = Array.isArray(lista) ? lista.find((s) => s.id_sucursal === idSucursal) : null;
  return sucursal ? { id_sucursal: sucursal.id_sucursal, nombre: sucursal.nombre } : null;
}

async function obtenerArea(idDepartamento) {
  if (usarSimulados()) return { id_departamento: idDepartamento, codigo: "SIM", nombre: "Área simulada" };
  const lista = await consultar("/departamentos", sinDatosDePersonal);
  const area = Array.isArray(lista) ? lista.find((d) => d.id_departamento === idDepartamento) : null;
  return area ? { id_departamento: area.id_departamento, codigo: area.codigo, nombre: area.nombre } : null;
}

// RF-29: cargo y sucursal vigentes de un empleado (de su ficha), para fijar el alcance de un supervisor.
async function obtenerUbicacion(idEmpleado) {
  if (usarSimulados()) {
    const empleado = simulados.find((e) => e.id_empleado === idEmpleado);
    return empleado ? { id_empleado: idEmpleado, nombre_completo: nombreSimulado(empleado), id_cargo: null, id_sucursal: null } : null;
  }
  const ficha = await consultar(`/empleados/${idEmpleado}/ficha`, sinConexion);
  if (!ficha) return null;
  return {
    id_empleado: ficha.id_empleado,
    nombre_completo: ficha.nombre_completo,
    activo: ficha.estado?.codigo === "ACTIVO",
    id_cargo: ficha.asignacion_actual?.cargo?.id_cargo ?? null,
    id_sucursal: ficha.asignacion_actual?.sucursal?.id_sucursal ?? null,
  };
}

// RF-29: cargos cuyo jefe directo es `idCargo` (la dependencia directa del supervisor).
async function listarCargosSubordinados(idCargo) {
  if (usarSimulados() || !idCargo) return [];
  const lista = await consultar(`/jerarquia/cargos/${idCargo}/subordinados`, sinDatosDePersonal);
  return Array.isArray(lista) ? lista.map((c) => c.id_cargo) : [];
}

async function listarSucursales() {
  if (usarSimulados()) return [];
  const lista = await consultar("/sucursales", sinDatosDePersonal);
  return Array.isArray(lista) ? lista.map(({ id_sucursal, nombre }) => ({ id_sucursal, nombre })) : [];
}

async function listarAreas() {
  if (usarSimulados()) return [];
  const lista = await consultar("/departamentos", sinDatosDePersonal);
  return Array.isArray(lista) ? lista.map(({ id_departamento, nombre }) => ({ id_departamento, nombre })) : [];
}

module.exports = {
  obtener,
  listarPorArea,
  listarPersonal,
  listarIdsActivos,
  obtenerNombre,
  obtenerSucursal,
  obtenerArea,
  obtenerUbicacion,
  listarCargosSubordinados,
  listarSucursales,
  listarAreas,
};

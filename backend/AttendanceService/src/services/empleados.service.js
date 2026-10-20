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
  return lista.map(({ id_empleado, nombre_completo, cargo, area, activo }) => ({
    id_empleado,
    nombre_completo,
    cargo,
    area,
    activo: activo === true,
  }));
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
  return lista.map(({ id_empleado, nombre_completo, cargo, area, activo }) => ({
    id_empleado,
    nombre_completo,
    cargo,
    area,
    activo: activo === true,
  }));
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

// Dónde trabaja hoy el empleado, con el código del área (decide a qué módulo del ERP se avisa su ausencia).
// null si el empleado no existe; ErrorApp 503 si no se pudo consultar a EmployeeService.
async function obtenerUbicacion(idEmpleado) {
  if (usarSimulados()) {
    return { id_sucursal: null, id_departamento: null, cargo: "Personal simulado", area: "Área simulada", area_codigo: "SIM", sucursal: "Sucursal simulada" };
  }
  const ficha = await consultar(`/empleados/${idEmpleado}/ficha`, sinDatosDePersonal);
  const actual = ficha?.asignacion_actual;
  if (!actual) return null;
  const area = await obtenerArea(actual.area.id_departamento);
  return {
    id_sucursal: actual.sucursal.id_sucursal,
    id_departamento: actual.area.id_departamento,
    cargo: actual.cargo.nombre,
    area: actual.area.nombre,
    area_codigo: area?.codigo ?? null,
    sucursal: actual.sucursal.nombre,
  };
}

module.exports = { obtener, obtenerUbicacion, listarPorArea, listarPersonal, listarIdsActivos, obtenerNombre, obtenerSucursal, obtenerArea };

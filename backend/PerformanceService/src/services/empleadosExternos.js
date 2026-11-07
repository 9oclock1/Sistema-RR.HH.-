const { ErrorApp } = require("../utils/errores");

const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const TIEMPO_ESPERA_MS = Number(process.env.EMPLOYEE_SERVICE_TIMEOUT_MS) || 3000;

const SIN_RESPUESTA = { estado: "sin_respuesta", nombres: null, apellidos: null };

async function consultarEmpleado(idEmpleado) {
  let respuesta;
  try {
    respuesta = await fetch(`${URL_EMPLEADOS}/empleados/${idEmpleado}`, {
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
  } catch {
    return SIN_RESPUESTA;
  }
  if (respuesta.status === 404) return { estado: "no_existe", nombres: null, apellidos: null };
  if (!respuesta.ok) return SIN_RESPUESTA;
  const datos = await respuesta.json().catch(() => null);
  if (!datos) return SIN_RESPUESTA;
  return { estado: "encontrado", nombres: datos.nombres || null, apellidos: datos.apellidos || null };
}

async function pedirLista(ruta) {
  const respuesta = await fetch(`${URL_EMPLEADOS}${ruta}`, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
  if (!respuesta.ok) throw new Error(`EmployeeService respondió ${respuesta.status} en ${ruta}`);
  const datos = await respuesta.json();
  if (!Array.isArray(datos)) throw new Error(`EmployeeService no devolvió una lista en ${ruta}`);
  return datos;
}

const codigosAreaRrhh = () =>
  (process.env.QUEJAS_AREAS_RRHH || "RRHH")
    .split(",")
    .map((codigo) => codigo.trim().toUpperCase())
    .filter(Boolean);

const minusculas = (valor) => (typeof valor === "string" ? valor.toLowerCase() : null);

async function listarResponsables() {
  let empleados;
  let departamentos;
  let cargos;
  try {
    [empleados, departamentos, cargos] = await Promise.all([
      pedirLista("/empleados"),
      pedirLista("/departamentos"),
      pedirLista("/jerarquia/cargos"),
    ]);
  } catch (error) {
    console.error("No se pudo obtener los responsables desde EmployeeService:", error.name, error.message);
    throw new ErrorApp(503, "No se pudo consultar al personal. Intente nuevamente en unos minutos.");
  }

  const codigos = codigosAreaRrhh();
  const areasRrhh = new Set(
    departamentos
      .filter((area) => codigos.includes(String(area.codigo ?? "").toUpperCase()))
      .map((area) => minusculas(area.id_departamento)),
  );
  const cargosJefe = new Set(cargos.map((cargo) => minusculas(cargo.id_cargo_superior)).filter(Boolean));

  return empleados
    .filter((empleado) => empleado.activo !== false)
    .map((empleado) => {
      const deRrhh = areasRrhh.has(minusculas(empleado.id_departamento));
      const supervisa = cargosJefe.has(minusculas(empleado.id_cargo));
      if (!deRrhh && !supervisa) return null;
      return {
        id_empleado: minusculas(empleado.id_empleado),
        nombre_completo: empleado.nombre_completo,
        cargo: empleado.cargo ?? null,
        area: empleado.area ?? null,
        motivo: deRrhh ? "RRHH" : "SUPERVISOR",
      };
    })
    .filter(Boolean);
}

module.exports = { consultarEmpleado, listarResponsables };

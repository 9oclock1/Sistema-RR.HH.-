const { ErrorApp } = require("../utils/errores");
const { EMPLEADOS, DEPARTAMENTOS, SUCURSALES } = require("../config/datosSimulados");
const { ALCANCE } = require("../config/catalogos");

const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const TIEMPO_ESPERA_MS = 3000;

// Caché en memoria para evitar llamadas redundantes repetidas a EmployeeService
let cacheEmpleados = null;
let cacheDepartamentos = null;
let cacheSucursales = null;
let ultimaActualizacionCache = 0;
const TTL_CACHE_MS = 15000; // 15 segundos

function normalizarEmpleado(emp, ficha = null, resumen = null, deptos = [], sucs = []) {
  if (!emp && !ficha && !resumen) return null;

  const id_empleado = emp?.id_empleado || ficha?.id_empleado || resumen?.id_empleado;

  // Nombres y apellidos
  let nombre_completo =
    ficha?.nombre_completo ||
    emp?.nombre_completo ||
    resumen?.nombre_completo ||
    [emp?.nombres, emp?.apellidos || emp?.primer_apellido, emp?.segundo_apellido].filter(Boolean).join(" ") ||
    "Empleado";

  let nombres =
    ficha?.nombres ||
    resumen?.nombres ||
    emp?.nombres ||
    (nombre_completo ? nombre_completo.trim().split(/\s+/)[0] : "Empleado");

  let apellidos =
    ficha?.primer_apellido
      ? [ficha.primer_apellido, ficha.segundo_apellido].filter(Boolean).join(" ")
      : resumen?.apellidos ||
        emp?.apellidos ||
        (emp?.primer_apellido ? [emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(" ") : null) ||
        (nombre_completo ? nombre_completo.trim().split(/\s+/).slice(1).join(" ") : "");

  // Estado activo: si no viene especificado en KAN-39, los empleados devueltos por el catálogo están activos
  let activo = true;
  if (ficha?.estado) {
    activo = ficha.estado.codigo === "ACTIVO" || ficha.estado.permite_acceso === true;
  } else if (resumen?.activo !== undefined) {
    activo = Boolean(resumen.activo);
  } else if (emp?.activo !== undefined) {
    activo = Boolean(emp.activo);
  } else if (emp?.estado !== undefined) {
    if (typeof emp.estado === "string") {
      activo = emp.estado.toUpperCase() === "ACTIVO";
    } else if (emp.estado?.codigo) {
      activo = emp.estado.codigo.toUpperCase() === "ACTIVO";
    }
  }

  // Cargo
  const cargo =
    ficha?.asignacion_actual?.cargo?.nombre ||
    emp?.cargo ||
    resumen?.cargo ||
    "Funcionario";

  // Departamento
  let id_departamento =
    ficha?.asignacion_actual?.area?.id_departamento ||
    emp?.id_departamento ||
    emp?.departamento?.id_departamento ||
    resumen?.id_departamento ||
    null;

  let nombre_departamento =
    ficha?.asignacion_actual?.area?.nombre ||
    emp?.nombre_departamento ||
    emp?.departamento?.nombre ||
    (typeof emp?.departamento === "string" ? emp.departamento : null) ||
    null;

  // Si no tiene id_departamento pero tiene nombre o código, resolver mediante catálogo
  if (!id_departamento && nombre_departamento && deptos && deptos.length > 0) {
    const lim = nombre_departamento.toLowerCase().trim();
    const deptoEncontrado = deptos.find(
      (d) =>
        d.nombre.toLowerCase().includes(lim) ||
        lim.includes(d.nombre.toLowerCase()) ||
        (d.codigo && d.codigo.toLowerCase() === lim)
    );
    if (deptoEncontrado) {
      id_departamento = deptoEncontrado.id_departamento;
      nombre_departamento = deptoEncontrado.nombre;
    }
  }

  // Sucursal
  let id_sucursal =
    ficha?.asignacion_actual?.sucursal?.id_sucursal ||
    emp?.id_sucursal ||
    emp?.sucursal?.id_sucursal ||
    resumen?.id_sucursal ||
    null;

  let nombre_sucursal =
    ficha?.asignacion_actual?.sucursal?.nombre ||
    emp?.nombre_sucursal ||
    emp?.sucursal?.nombre ||
    (typeof emp?.sucursal === "string" ? emp.sucursal : null) ||
    null;

  if (!id_sucursal && nombre_sucursal && sucs && sucs.length > 0) {
    const limS = nombre_sucursal.toLowerCase().trim();
    const sucEncontrada = sucs.find(
      (s) =>
        s.nombre.toLowerCase().includes(limS) ||
        limS.includes(s.nombre.toLowerCase()) ||
        (s.codigo_sucursal && s.codigo_sucursal.toLowerCase() === limS)
    );
    if (sucEncontrada) {
      id_sucursal = sucEncontrada.id_sucursal;
      nombre_sucursal = sucEncontrada.nombre;
    }
  }

  return {
    id_empleado,
    nombres,
    apellidos,
    nombre_completo,
    cargo,
    id_departamento,
    nombre_departamento,
    id_sucursal,
    nombre_sucursal,
    activo,
  };
}

async function obtenerEmpleado(idEmpleado) {
  if (!idEmpleado) return null;

  if (process.env.EMPLEADOS_SIMULADOS === "true") {
    const simulado = EMPLEADOS.find((emp) => emp.id_empleado === idEmpleado);
    return simulado ? normalizarEmpleado(simulado) : null;
  }

  // 1. Primero verificar si ya está en caché en memoria de empleados listados
  if (cacheEmpleados && cacheEmpleados.length > 0) {
    const enCache = cacheEmpleados.find((e) => e.id_empleado === idEmpleado);
    if (enCache) return enCache;
  }

  // 2. Intentar obtener la ficha completa desde EmployeeService (KAN-39)
  try {
    const resFicha = await fetch(`${URL_EMPLEADOS}/empleados/${idEmpleado}/ficha`, {
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (resFicha.ok) {
      const ficha = await resFicha.json();
      return normalizarEmpleado(null, ficha);
    }
  } catch {
    // Si falla o no existe /ficha, intentar /:id resumen
  }

  // 3. Intentar obtener el resumen desde EmployeeService (GET /empleados/:id)
  try {
    const resResumen = await fetch(`${URL_EMPLEADOS}/empleados/${idEmpleado}`, {
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (resResumen.ok) {
      const resumen = await resResumen.json();
      return normalizarEmpleado(null, null, resumen);
    }
  } catch {
    // Si EmployeeService no responde
  }

  // 4. Si /ficha y /:id fallaron (como ocurre en 'main'), buscar en la lista general GET /empleados
  try {
    const todos = await listarTodosEmpleados();
    const encontrado = todos.find((e) => e.id_empleado === idEmpleado);
    if (encontrado) return encontrado;
  } catch {
    // Error al listar
  }

  return null;
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
      `No se puede enviar el mensaje: el destinatario «${empleado.nombre_completo}» no es un empleado activo.`,
      [{ campo: "id_empleado_destinatario", mensaje: "El empleado no se encuentra activo." }]
    );
  }

  return empleado;
}

async function listarDepartamentos() {
  if (process.env.EMPLEADOS_SIMULADOS === "true") {
    return DEPARTAMENTOS;
  }

  try {
    const respuesta = await fetch(`${URL_EMPLEADOS}/departamentos`, {
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (respuesta.ok) {
      const datos = await respuesta.json();
      if (Array.isArray(datos) && datos.length > 0) {
        return datos.map((d) => ({
          id_departamento: d.id_departamento,
          codigo: d.codigo || "",
          nombre: d.nombre,
          esta_activo: d.esta_activo !== false,
        }));
      }
    }
  } catch {
    // Si EmployeeService está offline
  }

  return [];
}

async function listarSucursales() {
  if (process.env.EMPLEADOS_SIMULADOS === "true") {
    return SUCURSALES;
  }

  try {
    const respuesta = await fetch(`${URL_EMPLEADOS}/sucursales`, {
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (respuesta.ok) {
      const datos = await respuesta.json();
      if (Array.isArray(datos) && datos.length > 0) {
        return datos.map((s) => ({
          id_sucursal: s.id_sucursal,
          codigo_sucursal: s.codigo_sucursal || s.codigo || "",
          nombre: s.nombre,
          ciudad: s.ciudad || "",
          esta_activa: s.esta_activa !== false,
        }));
      }
    }
  } catch {
    // Si EmployeeService está offline
  }

  return [];
}

async function listarTodosEmpleados() {
  const ahora = Date.now();
  if (cacheEmpleados && ahora - ultimaActualizacionCache < TTL_CACHE_MS) {
    return cacheEmpleados;
  }

  if (process.env.EMPLEADOS_SIMULADOS === "true") {
    cacheEmpleados = EMPLEADOS.map((e) => normalizarEmpleado(e));
    ultimaActualizacionCache = ahora;
    return cacheEmpleados;
  }

  try {
    const respuesta = await fetch(`${URL_EMPLEADOS}/empleados`, {
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });

    if (respuesta.ok) {
      const lista = await respuesta.json();
      if (Array.isArray(lista)) {
        const [deptos, sucs] = await Promise.all([listarDepartamentos(), listarSucursales()]);
        // Enriquecer empleados si carecen de activo o id_departamento (compatibilidad Ian KAN-39)
        const promesasEnriquecimiento = lista.map(async (emp) => {
          if (emp.activo !== undefined && emp.id_departamento && emp.nombres) {
            return normalizarEmpleado(emp, null, null, deptos, sucs);
          }
          try {
            const resFicha = await fetch(`${URL_EMPLEADOS}/empleados/${emp.id_empleado}/ficha`, {
              signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
            });
            if (resFicha.ok) {
              const ficha = await resFicha.json();
              return normalizarEmpleado(emp, ficha, null, deptos, sucs);
            }
          } catch {
            // Intentar con /:id resumen
          }

          try {
            const resResumen = await fetch(`${URL_EMPLEADOS}/empleados/${emp.id_empleado}`, {
              signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
            });
            if (resResumen.ok) {
              const resumen = await resResumen.json();
              return normalizarEmpleado(emp, null, resumen, deptos, sucs);
            }
          } catch {
            // Fallback a emp
          }

          return normalizarEmpleado(emp, null, null, deptos, sucs);
        });

        cacheEmpleados = await Promise.all(promesasEnriquecimiento);
        ultimaActualizacionCache = ahora;
        return cacheEmpleados;
      }
    }
  } catch {
    // Fallback
  }

  return [];
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
  const [empleados, departamentos, sucursales] = await Promise.all([
    listarTodosEmpleados(),
    listarDepartamentos(),
    listarSucursales(),
  ]);

  return {
    empleados: empleados.map((e) => ({
      id_empleado: e.id_empleado,
      nombres: e.nombres,
      apellidos: e.apellidos,
      nombre_completo: e.nombre_completo,
      cargo: e.cargo,
      id_departamento: e.id_departamento,
      nombre_departamento: e.nombre_departamento,
      id_sucursal: e.id_sucursal,
      nombre_sucursal: e.nombre_sucursal,
      activo: Boolean(e.activo),
    })),
    departamentos,
    sucursales,
  };
}

async function obtenerNombreEmpleado(idEmpleado) {
  if (!idEmpleado) return null;
  const emp = await obtenerEmpleado(idEmpleado);
  if (!emp) return null;
  return {
    nombre_completo: emp.nombre_completo,
    cargo: emp.cargo,
  };
}

module.exports = {
  obtenerEmpleado,
  verificarEmpleadoActivo,
  obtenerDestinatariosGrupo,
  listarDestinatariosDisponibles,
  listarDepartamentos,
  listarSucursales,
  obtenerNombreEmpleado,
};

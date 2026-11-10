import { solicitar } from "./cliente";

const RUTA = "/perf/ciclos";

// Temporal hasta contar con inicio de sesión: el portal envía el rol y, al crear, el empleado que programa el ciclo.
const comoAdministrador = ({ rol, idEmpleado }) => ({
  "X-Rol": rol,
  ...(idEmpleado && { "X-Empleado-Id": idEmpleado }),
});

// { versiones, periodos }: versiones publicadas de plantillas y periodos de evaluación.
export const listarOpcionesCiclo = (sesion) => solicitar(`${RUTA}/opciones`, { cabeceras: comoAdministrador(sesion) });

// Calcula las asignaciones evaluador–evaluado del alcance sin guardar nada.
export const previsualizarAsignaciones = (sesion, { idVersion, alcance }) =>
  solicitar(`${RUTA}/vista-previa`, {
    metodo: "POST",
    cuerpo: { ...(idVersion && { id_version: idVersion }), alcance },
    cabeceras: comoAdministrador(sesion),
  });

// Crea el ciclo programado con sus asignaciones. alcance: { areas, sucursales, colaboradores } con id.
export const crearCiclo = (sesion, { idVersion, idPeriodo, nombre, fechaInicio, fechaLimite, alcance }) =>
  solicitar(RUTA, {
    metodo: "POST",
    cuerpo: {
      id_version: idVersion,
      id_periodo: idPeriodo,
      nombre,
      fecha_inicio: fechaInicio,
      fecha_limite: fechaLimite,
      alcance,
    },
    cabeceras: comoAdministrador(sesion),
  });

export const listarCiclos = (sesion) => solicitar(RUTA, { cabeceras: comoAdministrador(sesion) });

export const obtenerCiclo = (sesion, idCiclo) =>
  solicitar(`${RUTA}/${idCiclo}`, { cabeceras: comoAdministrador(sesion) });

// Datos de EmployeeService para elegir el alcance.
export const listarAreasCiclo = () => solicitar("/empl/departamentos");

export const listarSucursalesCiclo = () => solicitar("/empl/sucursales");

export const listarColaboradoresCiclo = () => solicitar("/empl/empleados");

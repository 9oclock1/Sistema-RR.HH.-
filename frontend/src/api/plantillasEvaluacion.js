import { solicitar } from "./cliente";

const RUTA = "/perf/plantillas";
const VERSIONES = `${RUTA}/versiones`;

// Temporal hasta contar con inicio de sesión: el portal envía el empleado en X-Empleado-Id.
const comoEmpleado = (idEmpleado) => ({ "X-Empleado-Id": idEmpleado });

// Una fila por versión de cada plantilla.
export const listarPlantillas = () => solicitar(RUTA);

export const obtenerPlantilla = (idVersion) => solicitar(`${VERSIONES}/${idVersion}`);

// Crea la plantilla con su versión 1 en borrador; idEmpleado queda como creador.
export const crearPlantilla = (idEmpleado, plantilla) =>
  solicitar(RUTA, { metodo: "POST", cuerpo: plantilla, cabeceras: comoEmpleado(idEmpleado) });

export const actualizarPlantilla = (idVersion, plantilla) =>
  solicitar(`${VERSIONES}/${idVersion}`, { metodo: "PUT", cuerpo: plantilla });

export const eliminarPlantilla = (idVersion) => solicitar(`${VERSIONES}/${idVersion}`, { metodo: "DELETE" });

export const publicarPlantilla = (idEmpleado, idVersion) =>
  solicitar(`${VERSIONES}/${idVersion}/publicacion`, { metodo: "POST", cabeceras: comoEmpleado(idEmpleado) });

export const crearVersionPlantilla = (idVersion) =>
  solicitar(`${VERSIONES}/${idVersion}/nueva-version`, { metodo: "POST" });

// Catálogos comunes a todas las plantillas.
export const listarEscalas = () => solicitar("/perf/escalas");

export const crearEscala = (escala) => solicitar("/perf/escalas", { metodo: "POST", cuerpo: escala });

export const actualizarEscala = (idEscala, escala) =>
  solicitar(`/perf/escalas/${idEscala}`, { metodo: "PUT", cuerpo: escala });

export const eliminarEscala = (idEscala) => solicitar(`/perf/escalas/${idEscala}`, { metodo: "DELETE" });

export const listarCompetencias = () => solicitar("/perf/competencias");

export const crearCompetencia = (competencia) =>
  solicitar("/perf/competencias", { metodo: "POST", cuerpo: competencia });

// Áreas activas de EmployeeService: destino de la plantilla.
export const listarAreas = () => solicitar("/empl/departamentos");

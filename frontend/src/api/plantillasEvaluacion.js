import { solicitar } from "./cliente";

const RUTA = "/perf/plantillas";

// Temporal hasta contar con inicio de sesión: el portal envía el empleado en X-Empleado-Id.
const comoEmpleado = (idEmpleado) => ({ "X-Empleado-Id": idEmpleado });

// Filtros opcionales: estado (BORRADOR, PUBLICADA o ARCHIVADA) e id_departamento.
export const listarPlantillas = (idEmpleado, { estado, idDepartamento } = {}) => {
  const parametros = new URLSearchParams();
  if (estado) parametros.set("estado", estado);
  if (idDepartamento) parametros.set("id_departamento", idDepartamento);
  const consulta = parametros.toString();
  return solicitar(consulta ? `${RUTA}?${consulta}` : RUTA, { cabeceras: comoEmpleado(idEmpleado) });
};

// Crea la plantilla con su versión 1 en borrador. Si ya existe una igual (nombre, área y vigencia) responde 409.
export const crearPlantilla = (idEmpleado, plantilla) =>
  solicitar(RUTA, { metodo: "POST", cuerpo: plantilla, cabeceras: comoEmpleado(idEmpleado) });

// Solo mientras la plantilla no se haya publicado; después responde 409.
export const actualizarPlantilla = (idEmpleado, idPlantilla, plantilla) =>
  solicitar(`${RUTA}/${idPlantilla}`, { metodo: "PUT", cuerpo: plantilla, cabeceras: comoEmpleado(idEmpleado) });

export const eliminarPlantilla = (idEmpleado, idPlantilla) =>
  solicitar(`${RUTA}/${idPlantilla}`, { metodo: "DELETE", cabeceras: comoEmpleado(idEmpleado) });

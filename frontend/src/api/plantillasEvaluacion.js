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

// Detalle de la plantilla con sus versiones (la más reciente define su estado).
export const obtenerPlantilla = (idEmpleado, idPlantilla) =>
  solicitar(`${RUTA}/${idPlantilla}`, { cabeceras: comoEmpleado(idEmpleado) });

// Una versión con sus secciones, criterios y preguntas, y el balance de pesos. `editable` indica si todavía es un borrador.
export const obtenerVersion = (idEmpleado, idPlantilla, idVersion) =>
  solicitar(`${RUTA}/${idPlantilla}/versiones/${idVersion}`, { cabeceras: comoEmpleado(idEmpleado) });

// Deja la estructura de la versión como la lista: secciones (con su competencia), criterios y preguntas con su peso
// y su escala, en ese orden. Un borrador puede guardarse con pesos que no suman 100 %; publicarlo exige que sumen 100 %.
// Solo funciona en borradores (409 si no).
export const guardarEstructura = (idEmpleado, idPlantilla, idVersion, secciones) =>
  solicitar(`${RUTA}/${idPlantilla}/versiones/${idVersion}/estructura`, {
    metodo: "PUT",
    cuerpo: { secciones },
    cabeceras: comoEmpleado(idEmpleado),
  });

// Catálogo de competencias laborales y factores operativos activos.
export const listarCompetencias = (idEmpleado) =>
  solicitar("/perf/competencias", { cabeceras: comoEmpleado(idEmpleado) });

// tipo: COMPETENCIA_LABORAL o FACTOR_OPERATIVO. Si el nombre ya existe responde 409.
export const crearCompetencia = (idEmpleado, competencia) =>
  solicitar("/perf/competencias", { metodo: "POST", cuerpo: competencia, cabeceras: comoEmpleado(idEmpleado) });

// Publica la versión en borrador: queda disponible para futuras asignaciones y su estructura se bloquea.
// Si falta algo responde 422 con la lista de pendientes en detalles.
export const publicarVersion = (idEmpleado, idPlantilla, idVersion) =>
  solicitar(`${RUTA}/${idPlantilla}/versiones/${idVersion}/publicacion`, {
    metodo: "POST",
    cabeceras: comoEmpleado(idEmpleado),
  });

// Nuevo borrador con la estructura de la versión más reciente. Si ya hay un borrador abierto responde 409.
export const crearVersion = (idEmpleado, idPlantilla) =>
  solicitar(`${RUTA}/${idPlantilla}/versiones`, { metodo: "POST", cabeceras: comoEmpleado(idEmpleado) });

// Escalas de valoración: catálogo común a todas las plantillas. Cada escala trae sus niveles (valor y etiqueta).
// Si está en uso en una plantilla publicada, solo se pueden cambiar su nombre y su descripción (409 si no).
export const listarEscalas = (idEmpleado) => solicitar("/perf/escalas", { cabeceras: comoEmpleado(idEmpleado) });

export const crearEscala = (idEmpleado, escala) =>
  solicitar("/perf/escalas", { metodo: "POST", cuerpo: escala, cabeceras: comoEmpleado(idEmpleado) });

export const actualizarEscala = (idEmpleado, idEscala, escala) =>
  solicitar(`/perf/escalas/${idEscala}`, { metodo: "PUT", cuerpo: escala, cabeceras: comoEmpleado(idEmpleado) });

export const eliminarEscala = (idEmpleado, idEscala) =>
  solicitar(`/perf/escalas/${idEscala}`, { metodo: "DELETE", cabeceras: comoEmpleado(idEmpleado) });

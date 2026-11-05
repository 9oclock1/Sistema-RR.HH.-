import { solicitar } from "./cliente";

const RUTA = "/perf/evaluaciones";

// Temporal hasta contar con inicio de sesión: el portal envía el empleado en X-Empleado-Id.
const comoEvaluador = (idEmpleado) => ({ "X-Empleado-Id": idEmpleado });

export const listarEvaluaciones = (idEmpleado, { idCiclo } = {}) => {
  const parametros = new URLSearchParams();
  if (idCiclo) parametros.set("id_ciclo", idCiclo);
  const consulta = parametros.toString();
  return solicitar(consulta ? `${RUTA}?${consulta}` : RUTA, {
    cabeceras: comoEvaluador(idEmpleado),
  });
};

export const listarCiclosEvaluacion = (idEmpleado) =>
  solicitar(`${RUTA}/ciclos`, { cabeceras: comoEvaluador(idEmpleado) });

// Formulario de la evaluación: plantilla del ciclo (escalas y secciones) con las respuestas ya guardadas.
export const obtenerEvaluacion = (idEmpleado, idEvaluacion) =>
  solicitar(`${RUTA}/${idEvaluacion}`, { cabeceras: comoEvaluador(idEmpleado) });

// Guardado parcial: solo las respuestas indicadas [{ id_pregunta, id_nivel }]; id_nivel null borra la respuesta.
export const guardarRespuestas = (idEmpleado, idEvaluacion, respuestas) =>
  solicitar(`${RUTA}/${idEvaluacion}/respuestas`, {
    metodo: "PUT",
    cuerpo: { respuestas },
    cabeceras: comoEvaluador(idEmpleado),
  });

// Calcula el puntaje final y bloquea la evaluación. Si faltan obligatorias responde 422 con detalles[].
export const enviarEvaluacion = (idEmpleado, idEvaluacion) =>
  solicitar(`${RUTA}/${idEvaluacion}/envio`, { metodo: "POST", cabeceras: comoEvaluador(idEmpleado) });

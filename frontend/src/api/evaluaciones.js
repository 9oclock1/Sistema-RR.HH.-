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

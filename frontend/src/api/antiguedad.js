import { solicitar } from "./cliente";

const RUTA = "/comp/antiguedad";

export const listarEscalas = () => solicitar(`${RUTA}/escalas`);

export const obtenerEscalaVigente = (fecha) =>
  solicitar(`${RUTA}/escalas/vigente${fecha ? `?fecha=${fecha}` : ""}`);

export const registrarVigenciaEscala = (datos) => solicitar(`${RUTA}/escalas`, { metodo: "POST", cuerpo: datos });

export const calcularBono = (idEmpleado, periodo) => solicitar(`${RUTA}/bono/${idEmpleado}?periodo=${periodo}`);

export const calcularBonoPlanilla = (periodo) => solicitar(`${RUTA}/bono?periodo=${periodo}`);

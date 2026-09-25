import { solicitar } from "./cliente";

const RUTA = "/att/marcajes";

const comoEmpleado = (idEmpleado) => ({ "X-Empleado-Id": idEmpleado });

export const consultarJornada = (idEmpleado) =>
  solicitar(`${RUTA}/jornada`, { cabeceras: comoEmpleado(idEmpleado) });

export const registrarEntrada = (idEmpleado) =>
  solicitar(`${RUTA}/entrada`, { metodo: "POST", cabeceras: comoEmpleado(idEmpleado) });

export const registrarSalida = (idEmpleado) =>
  solicitar(`${RUTA}/salida`, { metodo: "POST", cabeceras: comoEmpleado(idEmpleado) });

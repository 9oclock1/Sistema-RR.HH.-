import { solicitar } from "./cliente";

const RUTA = "/att/vacaciones/solicitudes";

const comoEmpleado = (idEmpleado) => ({ "X-Empleado-Id": idEmpleado });

export const consultarSaldo = (idEmpleado) =>
  solicitar(`${RUTA}/resumen`, { cabeceras: comoEmpleado(idEmpleado) });

export const calcularDias = (idEmpleado, fechas) =>
  solicitar(`${RUTA}/calculo?${new URLSearchParams(fechas)}`, { cabeceras: comoEmpleado(idEmpleado) });

export const listarSolicitudes = (idEmpleado) =>
  solicitar(`${RUTA}`, { cabeceras: comoEmpleado(idEmpleado) });

export const registrarSolicitud = (idEmpleado, fechas) =>
  solicitar(`${RUTA}`, { metodo: "POST", cuerpo: fechas, cabeceras: comoEmpleado(idEmpleado) });

import { solicitar } from "./cliente";

const RUTA = "/att/vacaciones";

export const consultarMiSaldo = (idEmpleado) =>
  solicitar(`${RUTA}/saldo`, { cabeceras: { "X-Empleado-Id": idEmpleado } });

// Consulta de RRHH sobre el expediente de otro empleado.
export const consultarSaldoDeEmpleado = (idEmpleado) => solicitar(`${RUTA}/empleados/${idEmpleado}/saldo`);

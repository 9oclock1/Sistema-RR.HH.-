import { solicitar } from "./cliente";

const RUTA = "/comp/condiciones";

export const listarCondiciones = () => solicitar(RUTA);

export const crearCondicion = (condicion) => solicitar(RUTA, { metodo: "POST", cuerpo: condicion });

export const actualizarCondicion = (id, condicion) => solicitar(`${RUTA}/${id}`, { metodo: "PUT", cuerpo: condicion });

export const eliminarCondicion = (id) => solicitar(`${RUTA}/${id}`, { metodo: "DELETE" });

export const listarAsignaciones = (id) => solicitar(`${RUTA}/${id}/asignaciones`);

export const asignarCondicion = (id, asignacion) =>
  solicitar(`${RUTA}/${id}/asignaciones`, { metodo: "POST", cuerpo: asignacion });

export const cambiarFinAsignacion = (id, idAsignacion, vigenteHasta) =>
  solicitar(`${RUTA}/${id}/asignaciones/${idAsignacion}`, { metodo: "PATCH", cuerpo: { vigente_hasta: vigenteHasta } });

export const eliminarAsignacion = (id, idAsignacion) =>
  solicitar(`${RUTA}/${id}/asignaciones/${idAsignacion}`, { metodo: "DELETE" });

export const listarBonos = (periodo) => solicitar(`${RUTA}/bonos?periodo=${encodeURIComponent(periodo)}`);

export const procesarPeriodo = (periodo) => solicitar(`${RUTA}/procesar`, { metodo: "POST", cuerpo: { periodo } });

// Personal de EmployeeService para elegir a quién asignar.
export const listarPersonal = () => solicitar("/empl/empleados");

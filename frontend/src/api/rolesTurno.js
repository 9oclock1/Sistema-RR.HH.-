import { solicitar } from "./cliente";

const RUTA = "/att/roles-turno";

export const listarSucursales = () => solicitar("/empl/sucursales");

export const listarAreas = () => solicitar("/empl/departamentos");

export const listarTurnosActivos = () => solicitar("/att/turnos?activo=true");

export const listarRoles = (idSucursal, idDepartamento) =>
  solicitar(`${RUTA}?${new URLSearchParams({ id_sucursal: idSucursal, id_departamento: idDepartamento })}`);

export const obtenerRol = (id) => solicitar(`${RUTA}/${id}`);

export const crearRol = (datos) => solicitar(RUTA, { metodo: "POST", cuerpo: datos });

export const guardarAsignaciones = (id, asignaciones) =>
  solicitar(`${RUTA}/${id}/asignaciones`, { metodo: "PUT", cuerpo: { asignaciones } });

export const publicarRol = (id) => solicitar(`${RUTA}/${id}/publicar`, { metodo: "POST" });

export const eliminarRol = (id) => solicitar(`${RUTA}/${id}`, { metodo: "DELETE" });

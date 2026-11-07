import { solicitar } from "./cliente";

const RUTA = "/perf/quejas";

const comoAdministrador = ({ rol, idEmpleado }) => ({ "X-Rol": rol, ...(idEmpleado && { "X-Empleado-Id": idEmpleado }) });

export const listarCatalogosCasos = (sesion) => solicitar(`${RUTA}/catalogos`, { cabeceras: comoAdministrador(sesion) });

export const listarResponsablesQueja = (sesion) =>
  solicitar(`${RUTA}/responsables`, { cabeceras: comoAdministrador(sesion) });

export function listarCasosQueja(sesion, { estado, categoria, prioridad, pagina, limite } = {}) {
  const parametros = new URLSearchParams();
  Object.entries({ estado, categoria, prioridad, pagina, limite }).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") parametros.set(clave, valor);
  });
  const consulta = parametros.toString();
  return solicitar(consulta ? `${RUTA}/casos?${consulta}` : `${RUTA}/casos`, { cabeceras: comoAdministrador(sesion) });
}

export const obtenerCasoQueja = (sesion, idQueja) =>
  solicitar(`${RUTA}/casos/${idQueja}`, { cabeceras: comoAdministrador(sesion) });

export const clasificarCasoQueja = (sesion, idQueja, { idCategoria, idPrioridad }) =>
  solicitar(`${RUTA}/casos/${idQueja}/clasificacion`, {
    metodo: "PUT",
    cuerpo: { id_categoria_queja: idCategoria, id_prioridad_queja: idPrioridad },
    cabeceras: comoAdministrador(sesion),
  });

export const derivarCasoQueja = (sesion, idQueja, { idCategoria, idPrioridad, idResponsable, comentario }) =>
  solicitar(`${RUTA}/casos/${idQueja}/derivacion`, {
    metodo: "POST",
    cuerpo: {
      id_categoria_queja: idCategoria,
      id_prioridad_queja: idPrioridad,
      id_empleado_responsable: idResponsable,
      comentario,
    },
    cabeceras: comoAdministrador(sesion),
  });

export const reintentarAvisoQueja = (sesion, idQueja) =>
  solicitar(`${RUTA}/casos/${idQueja}/derivacion/notificacion`, {
    metodo: "POST",
    cabeceras: comoAdministrador(sesion),
  });

export const registrarInvolucradoQueja = (sesion, idQueja, idEmpleado) =>
  solicitar(`${RUTA}/casos/${idQueja}/involucrados`, {
    metodo: "POST",
    cuerpo: { id_empleado: idEmpleado },
    cabeceras: comoAdministrador(sesion),
  });

export const quitarInvolucradoQueja = (sesion, idQueja, idEmpleado) =>
  solicitar(`${RUTA}/casos/${idQueja}/involucrados/${idEmpleado}`, {
    metodo: "DELETE",
    cabeceras: comoAdministrador(sesion),
  });

export const listarEmpleadosQueja = () => solicitar("/empl/empleados");

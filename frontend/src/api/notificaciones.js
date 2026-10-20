import { solicitar } from "./cliente";

const RUTA = "/notf/notificaciones";

const comoEmpleado = (idEmpleado) => ({ "X-Empleado-Id": idEmpleado });

// Devuelve { notificaciones, no_leidas, total }; `total` es el del filtro, para paginar la vista completa.
export const listarNotificaciones = (idEmpleado, { soloNoLeidas = false, limite = 20, desplazamiento = 0 } = {}) => {
  const parametros = new URLSearchParams({ limite, desplazamiento });
  if (soloNoLeidas) parametros.set("estado", "no_leidas");
  return solicitar(`${RUTA}?${parametros}`, { cabeceras: comoEmpleado(idEmpleado) });
};

// Devuelve { no_leidas }; es la consulta liviana que refresca el contador de la campana.
export const contarNoLeidas = (idEmpleado) => solicitar(`${RUTA}/conteo`, { cabeceras: comoEmpleado(idEmpleado) });

export const marcarLeida = (idEmpleado, idNotificacion) =>
  solicitar(`${RUTA}/${idNotificacion}/leer`, { metodo: "POST", cabeceras: comoEmpleado(idEmpleado) });

export const marcarTodasLeidas = (idEmpleado) =>
  solicitar(`${RUTA}/leer-todas`, { metodo: "POST", cabeceras: comoEmpleado(idEmpleado) });

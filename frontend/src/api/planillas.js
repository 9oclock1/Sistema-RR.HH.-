import { solicitar } from "./cliente";

const RUTA = "/comp/planillas";

// Temporal hasta contar con autenticación: quién actúa y con qué rol.
const cabeceras = ({ idEmpleado, rol }) => ({
  ...(idEmpleado && { "X-Empleado-Id": idEmpleado }),
  "X-Rol": rol,
});

export const listarPlanillas = (periodo) => solicitar(`${RUTA}?periodo=${encodeURIComponent(periodo)}`);

export const obtenerPlanilla = (id) => solicitar(`${RUTA}/${id}`);

export const generarPlanilla = (periodo, identidad) =>
  solicitar(RUTA, { metodo: "POST", cuerpo: { periodo }, cabeceras: cabeceras(identidad) });

export const descartarPlanilla = (id, identidad) =>
  solicitar(`${RUTA}/${id}`, { metodo: "DELETE", cabeceras: cabeceras(identidad) });

export const aprobarPlanilla = (id, identidad) =>
  solicitar(`${RUTA}/${id}/aprobar`, { metodo: "POST", cabeceras: cabeceras(identidad) });

// destino: "contabilidad" o "pagos".
export const reenviarIntegracion = (id, destino, identidad) =>
  solicitar(`${RUTA}/${id}/integraciones/${destino}/reenviar`, { metodo: "POST", cabeceras: cabeceras(identidad) });

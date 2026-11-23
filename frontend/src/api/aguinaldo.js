import { solicitar } from "./cliente";

const RUTA = "/comp/aguinaldos";

// Temporal hasta contar con autenticación: quién actúa y con qué rol.
const cabeceras = ({ idEmpleado, rol }) => ({
  ...(idEmpleado && { "X-Empleado-Id": idEmpleado }),
  "X-Rol": rol,
});

export const listarAguinaldos = () => solicitar(RUTA);

export const obtenerAguinaldo = (id) => solicitar(`${RUTA}/${id}`);

export const generarAguinaldo = (gestion, identidad) =>
  solicitar(RUTA, { metodo: "POST", cuerpo: { gestion }, cabeceras: cabeceras(identidad) });

export const descartarAguinaldo = (id, identidad) => solicitar(`${RUTA}/${id}`, { metodo: "DELETE", cabeceras: cabeceras(identidad) });

export const aprobarAguinaldo = (id, identidad) =>
  solicitar(`${RUTA}/${id}/aprobar`, { metodo: "POST", cabeceras: cabeceras(identidad) });

// destino: "contabilidad" o "pagos".
export const reenviarIntegracionAguinaldo = (id, destino, identidad) =>
  solicitar(`${RUTA}/${id}/integraciones/${destino}/reenviar`, { metodo: "POST", cabeceras: cabeceras(identidad) });

// Contabilidad y Pagos no existen en este sistema: se simula su respuesta en vez de esperarla por Pub/Sub.
// datos: { resultado: "CONFIRMADA" | "RECHAZADA", referencia?, motivo? (obligatorio si se rechaza) }.
export const simularConfirmacionAguinaldo = (id, destino, datos, identidad) =>
  solicitar(`${RUTA}/${id}/integraciones/${destino}/simular-confirmacion`, {
    metodo: "POST",
    cuerpo: datos,
    cabeceras: cabeceras(identidad),
  });

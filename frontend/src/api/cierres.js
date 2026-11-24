import { solicitar } from "./cliente";

const RUTA = "/comp/cierres";

// Sesión real por cookie HttpOnly: no se envían cabeceras X-Rol ni X-Empleado-Id.
export const listarCierres = (filtros = {}) => {
  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, valor]) => valor !== "" && valor != null)
  );
  const query = params.toString();
  return solicitar(`${RUTA}${query ? `?${query}` : ""}`);
};

export const obtenerCierre = (idProceso) => solicitar(`${RUTA}/${idProceso}`);

export const cerrarDesvinculacion = (idProceso) =>
  solicitar(`${RUTA}/${idProceso}/cerrar`, { metodo: "POST" });

export const reenviarCierre = (idProceso, destino) =>
  solicitar(`${RUTA}/${idProceso}/reenviar`, {
    metodo: "POST",
    cuerpo: { destino },
  });

export const simularRespuestaCierre = (idProceso, datos) =>
  solicitar(`${RUTA}/${idProceso}/simular-respuesta`, {
    metodo: "POST",
    cuerpo: datos,
  });

export const configurarSinRespuestaCierre = (destino, activo) =>
  solicitar(`${RUTA}/simulacion/sin-respuesta`, {
    metodo: "POST",
    cuerpo: { destino, activo },
  });

export const listarMensajesCierre = (idProceso) =>
  solicitar(`${RUTA}/${idProceso}/mensajes`);

export const reprocesarMensajeCierre = (idEntrante) =>
  solicitar(`${RUTA}/mensajes-entrantes/${idEntrante}/reprocesar`, {
    metodo: "POST",
  });

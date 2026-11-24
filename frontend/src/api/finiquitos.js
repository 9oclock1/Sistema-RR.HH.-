import { solicitar } from "./cliente";

const RUTA = "/comp/finiquitos";

// Sesión real por cookie HttpOnly: no se envían cabeceras X-Rol ni X-Empleado-Id.
export const listarFiniquitos = (filtros = {}) => {
  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, valor]) => valor !== "" && valor != null)
  );
  const query = params.toString();
  return solicitar(`${RUTA}${query ? `?${query}` : ""}`);
};

export const obtenerFiniquito = (idProceso) => solicitar(`${RUTA}/${idProceso}`);

export const generarFiniquito = (idProceso) =>
  solicitar(`${RUTA}/${idProceso}/generar`, { metodo: "POST" });

export const aprobarFiniquito = (idProceso) =>
  solicitar(`${RUTA}/${idProceso}/aprobar`, { metodo: "POST" });

export const descargarPdfFiniquito = (idProceso) =>
  solicitar(`${RUTA}/${idProceso}/pdf`, { respuestaBinaria: true });

export const reenviarFiniquito = (idProceso, destino) =>
  solicitar(`${RUTA}/${idProceso}/reenviar`, {
    metodo: "POST",
    cuerpo: { destino },
  });

export const simularRespuestaFiniquito = (idProceso, datos) =>
  solicitar(`${RUTA}/${idProceso}/simular-respuesta`, {
    metodo: "POST",
    cuerpo: datos,
  });

export const simularCaidaBrokerFiniquito = (segundos = 30) =>
  solicitar(`${RUTA}/simulacion/caida-broker`, {
    metodo: "POST",
    cuerpo: { segundos },
  });

export const listarMensajesFiniquito = (idProceso) =>
  solicitar(`${RUTA}/${idProceso}/mensajes`);

export const reprocesarMensajeFiniquito = (idEntrante) =>
  solicitar(`${RUTA}/mensajes-entrantes/${idEntrante}/reprocesar`, {
    metodo: "POST",
  });

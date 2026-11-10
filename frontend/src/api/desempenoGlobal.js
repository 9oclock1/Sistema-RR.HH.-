import { solicitar } from "./cliente";

const RUTA = "/perf/desempeno";

// Temporal hasta contar con inicio de sesión: el portal envía el rol (admin o gerente consultan; solo admin modifica).
const comoRrhh = (rol) => ({ "X-Rol": rol });

// Ciclos cerrados, que son los únicos que se pueden consolidar.
export const listarCiclosCerrados = (rol) => solicitar(`${RUTA}/ciclos`, { cabeceras: comoRrhh(rol) });

// Promedio global, promedios por área, sucursal y competencia (con brechas) y estado de la solicitud al CRM.
export const obtenerConsolidado = (rol, idCiclo) =>
  solicitar(`${RUTA}/ciclos/${idCiclo}/consolidado`, { cabeceras: comoRrhh(rol) });

// Puntaje de cada colaborador del ciclo con sus métricas del CRM (null si no llegaron).
export const listarColaboradoresDelCiclo = (rol, idCiclo) =>
  solicitar(`${RUTA}/ciclos/${idCiclo}/colaboradores`, { cabeceras: comoRrhh(rol) });

export const actualizarUmbralBrecha = (rol, idCiclo, umbral) =>
  solicitar(`${RUTA}/ciclos/${idCiclo}/umbral`, {
    metodo: "PUT",
    cuerpo: { umbral_brecha: umbral },
    cabeceras: comoRrhh(rol),
  });

// Vuelve a poner en cola la solicitud de métricas al CRM que quedó fallida.
export const reintentarSolicitudCrm = (rol, idCiclo) =>
  solicitar(`${RUTA}/ciclos/${idCiclo}/solicitud-crm/reintentar`, { metodo: "POST", cabeceras: comoRrhh(rol) });

// Mensajes que llegaron del CRM. estado: RECIBIDO | PROCESADO | EN_DLQ (la cola de errores).
export const listarMensajesCrm = (rol, estado) =>
  solicitar(`${RUTA}/mensajes-crm${estado ? `?estado=${encodeURIComponent(estado)}` : ""}`, { cabeceras: comoRrhh(rol) });

export const reprocesarMensajeCrm = (rol, idMensaje) =>
  solicitar(`${RUTA}/mensajes-crm/${idMensaje}/reprocesar`, { metodo: "POST", cabeceras: comoRrhh(rol) });

// Simula la llegada de un mensaje del CRM. `mensaje` va tal cual (texto), así también se puede probar un JSON roto.
export const simularMensajeCrm = (rol, mensaje) =>
  solicitar(`${RUTA}/mensajes-crm/simulacion`, { metodo: "POST", cuerpo: { mensaje }, cabeceras: comoRrhh(rol) });

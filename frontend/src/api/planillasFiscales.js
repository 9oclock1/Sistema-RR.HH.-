import { solicitar } from "./cliente";

const RUTA = "/comp/planillas";

export const generarPlanillaTributaria = (idPlanilla) => solicitar(`${RUTA}/${idPlanilla}/tributaria`, { metodo: "POST" });

export const obtenerPlanillaTributaria = (idPlanilla) => solicitar(`${RUTA}/${idPlanilla}/tributaria`);

export const exportarPlanillaTributaria = (idPlanilla, formato) =>
  solicitar(`${RUTA}/${idPlanilla}/tributaria/exportacion?formato=${encodeURIComponent(formato)}`, { respuestaBinaria: true });

export const generarPlanillaAportes = (idPlanilla) => solicitar(`${RUTA}/${idPlanilla}/aportes`, { metodo: "POST" });

export const obtenerPlanillaAportes = (idPlanilla) => solicitar(`${RUTA}/${idPlanilla}/aportes`);

export const exportarPlanillaAportes = (idPlanilla, entidad) =>
  solicitar(`${RUTA}/${idPlanilla}/aportes/exportacion${entidad ? `?entidad=${encodeURIComponent(entidad)}` : ""}`, {
    respuestaBinaria: true,
  });

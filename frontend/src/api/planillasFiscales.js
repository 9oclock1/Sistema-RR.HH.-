import { solicitar } from "./cliente";

const RUTA = "/comp/planillas";

const cabeceras = ({ idEmpleado, rol }) => ({
  ...(idEmpleado && { "X-Empleado-Id": idEmpleado }),
  "X-Rol": rol,
});

export const generarPlanillaTributaria = (idPlanilla, identidad) =>
  solicitar(`${RUTA}/${idPlanilla}/tributaria`, { metodo: "POST", cabeceras: cabeceras(identidad) });

export const obtenerPlanillaTributaria = (idPlanilla, identidad) =>
  solicitar(`${RUTA}/${idPlanilla}/tributaria`, { cabeceras: cabeceras(identidad) });

export const exportarPlanillaTributaria = (idPlanilla, formato, identidad) =>
  solicitar(`${RUTA}/${idPlanilla}/tributaria/exportacion?formato=${encodeURIComponent(formato)}`, {
    cabeceras: cabeceras(identidad),
    respuestaBinaria: true,
  });

export const generarPlanillaAportes = (idPlanilla, identidad) =>
  solicitar(`${RUTA}/${idPlanilla}/aportes`, { metodo: "POST", cabeceras: cabeceras(identidad) });

export const obtenerPlanillaAportes = (idPlanilla, identidad) =>
  solicitar(`${RUTA}/${idPlanilla}/aportes`, { cabeceras: cabeceras(identidad) });

export const exportarPlanillaAportes = (idPlanilla, entidad, identidad) =>
  solicitar(`${RUTA}/${idPlanilla}/aportes/exportacion${entidad ? `?entidad=${encodeURIComponent(entidad)}` : ""}`, {
    cabeceras: cabeceras(identidad),
    respuestaBinaria: true,
  });

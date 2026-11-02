import { solicitar } from "./cliente";

const RUTA = "/perf/plantillas";

export const listarPlantillas = () => solicitar(RUTA);

export const obtenerPlantilla = (id) => solicitar(`${RUTA}/${id}`);

export const crearPlantilla = (plantilla) => solicitar(RUTA, { metodo: "POST", cuerpo: plantilla });

export const actualizarPlantilla = (id, plantilla) => solicitar(`${RUTA}/${id}`, { metodo: "PUT", cuerpo: plantilla });

export const eliminarPlantilla = (id) => solicitar(`${RUTA}/${id}`, { metodo: "DELETE" });

export const publicarPlantilla = (id) => solicitar(`${RUTA}/${id}/publicar`, { metodo: "POST" });

export const crearVersionPlantilla = (id) => solicitar(`${RUTA}/${id}/versiones`, { metodo: "POST" });

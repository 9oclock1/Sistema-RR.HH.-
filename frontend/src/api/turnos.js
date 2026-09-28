import { solicitar } from "./cliente";

const RUTA = "/att";

export const listarTiposJornada = () => solicitar(`${RUTA}/tipos-jornada`);

export const listarTurnos = () => solicitar(`${RUTA}/turnos`);

export const crearTurno = (turno) => solicitar(`${RUTA}/turnos`, { metodo: "POST", cuerpo: turno });

export const actualizarTurno = (id, turno) =>
  solicitar(`${RUTA}/turnos/${id}`, { metodo: "PUT", cuerpo: turno });

export const eliminarTurno = (id) => solicitar(`${RUTA}/turnos/${id}`, { metodo: "DELETE" });

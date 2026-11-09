import { solicitar } from "./cliente";

const RUTA = "/comp/bonos-productividad";

export const listarReglas = (filtros = {}) => {
  const params = new URLSearchParams(filtros);
  const query = params.toString();
  return solicitar(query ? `${RUTA}?${query}` : RUTA);
};

export const crearRegla = (regla) => solicitar(RUTA, { metodo: "POST", cuerpo: regla });

export const actualizarRegla = (id, regla) => solicitar(`${RUTA}/${id}`, { metodo: "PUT", cuerpo: regla });

export const cambiarEstadoRegla = (id, estaActiva) =>
  solicitar(`${RUTA}/${id}/estado`, { metodo: "PATCH", cuerpo: { esta_activa: estaActiva } });

export const eliminarRegla = (id) => solicitar(`${RUTA}/${id}`, { metodo: "DELETE" });

export const listarBonos = (periodo) => solicitar(`${RUTA}/bonos?periodo=${encodeURIComponent(periodo)}`);

export const procesarPeriodo = (periodo) => solicitar(`${RUTA}/procesar`, { metodo: "POST", cuerpo: { periodo } });

export const listarEventosVentas = (estado) =>
  solicitar(`${RUTA}/eventos${estado ? `?estado=${encodeURIComponent(estado)}` : ""}`);

export const reprocesarEventoVentas = (id) => solicitar(`${RUTA}/eventos/${id}/reprocesar`, { metodo: "POST" });

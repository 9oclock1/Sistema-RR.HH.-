import { solicitar } from "./cliente";

const RUTA = "/comp/anticipos";

export const listarAnticipos = (filtros = {}) => {
  const params = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor));
  const consulta = params.toString();
  return solicitar(consulta ? `${RUTA}?${consulta}` : RUTA);
};

export const obtenerAnticipo = (id) => solicitar(`${RUTA}/${id}`);

export const crearAnticipo = (datos) => solicitar(RUTA, { metodo: "POST", cuerpo: datos });

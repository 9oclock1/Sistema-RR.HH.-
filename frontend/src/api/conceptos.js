import { solicitar } from "./cliente";

const RUTA = "/comp/conceptos";

export const listarConceptos = () => solicitar(RUTA);

export const obtenerConcepto = (id) => solicitar(`${RUTA}/${id}`);

export const crearConcepto = (concepto) => solicitar(RUTA, { metodo: "POST", cuerpo: concepto });

export const actualizarConcepto = (id, concepto) => solicitar(`${RUTA}/${id}`, { metodo: "PUT", cuerpo: concepto });

export const cambiarEstadoConcepto = (id, estaActivo) =>
  solicitar(`${RUTA}/${id}/estado`, { metodo: "PATCH", cuerpo: { esta_activo: estaActivo } });

export const eliminarConcepto = (id) => solicitar(`${RUTA}/${id}`, { metodo: "DELETE" });

export const registrarVigencia = (id, vigencia) =>
  solicitar(`${RUTA}/${id}/vigencias`, { metodo: "POST", cuerpo: vigencia });

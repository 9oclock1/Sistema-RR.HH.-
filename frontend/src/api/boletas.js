import { solicitar } from "./cliente";

const RUTA = "/comp/boletas";

// Exigen sesión real (RF-46, criterio 3): quién consulta sale del JWT de la cookie de sesión, no de cabeceras.

// Boletas del colaborador, solo de planillas cerradas: [{ id_boleta, periodo, emitida_en, totales, ... }].
export const listarMisBoletas = () => solicitar(RUTA);

// Detalle: { periodo, empleado, contrato, dias, ingresos, descuentos, aportes, totales, codigo_verificacion, ... }.
export const obtenerBoleta = (id) => solicitar(`${RUTA}/${id}`);

export const descargarBoleta = (id) => solicitar(`${RUTA}/${id}/pdf`, { respuestaBinaria: true });

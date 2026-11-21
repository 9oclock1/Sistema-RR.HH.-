import { solicitar } from "./cliente";

const RUTA = "/comp/boletas";

// Temporal hasta contar con autenticación: quién consulta y con qué rol (RF-46, criterio 3).
const cabeceras = ({ idEmpleado, rol }) => ({
  ...(idEmpleado && { "X-Empleado-Id": idEmpleado }),
  ...(rol && { "X-Rol": rol }),
});

// Boletas del colaborador, solo de planillas cerradas: [{ id_boleta, periodo, emitida_en, totales, ... }].
export const listarMisBoletas = (identidad) => solicitar(RUTA, { cabeceras: cabeceras(identidad) });

// Detalle: { periodo, empleado, contrato, dias, ingresos, descuentos, aportes, totales, codigo_verificacion, ... }.
export const obtenerBoleta = (id, identidad) => solicitar(`${RUTA}/${id}`, { cabeceras: cabeceras(identidad) });

// PDF por fetch (no por <a href>): así viajan las cabeceras que identifican a quien descarga.
export const descargarBoleta = (id, identidad) =>
  solicitar(`${RUTA}/${id}/pdf`, { cabeceras: cabeceras(identidad), respuestaBinaria: true });

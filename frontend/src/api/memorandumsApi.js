import { solicitar } from './cliente';
import { request, urlApi } from './httpClient';

const BASE = '/empl/memorandums';

// `datos` es un FormData: el memorándum viaja como multipart por la evidencia adjunta.
export const createMemorandum = (datos) => request(BASE, { method: 'POST', body: datos });

// clasificacion: 'AMONESTACION' | 'RECONOCIMIENTO'; sin ella devuelve todo el catálogo.
export const getTiposMemorandum = (clasificacion, { signal } = {}) =>
  request(`${BASE}/tipos${clasificacion ? `?clasificacion=${encodeURIComponent(clasificacion)}` : ''}`, { signal });

// Enlace de descarga del PDF oficial (el servidor lo entrega como adjunto).
export const urlPdfMemorandum = (idMemorandum) => urlApi(`${BASE}/${idMemorandum}/pdf`);

// ---------- RF-39: acuse de recibo ----------
// Estas rutas identifican al colaborador por cabecera (temporal hasta contar con inicio de sesión).
const comoEmpleado = (idEmpleado) => ({ 'X-Empleado-Id': idEmpleado, 'X-Usuario-Id': idEmpleado });

// Memorándums emitidos a nombre del colaborador: { memorandums, pendientes, plazo_horas }.
export const listarMisMemorandums = (idEmpleado) =>
  solicitar(`${BASE}/recibidos`, { cabeceras: comoEmpleado(idEmpleado) });

// Abre el memorándum para leerlo; el servidor registra la primera apertura.
export const abrirMemorandumRecibido = (idEmpleado, idMemorandum) =>
  solicitar(`${BASE}/recibidos/${idMemorandum}`, { cabeceras: comoEmpleado(idEmpleado) });

// comentario: descargo opcional del colaborador.
export const acusarReciboMemorandum = (idEmpleado, idMemorandum, comentario) =>
  solicitar(`${BASE}/recibidos/${idMemorandum}/acuse`, {
    metodo: 'POST',
    cuerpo: { comentario },
    cabeceras: comoEmpleado(idEmpleado),
  });

// Vista de RRHH. estadoAcuse: 'PENDIENTE' | 'RECIBIDO' | 'VENCIDO'; sin él devuelve todos.
export const listarSeguimientoAcuses = (estadoAcuse) =>
  solicitar(`${BASE}/seguimiento${estadoAcuse ? `?estado_acuse=${estadoAcuse}` : ''}`);

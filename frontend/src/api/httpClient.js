// Cliente HTTP compartido. Todas las peticiones pasan por el API Gateway (NGINX), nunca por el puerto directo de un microservicio.
const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    // El backend devuelve [{ campo, mensaje }] en los errores de validación (400).
    this.errores = Array.isArray(data?.errores) ? data.errores : [];
  }
}

export async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('No se pudo conectar con el servidor.', 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error || `Error inesperado (${response.status}).`, response.status, data);
  }
  return data;
}

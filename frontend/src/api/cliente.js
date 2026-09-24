const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ErrorApi extends Error {
  constructor(estado, mensaje, detalles = []) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
  }
}

export async function solicitar(ruta, { metodo = "GET", cuerpo } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, {
      method: metodo,
      headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, "No se pudo conectar con el servidor");
  }

  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, datos?.error ?? "Error inesperado del servidor", datos?.detalles);
  }
  return datos;
}

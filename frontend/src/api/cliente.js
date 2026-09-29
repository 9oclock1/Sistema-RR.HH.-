const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ErrorApi extends Error {
  constructor(estado, mensaje, detalles = []) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
  }
}

export async function solicitar(
  ruta,
  { metodo = "GET", cuerpo, cabeceras, respuestaBinaria = false } = {},
) {
  let respuesta;
  const esFormData =
    typeof FormData !== "undefined" && cuerpo instanceof FormData;

  // Si es FormData, dejamos que el navegador defina Content-Type con el boundary
  const headers = {
    ...(!esFormData && cuerpo && { "Content-Type": "application/json" }),
    ...cabeceras,
  };

  const body = esFormData
    ? cuerpo
    : cuerpo
      ? JSON.stringify(cuerpo)
      : undefined;

  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, {
      method: metodo,
      headers,
      body,
    });
  } catch {
    throw new ErrorApi(0, "No se pudo conectar con el servidor");
  }

  if (respuesta.status === 204) return null;

  if (respuestaBinaria) {
    if (!respuesta.ok) {
      throw new ErrorApi(respuesta.status, "Error al descargar el archivo");
    }
    return await respuesta.blob();
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new ErrorApi(
      respuesta.status,
      datos?.message || datos?.error || "Error inesperado del servidor",
      datos?.detalles,
    );
  }
  return datos;
}

export const cliente = {
  get: (ruta, opciones) => solicitar(ruta, { ...opciones, metodo: "GET" }),
  post: (ruta, cuerpo, opciones) =>
    solicitar(ruta, { ...opciones, metodo: "POST", cuerpo }),
  put: (ruta, cuerpo, opciones) =>
    solicitar(ruta, { ...opciones, metodo: "PUT", cuerpo }),
  delete: (ruta, opciones) =>
    solicitar(ruta, { ...opciones, metodo: "DELETE" }),
  patch: (ruta, cuerpo, opciones) =>
    solicitar(ruta, { ...opciones, metodo: "PATCH", cuerpo }),
};

export default cliente;

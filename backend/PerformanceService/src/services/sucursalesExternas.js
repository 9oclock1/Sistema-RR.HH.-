const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const TIEMPO_ESPERA_MS = Number(process.env.EMPLOYEE_SERVICE_TIMEOUT_MS) || 3000;

async function consultarSucursal(idSucursal) {
  let lista;
  try {
    const respuesta = await fetch(`${URL_EMPLEADOS}/sucursales`, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
    if (!respuesta.ok) return { estado: "sin_respuesta", nombre: null };
    lista = await respuesta.json();
  } catch {
    return { estado: "sin_respuesta", nombre: null };
  }
  if (!Array.isArray(lista)) return { estado: "sin_respuesta", nombre: null };
  const sucursal = lista.find((item) => String(item.id_sucursal ?? "").toLowerCase() === idSucursal);
  if (!sucursal?.nombre) return { estado: "no_existe", nombre: null };
  return { estado: "encontrada", nombre: String(sucursal.nombre).trim().slice(0, 100) };
}

module.exports = { consultarSucursal };

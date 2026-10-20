import { useSyncExternalStore } from "react";

// Temporal hasta contar con inicio de sesión.
const CLAVE = "rrhh.idEmpleado";
const oyentes = new Set();

export function leerEmpleado() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

// Respaldo en memoria para cuando no hay almacenamiento: el empleado dura solo esta visita.
let empleadoEnMemoria = leerEmpleado();

const avisarOyentes = () => oyentes.forEach((avisar) => avisar());

export function guardarEmpleado(idEmpleado) {
  empleadoEnMemoria = idEmpleado;
  try {
    localStorage.setItem(CLAVE, idEmpleado);
  } catch {
    // Sin almacenamiento: se pedirá el identificador en la próxima visita.
  }
  avisarOyentes();
}

export function olvidarEmpleado() {
  empleadoEnMemoria = null;
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
  avisarOyentes();
}

// Mantiene el mismo empleado en todas las pestañas abiertas.
function alCambiarEnOtraPestana(evento) {
  if (evento.key !== CLAVE) return;
  empleadoEnMemoria = leerEmpleado();
  avisarOyentes();
}

function suscribir(avisar) {
  if (oyentes.size === 0) window.addEventListener("storage", alCambiarEnOtraPestana);
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
    if (oyentes.size === 0) window.removeEventListener("storage", alCambiarEnOtraPestana);
  };
}

// Empleado identificado en el portal; se actualiza cuando alguna pantalla lo identifica o lo cambia.
export const useEmpleado = () => useSyncExternalStore(suscribir, () => empleadoEnMemoria);

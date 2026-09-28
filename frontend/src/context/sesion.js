import { useSyncExternalStore } from "react";
import { esRol, ROL_PREDETERMINADO } from "../utils/permisos";

// Rol de prueba. Temporal hasta contar con inicio de sesión.
const CLAVE = "rrhh.rol";
const oyentes = new Set();

function leerRol() {
  try {
    const rol = localStorage.getItem(CLAVE);
    return esRol(rol) ? rol : ROL_PREDETERMINADO;
  } catch {
    return ROL_PREDETERMINADO;
  }
}

let rolActual = leerRol();

const avisarOyentes = () => oyentes.forEach((avisar) => avisar());

export function cambiarRol(rol) {
  if (!esRol(rol)) return;
  rolActual = rol;
  try {
    localStorage.setItem(CLAVE, rol);
  } catch {
    // Sin almacenamiento: el rol dura solo esta visita.
  }
  avisarOyentes();
}

// Mantiene el mismo rol en todas las pestañas abiertas.
function alCambiarEnOtraPestana(evento) {
  if (evento.key !== CLAVE) return;
  rolActual = leerRol();
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

export const useRol = () => useSyncExternalStore(suscribir, () => rolActual);

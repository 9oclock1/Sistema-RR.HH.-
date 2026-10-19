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

// Usuario de prueba: el mismo identificador de empleado que usan Marcaje y Comunicaciones.
const CLAVE_USUARIO = "rrhh.idEmpleado";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function leerUsuario() {
  try {
    const id = localStorage.getItem(CLAVE_USUARIO);
    return id && UUID.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function cambiarUsuario(idEmpleado) {
  try {
    if (idEmpleado) localStorage.setItem(CLAVE_USUARIO, idEmpleado);
    else localStorage.removeItem(CLAVE_USUARIO);
  } catch {
    // Sin almacenamiento: el usuario no se conserva entre visitas.
  }
  avisarOyentes();
}

// Mantiene el mismo rol y usuario en todas las pestañas abiertas.
function alCambiarEnOtraPestana(evento) {
  if (evento.key === CLAVE) rolActual = leerRol();
  else if (evento.key !== CLAVE_USUARIO) return;
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

export const useUsuario = () => useSyncExternalStore(suscribir, leerUsuario);

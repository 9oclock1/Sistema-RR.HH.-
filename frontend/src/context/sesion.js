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

// Sesión real (AuthService, cookie HttpOnly). Mientras hay una, el rol y el usuario son los de la sesión; al cerrarla
// vuelven los de prueba. undefined: aún no se consultó; null: sin sesión; si no, { id_empleado, correo, rol }.
let sesionActual;
let formularioAbierto = false;

export function fijarSesion(usuario) {
  sesionActual = usuario ?? null;
  avisarOyentes();
}

export function abrirInicioSesion(abierto = true) {
  formularioAbierto = abierto;
  avisarOyentes();
}

export const useSesion = () => useSyncExternalStore(suscribir, () => sesionActual);

export const useFormularioSesion = () => useSyncExternalStore(suscribir, () => formularioAbierto);

const rolDeSesion = () => (esRol(sesionActual?.rol) ? sesionActual.rol : null);

export const useRol = () => useSyncExternalStore(suscribir, () => rolDeSesion() ?? rolActual);

export const useUsuario = () => useSyncExternalStore(suscribir, () => sesionActual?.id_empleado ?? leerUsuario());

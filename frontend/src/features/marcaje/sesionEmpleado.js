// Temporal hasta contar con inicio de sesión.
const CLAVE = "rrhh.idEmpleado";

export function leerEmpleado() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function guardarEmpleado(idEmpleado) {
  try {
    localStorage.setItem(CLAVE, idEmpleado);
  } catch {
    // Sin almacenamiento: se pedirá el identificador en la próxima visita.
  }
}

export function olvidarEmpleado() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}

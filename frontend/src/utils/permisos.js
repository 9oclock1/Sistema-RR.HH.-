// Jerarquía de roles: cada rol tiene también los permisos de los roles que incluye.
export const ROLES = {
  admin: { nombre: "Administrador de RRHH", incluye: ["gerente", "reclutador"] },
  gerente: { nombre: "Gerente de talento", incluye: ["supervisor"] },
  reclutador: { nombre: "Encargado de reclutamiento", incluye: ["empleado"] },
  supervisor: { nombre: "Supervisor de área", incluye: ["empleado"] },
  empleado: { nombre: "Empleado", incluye: [] },
};

export const ROL_PREDETERMINADO = "admin";

export const esRol = (rol) => typeof rol === "string" && Object.hasOwn(ROLES, rol);

export function rolesIncluidos(rol) {
  const incluidos = new Set();
  const pendientes = [rol];
  while (pendientes.length > 0) {
    const actual = pendientes.pop();
    if (!esRol(actual) || incluidos.has(actual)) continue;
    incluidos.add(actual);
    pendientes.push(...ROLES[actual].incluye);
  }
  return incluidos;
}

// Sin roles, el acceso queda abierto a todos.
export function puedeAcceder(rol, rolesPermitidos = []) {
  if (rolesPermitidos.length === 0) return true;
  const incluidos = rolesIncluidos(rol);
  return rolesPermitidos.some((permitido) => incluidos.has(permitido));
}

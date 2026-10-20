import { solicitar } from "./cliente";

const RUTA = "/att/aprobaciones/solicitudes";

// Temporal hasta contar con inicio de sesión: el portal envía el rol y el empleado que resuelve.
const comoResolutor = (rol, idEmpleado) => ({ "X-Rol": rol, ...(idEmpleado && { "X-Empleado-Id": idEmpleado }) });

// { resumen: { pendientes, aprobadas, rechazadas }, solicitudes }
// estado: PENDIENTE | APROBADA | RECHAZADA | TODAS; categoria: VACACIONES | LICENCIA; prioridad: ALTA | MEDIA | BAJA.
export const listarAprobaciones = (rol, { idSucursal, idDepartamento, estado, categoria, prioridad }) => {
  const parametros = new URLSearchParams({ id_sucursal: idSucursal, estado });
  if (idDepartamento) parametros.set("id_departamento", idDepartamento);
  if (categoria) parametros.set("categoria", categoria);
  if (prioridad) parametros.set("prioridad", prioridad);
  return solicitar(`${RUTA}?${parametros}`, { cabeceras: comoResolutor(rol) });
};

export const obtenerAprobacion = (rol, categoria, idSolicitud) =>
  solicitar(`${RUTA}/${categoria}/${idSolicitud}`, { cabeceras: comoResolutor(rol) });

// decision: APROBADA | RECHAZADA; el motivo es obligatorio al rechazar.
export const resolverAprobacion = (rol, idResolutor, categoria, idSolicitud, { decision, motivo }) =>
  solicitar(`${RUTA}/${categoria}/${idSolicitud}/resolucion`, {
    metodo: "POST",
    cuerpo: { decision, motivo },
    cabeceras: comoResolutor(rol, idResolutor),
  });

export const descargarComprobanteAprobacion = (rol, idSolicitud, idAdjunto) =>
  solicitar(`${RUTA}/LICENCIA/${idSolicitud}/adjuntos/${idAdjunto}`, {
    cabeceras: comoResolutor(rol),
    respuestaBinaria: true,
  });

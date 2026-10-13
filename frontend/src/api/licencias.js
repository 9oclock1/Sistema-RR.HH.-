import { solicitar } from "./cliente";

const RUTA = "/att/licencias";

const comoEmpleado = (idEmpleado) => ({ "X-Empleado-Id": idEmpleado });

export const listarTiposLicencia = () => solicitar(`${RUTA}/tipos`);

export const listarMisSolicitudes = (idEmpleado) =>
  solicitar(`${RUTA}/solicitudes`, { cabeceras: comoEmpleado(idEmpleado) });

// formulario: FormData con los campos de la solicitud y los comprobantes en "archivos".
export const radicarSolicitud = (idEmpleado, formulario) =>
  solicitar(`${RUTA}/solicitudes`, { metodo: "POST", cuerpo: formulario, cabeceras: comoEmpleado(idEmpleado) });

export const descargarComprobante = (idEmpleado, idSolicitud, idAdjunto) =>
  solicitar(`${RUTA}/solicitudes/${idSolicitud}/adjuntos/${idAdjunto}`, {
    cabeceras: comoEmpleado(idEmpleado),
    respuestaBinaria: true,
  });

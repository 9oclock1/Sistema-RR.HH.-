import { solicitar } from "./cliente";

const RUTA = "/comp/desvinculaciones";

const cabeceras = ({ idEmpleado, rol } = {}) => ({
  ...(idEmpleado && { "X-Empleado-Id": idEmpleado }),
  "X-Rol": rol,
});

export const listarCausalesDesvinculacion = (identidad) =>
  solicitar(`${RUTA}/causales`, { cabeceras: cabeceras(identidad) });

export const listarDesvinculaciones = (filtros = {}, identidad) => {
  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, valor]) => valor !== "" && valor != null)
  );
  const query = params.toString();
  return solicitar(`${RUTA}${query ? `?${query}` : ""}`, { cabeceras: cabeceras(identidad) });
};

export const registrarDesvinculacion = (formData, identidad) =>
  solicitar(RUTA, {
    metodo: "POST",
    cuerpo: formData,
    cabeceras: cabeceras(identidad),
  });

export const descargarDocumentoDesvinculacion = (idProceso, identidad) =>
  solicitar(`${RUTA}/${idProceso}/documento`, {
    cabeceras: cabeceras(identidad),
    respuestaBinaria: true,
  });

export const obtenerPromedioIndemnizable = (idProceso, identidad) =>
  solicitar(`${RUTA}/${idProceso}/promedio-indemnizable`, {
    cabeceras: cabeceras(identidad),
  });

// KAN-77: duodécimas de aguinaldo y vacaciones truncas del finiquito.
export const obtenerSaldosProporcionales = (idProceso, identidad) =>
  solicitar(`${RUTA}/${idProceso}/saldos-proporcionales`, { cabeceras: cabeceras(identidad) });

export const calcularSaldosProporcionales = (idProceso, identidad) =>
  solicitar(`${RUTA}/${idProceso}/saldos-proporcionales`, { metodo: "POST", cabeceras: cabeceras(identidad) });

export const calcularPromedioIndemnizable = (idProceso, identidad) =>
  solicitar(`${RUTA}/${idProceso}/promedio-indemnizable`, {
    metodo: "POST",
    cabeceras: cabeceras(identidad),
  });

export const obtenerBeneficiosSociales = (idProceso, identidad) =>
  solicitar(`${RUTA}/${idProceso}/beneficios-sociales`, {
    cabeceras: cabeceras(identidad),
  });

export const calcularBeneficiosSociales = (idProceso, identidad) =>
  solicitar(`${RUTA}/${idProceso}/beneficios-sociales`, {
    metodo: "POST",
    cabeceras: cabeceras(identidad),
  });

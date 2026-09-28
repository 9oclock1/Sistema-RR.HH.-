import { solicitar } from "./cliente";

const RUTA = "/notf/comunicaciones";

const cabecerasUsuario = (idEmpleado, rol = "empleado") => ({
  "X-Empleado-Id": idEmpleado || "",
  "X-Usuario-Id": idEmpleado || "",
  "X-Rol": rol || "empleado",
});

// Catálogos y destinatarios disponibles
export const obtenerCatalogos = () => solicitar(`${RUTA}/catalogos`);

export const obtenerDestinatariosDisponibles = () => solicitar(`${RUTA}/destinatarios`);

// RF-64: Envío de mensaje directo
export const enviarComunicacionDirecta = (datos, idRemitente, rol) =>
  solicitar(`${RUTA}/directa`, {
    metodo: "POST",
    cuerpo: datos,
    cabeceras: cabecerasUsuario(idRemitente, rol),
  });

// RF-65: Emisión de comunicado institucional
export const emitirComunicadoInstitucional = (datos, idRemitente, rol) =>
  solicitar(`${RUTA}/institucional`, {
    metodo: "POST",
    cuerpo: datos,
    cabeceras: cabecerasUsuario(idRemitente, rol),
  });

// RF-66: Bandeja de mensajes del empleado
export const consultarBandeja = (idEmpleado, { estado = "todos", busqueda = "" } = {}) => {
  const params = new URLSearchParams();
  if (estado && estado !== "todos") params.set("estado", estado);
  if (busqueda && busqueda.trim()) params.set("busqueda", busqueda.trim());
  const query = params.toString() ? `?${params.toString()}` : "";
  return solicitar(`${RUTA}/bandeja${query}`, {
    cabeceras: cabecerasUsuario(idEmpleado),
  });
};

// RF-66 & RF-67: Abrir mensaje (marca como leído)
export const abrirMensaje = (idDestinatario, idEmpleado) =>
  solicitar(`${RUTA}/mensaje/${idDestinatario}`, {
    cabeceras: cabecerasUsuario(idEmpleado),
  });

// RF-67: Confirmar recepción obligatoria
export const confirmarRecepcion = (idDestinatario, idEmpleado) =>
  solicitar(`${RUTA}/mensaje/${idDestinatario}/confirmar`, {
    metodo: "POST",
    cabeceras: cabecerasUsuario(idEmpleado),
  });

// RF-64 AC 3 & RF-65 AC 2: Consultar enviados
export const consultarEnviados = (idRemitente, rol) =>
  solicitar(`${RUTA}/enviados`, {
    cabeceras: cabecerasUsuario(idRemitente, rol),
  });

// RF-67 AC 2 & 3: Auditoría de comunicado
export const consultarAuditoria = (idComunicacion) =>
  solicitar(`${RUTA}/${idComunicacion}/auditoria`);

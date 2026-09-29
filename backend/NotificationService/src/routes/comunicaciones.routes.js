const { Router } = require("express");
const controlador = require("../controllers/comunicaciones.controller");
const {
  extraerIdentidad,
  exigirEmpleado,
  exigirIdentidad,
  exigirRol,
  validarParamUuid,
} = require("../middlewares/identificarUsuario");

const router = Router();

// Catálogos y datos auxiliares para selección de destinatarios
router.get("/comunicaciones/catalogos", controlador.obtenerCatalogos);
router.get("/comunicaciones/destinatarios", extraerIdentidad, controlador.obtenerDestinatariosDisponibles);

// RF-64: Envío de comunicación directa a un empleado activo (Supervisores y RRHH)
router.post(
  "/comunicaciones/directa",
  exigirIdentidad,
  exigirRol(["admin", "gerente", "supervisor"]),
  controlador.enviarDirecta
);

// RF-65: Emisión de comunicados, circulares y reglamentos institucionales (Exclusivo Administrador de RRHH / Gerente)
router.post(
  "/comunicaciones/institucional",
  exigirIdentidad,
  exigirRol(["admin", "gerente"]),
  controlador.emitirInstitucional
);

// RF-66: Bandeja de mensajes del empleado
router.get("/comunicaciones/bandeja", exigirEmpleado, controlador.consultarBandeja);

// RF-66 & RF-67: Apertura de mensaje (marcado como leído automático)
router.get(
  "/comunicaciones/mensaje/:idDestinatario",
  exigirEmpleado,
  validarParamUuid("idDestinatario"),
  controlador.abrirMensaje
);

// RF-67: Confirmación explícita de recepción para comunicados obligatorios
router.post(
  "/comunicaciones/mensaje/:idDestinatario/confirmar",
  exigirEmpleado,
  validarParamUuid("idDestinatario"),
  controlador.confirmarRecepcion
);

// RF-64 AC 3 & RF-65 AC 2: Consulta de mensajes y comunicados enviados (Supervisores y RRHH)
router.get(
  "/comunicaciones/enviados",
  exigirIdentidad,
  exigirRol(["admin", "gerente", "supervisor"]),
  controlador.consultarEnviados
);

// RF-67 AC 2 & 3: Auditoría de confirmaciones y pendientes de un comunicado (Requiere identidad y rol)
router.get(
  "/comunicaciones/:idComunicacion/auditoria",
  exigirIdentidad,
  exigirRol(["admin", "gerente", "supervisor"]),
  validarParamUuid("idComunicacion"),
  controlador.consultarAuditoria
);

module.exports = router;

const { Router } = require("express");
const controlador = require("../controllers/comunicaciones.controller");
const { extraerIdentidad, exigirEmpleado } = require("../middlewares/identificarUsuario");

const router = Router();

// Catálogos y datos auxiliares para selección de destinatarios
router.get("/comunicaciones/catalogos", controlador.obtenerCatalogos);
router.get("/comunicaciones/destinatarios", controlador.obtenerDestinatariosDisponibles);

// RF-64: Envío de comunicación directa a un empleado activo
router.post("/comunicaciones/directa", extraerIdentidad, controlador.enviarDirecta);

// RF-65: Emisión de comunicados, circulares y reglamentos institucionales (general, departamento, sucursal)
router.post("/comunicaciones/institucional", extraerIdentidad, controlador.emitirInstitucional);

// RF-66: Bandeja de mensajes del empleado
router.get("/comunicaciones/bandeja", exigirEmpleado, controlador.consultarBandeja);

// RF-66 & RF-67: Apertura de mensaje (marcado como leído automático)
router.get("/comunicaciones/mensaje/:idDestinatario", exigirEmpleado, controlador.abrirMensaje);

// RF-67: Confirmación explícita de recepción para comunicados obligatorios
router.post("/comunicaciones/mensaje/:idDestinatario/confirmar", exigirEmpleado, controlador.confirmarRecepcion);

// RF-64 AC 3 & RF-65 AC 2: Consulta de mensajes y comunicados enviados
router.get("/comunicaciones/enviados", extraerIdentidad, controlador.consultarEnviados);

// RF-67 AC 2 & 3: Auditoría de confirmaciones y pendientes de un comunicado
router.get("/comunicaciones/:idComunicacion/auditoria", extraerIdentidad, controlador.consultarAuditoria);

module.exports = router;

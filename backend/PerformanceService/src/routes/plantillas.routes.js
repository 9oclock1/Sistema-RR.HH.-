const { Router } = require("express");
const plantillas = require("../controllers/plantillas.controller");
const catalogos = require("../controllers/catalogos.controller");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

// Cada fila de la lista es una versión; las operaciones de edición actúan sobre una versión.
router.get("/plantillas", plantillas.listar);
// Crea la plantilla con su versión 1 en borrador. El creador viaja en X-Empleado-Id.
router.post("/plantillas", identificarEmpleado, plantillas.crear);
router.get("/plantillas/versiones/:idVersion", plantillas.obtener);
router.put("/plantillas/versiones/:idVersion", plantillas.actualizar);
router.delete("/plantillas/versiones/:idVersion", plantillas.eliminar);
// Quien publica viaja en X-Empleado-Id.
router.post("/plantillas/versiones/:idVersion/publicacion", identificarEmpleado, plantillas.publicar);
router.post("/plantillas/versiones/:idVersion/nueva-version", plantillas.crearVersion);

router.get("/escalas", catalogos.listarEscalas);
router.post("/escalas", catalogos.crearEscala);
router.put("/escalas/:idEscala", catalogos.actualizarEscala);
router.delete("/escalas/:idEscala", catalogos.eliminarEscala);

router.get("/competencias", catalogos.listarCompetencias);
router.post("/competencias", catalogos.crearCompetencia);

module.exports = router;

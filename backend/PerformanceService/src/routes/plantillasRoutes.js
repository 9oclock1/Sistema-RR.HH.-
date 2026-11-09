const { Router } = require("express");
const controlador = require("../controllers/plantillasController");
const versiones = require("../controllers/versionesController");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

router.get("/plantillas", identificarEmpleado, controlador.listar);
router.post("/plantillas", identificarEmpleado, controlador.crear);
router.get("/plantillas/:idPlantilla", identificarEmpleado, controlador.obtener);
router.put("/plantillas/:idPlantilla", identificarEmpleado, controlador.actualizar);
router.delete("/plantillas/:idPlantilla", identificarEmpleado, controlador.eliminar);

router.post("/plantillas/:idPlantilla/versiones", identificarEmpleado, versiones.crearVersion);
router.get("/plantillas/:idPlantilla/versiones/:idVersion", identificarEmpleado, versiones.obtener);
router.put(
  "/plantillas/:idPlantilla/versiones/:idVersion/secciones",
  identificarEmpleado,
  versiones.reemplazarSecciones,
);
router.put(
  "/plantillas/:idPlantilla/versiones/:idVersion/estructura",
  identificarEmpleado,
  versiones.guardarEstructura,
);
router.post(
  "/plantillas/:idPlantilla/versiones/:idVersion/publicacion",
  identificarEmpleado,
  versiones.publicar,
);

module.exports = router;

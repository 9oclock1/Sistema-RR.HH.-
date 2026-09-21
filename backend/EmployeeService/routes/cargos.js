const router = require("express").Router();
const cargos = require("../controllers/cargos");

router.get("/", cargos.listarCargos);
router.get("/:id", cargos.obtenerCargo);
router.post("/", cargos.crearCargo);
router.put("/:id", cargos.actualizarCargo);

module.exports = router;
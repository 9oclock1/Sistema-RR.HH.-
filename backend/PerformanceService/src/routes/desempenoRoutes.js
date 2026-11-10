const { Router } = require("express");
const controlador = require("../controllers/desempenoController");
const exigirRoles = require("../middlewares/exigirRoles");

const router = Router();

// cambia el umbral de brecha y reintenta la solicitud de métricas al CRM.
const consultaRrhh = exigirRoles(
  ["admin", "gerente"],
  "Solo RRHH puede consultar el consolidado de desempeño.",
);
const soloAdministrador = exigirRoles(
  ["admin"],
  "Solo el Administrador de RRHH puede modificar el consolidado de desempeño.",
);

// Ciclos cerrados, que son los que se pueden consolidar.
router.get("/desempeno/ciclos", consultaRrhh, controlador.listarCiclos);
router.get(
  "/desempeno/ciclos/:idCiclo/consolidado",
  consultaRrhh,
  controlador.obtenerConsolidado,
);
// ?por=departamento (por defecto) o ?por=sucursal
router.get(
  "/desempeno/ciclos/:idCiclo/comparativa",
  consultaRrhh,
  controlador.obtenerComparativa,
);
// ?departamento=<id>&sucursal=<id>
router.get(
  "/desempeno/ciclos/:idCiclo/colaboradores",
  consultaRrhh,
  controlador.obtenerColaboradores,
);
router.put(
  "/desempeno/ciclos/:idCiclo/umbral",
  soloAdministrador,
  controlador.actualizarUmbral,
);
// Vuelve a publicar la solicitud de métricas al CRM cuando quedó fallida (por ejemplo, Pub/Sub sin credenciales).
router.post(
  "/desempeno/ciclos/:idCiclo/solicitud-crm/reintentar",
  soloAdministrador,
  controlador.reintentarSolicitudCrm,
);

module.exports = router;

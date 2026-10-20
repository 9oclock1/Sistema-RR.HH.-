const { Router } = require("express");
const { listarDesde } = require("../utils/mensajesPublicados");

const router = Router();

router.get("/mensajes-publicados", (req, res) => {
  res.json(listarDesde(Number(req.query.desde) || 0));
});

module.exports = router;

const express = require("express");
const router = express.Router();
const rankingController = require("../controllers/rankingController");
const { validarConsultaRanking } = require("../validators/rankingValidator");

router.get(
  "/:id_convocatoria/ranking",
  validarConsultaRanking,
  rankingController.getRankingByConvocatoria,
);

module.exports = router;

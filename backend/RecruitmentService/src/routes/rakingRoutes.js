const express = require("express");
const router = express.Router();
const rankingController = require("../controllers/rankingController");

router.get(
  "/:id_convocatoria/ranking",
  rankingController.getRankingByConvocatoria,
);

module.exports = router;

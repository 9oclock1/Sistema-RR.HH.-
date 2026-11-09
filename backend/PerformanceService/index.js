const express = require("express");
const cors = require("cors");
const pool = require("./src/config/db");
const evaluacionesRoutes = require("./src/routes/evaluacionesRoutes");
const plantillasRoutes = require("./src/routes/plantillasRoutes");
const competenciasRoutes = require("./src/routes/competenciasRoutes");
const escalasRoutes = require("./src/routes/escalasRoutes");
const quejasRoutes = require("./src/routes/quejasRoutes");
const ciclosRoutes = require("./src/routes/ciclosRoutes");
const desempenoRoutes = require("./src/routes/desempenoRoutes");
const manejadorErrores = require("./src/middlewares/manejadorErrores");
const { iniciarCronCiclos } = require("./src/jobs/ciclosEvaluacionCron");

const app = express();
const PORT = process.env.PORT || 3006;

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ service: "PerformanceService", status: "Online", port: PORT });
});

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as db_time");
    res.json({
      service: "PerformanceService",
      db_connected: true,
      timestamp: result.rows[0].db_time,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        service: "PerformanceService",
        db_connected: false,
        error: error.message,
      });
  }
});

app.use(evaluacionesRoutes);
app.use(plantillasRoutes);
app.use(quejasRoutes);
app.use(competenciasRoutes);
app.use(escalasRoutes);
app.use(ciclosRoutes);
app.use(desempenoRoutes);
app.use(manejadorErrores);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PerformanceService corriendo en http://0.0.0.0:${PORT}`);
  iniciarCronCiclos();
});

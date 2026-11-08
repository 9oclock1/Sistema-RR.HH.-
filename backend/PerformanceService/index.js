const express = require("express");
const cors = require("cors");
const pool = require("./src/config/db");
const evaluacionesRoutes = require("./src/routes/evaluacionesRoutes");
const plantillasRoutes = require("./src/routes/plantillas.routes");
const quejasRoutes = require("./src/routes/quejasRoutes");
const ciclosRoutes = require("./src/routes/ciclosRoutes");
const manejadorErrores = require("./src/middlewares/manejadorErrores");

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
app.use(ciclosRoutes);
app.use(manejadorErrores);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PerformanceService corriendo en http://0.0.0.0:${PORT}`);
});
